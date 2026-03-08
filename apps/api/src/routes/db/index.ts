import { FastifyInstance } from "fastify";
import { mfaMiddleware } from "../../middleware/mfa";
import { AddDbPayload, DbCredentialsMethod, DbCredentialsPayload } from "@mirrordb/types";
import { addDatabase, cancelClone, connectDatabase, forkDatabase, getDatabase, listDatabases } from "../../services/db";
import { createEmitter } from "../../utils/emit";
import { tunnelOrchestrator } from "../../tunnel";
import crypto from "crypto";
import { cleanupQueue } from "@mirrordb/queue";
import { getCleanupQueueName } from "../../utils/helper";


const forkSessions = new Map<
    string,
    {
        cloneId: string;
        forkedDatabaseId: string;
    }
>();


export function dbRoutes(app: FastifyInstance) {

    app.post<{ Body: AddDbPayload }>("/add", {
        preHandler: [mfaMiddleware]
    }, async (request, reply) => {
        const database = await addDatabase(app.prisma, request.user, request.body)
        reply.code(201);
        reply.send({ success: true, data: database });
    });

    app.get<{ Body: AddDbPayload }>("/list", {
        preHandler: [mfaMiddleware]
    }, async (request, reply) => {
        const database = await listDatabases(app.prisma, request.user)
        reply.code(200);
        reply.send({ success: true, data: database });
    });

    app.get<{ Params: { id: string } }>("/:id", {
        preHandler: [mfaMiddleware]
    }, async (request, reply) => {
        const database = await getDatabase(app.prisma, request.user, request.params.id)
        reply.code(200);
        reply.send({ success: true, data: database });
    })

    app.post<{ Params: { id: string }, Body: DbCredentialsPayload }>("/:id/connect", {
        preHandler: [mfaMiddleware]
    }, async (request, reply) => {
        const database = await connectDatabase(app.prisma, request.body, request.params.id, request.user.id)
        reply.code(201);
        reply.send({ success: true, data: database });
    })
    app.post<{ Params: { id: string }, Body: DbCredentialsPayload }>("/:id/fork", {
        preHandler: [mfaMiddleware]
    }, async (request, reply) => {
        const database = await forkDatabase(app.prisma, request.params.id, request.user.id)
        reply.code(201);
        reply.send({ success: true, data: database });
    })

    app.get<{ Params: { cloneId: string } }>(
        "/:cloneId/stream",
        { preHandler: [mfaMiddleware] },
        async (request, reply) => {
            const { cloneId } = request.params;

            // Set SSE headers
            reply.raw.setHeader("Content-Type", "text/event-stream");
            reply.raw.setHeader("Cache-Control", "no-cache");
            reply.raw.setHeader("Connection", "keep-alive");
            reply.raw.setHeader("X-Accel-Buffering", "no"); // prevents buffering in some proxies
            reply.raw.flushHeaders?.();

            // Fetch initial state
            const clone = await app.prisma.databaseClone.findUnique({
                where: { id: cloneId },
            });

            if (!clone) {
                reply.raw.write(
                    `event: error\ndata: ${JSON.stringify({
                        message: "Clone not found",
                    })}\n\n`
                );
                reply.raw.end();
                return;
            }

            // Send initial state immediately
            reply.raw.write(`data: ${JSON.stringify(clone)}\n\n`);

            let lastStatus = clone.status;

            // Poll every second
            const interval = setInterval(async () => {
                try {
                    const latest = await app.prisma.databaseClone.findUnique({
                        where: { id: cloneId },
                    });

                    if (!latest) {
                        clearInterval(interval);
                        reply.raw.end();
                        return;
                    }

                    // Only send update if status changed
                    if (latest.status !== lastStatus) {
                        reply.raw.write(`data: ${JSON.stringify(latest)}\n\n`);
                        lastStatus = latest.status;
                    }

                    // Close stream on terminal states
                    if (
                        latest.status === "COMPLETED" ||
                        latest.status === "FAILED" ||
                        latest.status === "CANCELLED"
                    ) {
                        clearInterval(interval);
                        reply.raw.end();
                    }
                } catch {
                    clearInterval(interval);
                    reply.raw.end();
                }
            }, 1000);

            request.raw.on("close", () => {
                clearInterval(interval);
            });
        }
    );

    app.patch<{ Params: { cloneId: string } }>("/:cloneId/cancel", { preHandler: [mfaMiddleware] }, async (request, reply) => {
        const clone = await cancelClone(app.prisma, request.params.cloneId);
        reply.send({ success: true, data: clone });
    })

    app.get<{ Params: { cloneId: string } }>("/:cloneId/tunnel", { preHandler: [mfaMiddleware] }, async (request, reply) => {
        const { cloneId } = request.params;
        const clone = await app.prisma.databaseClone.findUnique({
            where: { id: cloneId },
            include: {
                forkedDatabase: true,
                sourceDatabase: true,
            }
        });

        const credential = await app.prisma.databaseCredential.findFirstOrThrow({
            where: {
                databaseId: clone?.sourceDatabaseId,
                isActive: true
            }
        },)

        if (!clone || !clone.forkedDatabase) {
            reply.code(404).send();
            return;
        }

        // Only allow tunneling for completed forks
        if (clone.status !== "COMPLETED") {
            reply.code(400).send({ message: "Fork is not completed yet" });
            return;
        }

        const session = crypto.randomUUID();

        forkSessions.set(session, {
            cloneId: clone.id,
            forkedDatabaseId: clone.forkedDatabaseId as string
        });

        reply.raw.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
        });

        const emit = createEmitter(reply.raw);

        emit("init", { session });

        const interval = setInterval(() => {
            reply.raw.write(": keep-alive\n\n");
        }, 30000);

        request.raw.on("close", async () => {
            clearInterval(interval);
            const cleanupName = getCleanupQueueName(clone.sourceDatabase.engine)
            await cleanupQueue.add(cleanupName, {
                cloneId: cloneId,
                forkedDatabaseId: clone.forkedDatabaseId,
            }, {
                attempts: 3,
                backoff: { type: 'exponential', delay: 5000 },
                removeOnComplete: true,
                removeOnFail: false,
            })
            forkSessions.delete(session);
        });

        try {
            emit("tunnel:starting", {});

            await tunnelOrchestrator({
                clone,
                credentialType: credential.type as DbCredentialsMethod,
                emit,
                isSessionAlive: () => forkSessions.has(session),
            });
        } finally {
            clearInterval(interval);
            forkSessions.delete(session);
            reply.raw.end();
        }
    });

}

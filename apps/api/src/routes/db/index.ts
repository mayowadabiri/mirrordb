import { FastifyInstance } from "fastify";
import { mfaMiddleware } from "../../middleware/mfa";
import { AddDbPayload, DbCredentialsPayload } from "@mirrordb/types";
import { addDatabase, connectDatabase, forkDatabase, getDatabase, listDatabases } from "../../services/db";
import { createEmitter } from "../../utils/emit";
import { forkOrchestrator } from "../../fork/orchestrator";


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

    app.get<{ Body: AddDbPayload }>("/list", async (request, reply) => {
        const database = await listDatabases(app.prisma, request.user)
        reply.code(200);
        reply.send({ success: true, data: database });
    });

    app.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
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

    app.get<{ Params: { cloneId: string } }>("/:cloneId/stream", async (request, reply) => {
        const clone = await app.prisma.databaseClone.findUnique({
            where: { id: request.params.cloneId }
        });

        if (!clone || !clone.forkedDatabaseId) {
            reply.code(404).send();
            return;
        }

        const session = crypto.randomUUID();

        forkSessions.set(session, {
            cloneId: clone.id,
            forkedDatabaseId: clone.forkedDatabaseId
        });

        reply.raw.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "close",
        });

        const emit = createEmitter(reply.raw);
        emit("init", {
            session
        });

        const interval = setInterval(() => {
            reply.raw.write(": keep-alive\n\n");
        }, 300);

        try {
            await forkOrchestrator({
                sessionData: {
                    cloneId: clone.id,
                    forkedDatabaseId: clone.forkedDatabaseId,
                    sessionId: session
                },
                emit,
                isSessionAlive: () => forkSessions.has(session)
            });
        } finally {
            clearInterval(interval);
            forkSessions.delete(session);
            reply.raw.end();
        }

        request.raw.on("close", () => {
            clearInterval(interval);
            forkSessions.delete(session);
        });
    });

    app.get<{ Params: { cloneId: string } }>('/:cloneId/tunnel', async (request,) => {
        await app.prisma.databaseClone.findUnique({
            where: { id: request.params.cloneId },
            include: {
                forkedDatabase: true
            }
        });

        // const tunnel = await tunnelDatabase(clone?.forkedDatabase);

    });

}

import { FastifyInstance } from "fastify";
import { mfaMiddleware } from "../../middleware/mfa";
import { AddDbPayload, DbCredentialsPayload } from "@mirrordb/types";
import { addDatabase, connectDatabase, getDatabase, listDatabases } from "../../services/db";

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
}

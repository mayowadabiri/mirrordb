import { FastifyInstance } from "fastify";
import { createSuccessResponse } from "../utils/response";


export function sessionRoute(app: FastifyInstance) {
    app.get(
        "/verify",
        async (request, reply) => {
            reply.code(200);
            return createSuccessResponse({}, "Verified Successfully");
        }
    );
}

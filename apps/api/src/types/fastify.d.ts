import "fastify";
import { RequestUser } from ".";

declare module "fastify" {
    interface FastifyRequest {
        user: RequestUser;
    }
}
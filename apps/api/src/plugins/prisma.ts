 

import { FastifyInstance, FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { prisma } from "../lib/prisma.js";

declare module "fastify" {
  interface FastifyInstance {
    prisma: typeof prisma;
  }
}

const prismaPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.decorate("prisma", prisma);

  fastify.addHook("onClose", async (instance) => {
    await instance.prisma.$disconnect();
  });
};

export default fp(prismaPlugin);

import { PrismaClient } from "../generated/prisma/index";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
}

// Pass config to PrismaPg instead of a Pool instance to avoid
// pg version mismatch (adapter bundles its own pg internally).
const adapter = new PrismaPg({ connectionString });

export const prisma = new PrismaClient({ adapter });

// Re-export everything from generated prisma client for type usage
export * from "../generated/prisma/index";
export type { PrismaClient } from "../generated/prisma/index";

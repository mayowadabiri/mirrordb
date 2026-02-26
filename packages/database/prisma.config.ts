import path from "node:path";
import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

// Prisma CLI commands (migrate, generate, studio) need DATABASE_URL.
// In CI/production it's set as a real env var. For local dev, load
// from the API app's .env as a convenience fallback.
if (!process.env.DATABASE_URL) {
    dotenv.config({ path: path.resolve(import.meta.dirname, "../../apps/api/.env") });
}

export default defineConfig({
    schema: "prisma/schema.prisma",
    migrations: {
        path: "prisma/migrations",
    },
    datasource: {
        url: process.env.DATABASE_URL,
    },
});

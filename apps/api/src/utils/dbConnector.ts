import { Client } from "pg";
import { BadRequestError } from "./appError";
import { MongoClient } from "mongodb";
import mysql from "mysql2/promise";

export const validatePgConnection = async (client: Client) => {
    try {
        await client.connect()
        await client.query("SELECT 1")
    } catch {
        throw new BadRequestError("Database connection failed", {
            code: "DATABASE_CONNECTION_FAILED",
        });
    } finally {
        await client.end().catch(() => { });
    }
}

export const validateMongoConnection = async (url: string) => {
    const client = new MongoClient(url, {
        connectTimeoutMS: 5_000,
        serverSelectionTimeoutMS: 5_000,
    });

    try {
        await client.connect();

        await client.db().command({ ping: 1 });

        return;
    } catch {
        // Swallow ALL mongo errors and rethrow yours
        throw new BadRequestError("Database connection failed", {
            code: "DATABASE_CONNECTION_FAILED",
        });
    } finally {
        // Ensure shutdown completes before function exits
        try {
            await client.close(true);
        } catch {
            // ignore close errors
        }
    }
};

export const validateMySqlConnection = async (config: mysql.ConnectionOptions) => {
    let connection: mysql.Connection | null = null;

    try {
        connection = await mysql.createConnection({
            ...config,
            connectTimeout: 5000,
        });

        await connection.query("SELECT 1");
    } catch {
        throw new BadRequestError("Database connection failed", {
            code: "DATABASE_CONNECTION_FAILED",
        });
    } finally {
        if (connection) {
            try {
                await connection.end();
            } catch {
                // ignore close errors
            }
        }
    }
};



export async function assertTablesExist(client: Client) {

    try {
        await client.connect();

        const result = await client.query(`
      SELECT COUNT(*)::int AS table_count
      FROM information_schema.tables
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
    `);

        if (result.rows[0].table_count === 0) {
            throw new BadRequestError("No tables found in forked database");
        }
    } finally {
        await client.end();
    }
}

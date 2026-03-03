import { Client } from "pg";
import { BadRequestError } from "./appError";
import mysql from "mysql2/promise";
import ConnectionString from "mongodb-connection-string-url";



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


export interface ParsedMongoUri {
    protocol: "mongodb" | "mongodb+srv";
    username?: string;
    password?: string;
    hosts: string[];
    database?: string;
    options: Record<string, string>;
    isSrv: boolean;
    originalUri: string;
}

export function parseMongoUri(uri: string): ParsedMongoUri {
    const conn = new ConnectionString(uri);

    const protocol = conn.protocol.replace(":", "") as
        | "mongodb"
        | "mongodb+srv";

    const username = conn.username || undefined;
    const password = conn.password || undefined;

    // Handles multiple hosts (replica sets)
    const hosts = conn.hosts;

    // Remove leading slash
    const rawPath = conn.pathname?.replace(/^\//, "");
    const database = rawPath && rawPath.length > 0 ? rawPath : undefined;

    // Extract query params cleanly
    const options: Record<string, string> = {};
    conn.searchParams.forEach((value, key) => {
        options[key] = value;
    });

    return {
        protocol,
        username,
        password,
        hosts,
        database,
        options,
        isSrv: protocol === "mongodb+srv",
        originalUri: uri,
    };
}
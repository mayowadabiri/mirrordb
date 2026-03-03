import { MongoClient } from "mongodb";
import { Client } from "pg";

export const validatePgConnection = async (client: Client) => {
    try {
        await client.connect();
        await client.query("SELECT 1");
    } catch {
        throw new Error("PostgreSQL connection failed");
    } finally {
        await client.end().catch(() => { });
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
            throw new Error("No tables found in forked database");
        }
    } finally {
        await client.end();
    }
}


export const validateMongoConnection = async (url: string, dbName?: string) => {
    const client = new MongoClient(url, {
        connectTimeoutMS: 5_000,
        serverSelectionTimeoutMS: 5_000,
    });
    await client.connect();
    if (dbName) {
        const db = client.db(dbName);
        const collections = await db.listCollections({}, { nameOnly: true }).toArray();
        await client.close(true);
        return collections;
    }
    await client.close(true);
    return [];
};

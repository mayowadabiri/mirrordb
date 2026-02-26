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

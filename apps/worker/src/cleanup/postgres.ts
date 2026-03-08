import { prisma } from "@mirrordb/database";
import { neon, sanitizeDatabaseName } from "@mirrordb/utils";

interface CleanupData {
    cloneId: string;
    forkedDatabaseId: string;
}

async function cleanupPostgres({ forkedDatabaseId }: CleanupData): Promise<void> {
    const forkedDb = await prisma.forkedDatabase.findUniqueOrThrow({
        where: { id: forkedDatabaseId },
    });

    const dbName = sanitizeDatabaseName(forkedDb.name, 38);
    const roleName = `user_${forkedDatabaseId}`;

    // Delete the database first (it depends on the role as owner)
    await neon.deleteDatabase(dbName);

    // Then delete the role
    await neon.deleteRoleName(roleName);
}

export default cleanupPostgres;

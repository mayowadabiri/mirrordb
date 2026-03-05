import { prisma } from "@mirrordb/database";
import { deleteDatabaseUser, dropMongoDatabase } from "../forks/mongodb/actions";
import { sanitizeDatabaseName } from "@mirrordb/utils";

interface CleanupData {
    cloneId: string;
    forkedDatabaseId: string;
}

async function cleanupMongodb({ forkedDatabaseId }: CleanupData): Promise<void> {
    // Remove the database user scoped to this clone
    const username = `user_${forkedDatabaseId}`;
    await deleteDatabaseUser(username);

    // Drop the forked database
    const forkedDb = await prisma.forkedDatabase.findUniqueOrThrow({
        where: { id: forkedDatabaseId },
    });
    const dbName = sanitizeDatabaseName(forkedDb.name, 38);
    await dropMongoDatabase(dbName);
}

export default cleanupMongodb;
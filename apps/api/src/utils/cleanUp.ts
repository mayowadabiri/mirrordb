import { prisma } from "@mirrordb/database";
import { neon, sanitizeDatabaseName } from "@mirrordb/utils";

export const cleanup = async (cloneId: string) => {

    const cloneDb = await prisma.databaseClone.findUniqueOrThrow({
        where: {
            id: cloneId
        },
        include: {
            sourceDatabase: true,
            forkedDatabase: true
        }
    });


    const targetDb = await prisma.forkedDatabase.findUniqueOrThrow({
        where: { id: cloneDb.forkedDatabaseId! }
    });
    const targetDbName = sanitizeDatabaseName(targetDb.name);
    await neon.deleteDatabase(targetDbName);
}
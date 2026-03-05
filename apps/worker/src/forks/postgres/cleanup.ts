import { prisma } from "@mirrordb/database";
import PostgresDriver from "./driver";

export const cleanup = async (data: { cloneId: string; forkedDatabaseId: string }) => {

    const clonedDb = await prisma.databaseClone.findUnique({
        where: {
            id: data.cloneId,
        },
    });

    const forkedDb = await prisma.forkedDatabase.findUnique({
        where: {
            id: data.forkedDatabaseId,
        },
    });
    const sourceDb = await prisma.database.findUnique({
        where: {
            id: clonedDb?.sourceDatabaseId
        },
    });
    const postgresDrive = new PostgresDriver(sourceDb!, forkedDb!, session.cloneId)

    await postgresDrive.deleteDatabase()
    await postgresDrive.deleteRole()


}
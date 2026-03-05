import { prisma } from "@mirrordb/database";
import PostgresDriver from "./driver";

export const postgresFork = async (cloneId: string) => {

    const cloneDb = await prisma.databaseClone.findUnique({
        where: {
            id: cloneId
        },
        include: {
            sourceDatabase: true,
            forkedDatabase: true
        }
    });

    if (!cloneDb) {
        return
    }

    if (cloneDb.status === "COMPLETED" || cloneDb.status === "CANCELLED") {
        return
    }

    const clone = await prisma.databaseClone.update({
        where: { id: cloneId },
        data: {
            status: "RUNNING",
            startedAt: new Date()
        }
    });

    const postgres = new PostgresDriver(clone.id, clone.forkedDatabaseId!, clone.sourceDatabaseId);

    try {
        await postgres.fork();
    } catch (err) {
        await prisma.databaseClone.update({
            where: { id: cloneId },
            data: {
                status: "FAILED",
                completedAt: new Date(),
                errorMessage: err instanceof Error ? err.message : String(err)
            }
        });
        return;
    }


}
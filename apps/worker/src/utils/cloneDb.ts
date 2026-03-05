import { prisma } from "@mirrordb/database";
import { encrypt } from "@mirrordb/utils";

export const validateCloneDb = async (cloneId: string) => {
    if (!cloneId) {
        throw new Error("Clone ID is required");
    }

    const clone = await prisma.databaseClone.updateMany({
        where: {
            id: cloneId,
            status: "PENDING"
        },
        data: {
            status: "RUNNING",
            startedAt: new Date()
        }
    });

    if (clone.count === 0) {
        // Now determine WHY it failed
        const existing = await prisma.databaseClone.findUnique({
            where: { id: cloneId }
        });

        if (!existing) {
            throw new Error(`Clone ${cloneId} not found`);
        }

        if (existing.status === "RUNNING") {
            throw new Error(`Clone ${cloneId} is already running`);
        }

        if (existing.status === "COMPLETED") {
            throw new Error(`Clone ${cloneId} is already completed`);
        }

        if (existing.status === "FAILED") {
            throw new Error(`Clone ${cloneId} already failed`);
        }

        throw new Error(`Clone ${cloneId} is in invalid state: ${existing.status}`);
    }

    // Fetch full clone with relations after successful transition
    const fullClone = await prisma.databaseClone.findUnique({
        where: { id: cloneId },
        include: {
            sourceDatabase: true,
            forkedDatabase: true
        }
    });

    if (!fullClone) {
        // This should never happen if update succeeded
        throw new Error(`Clone ${cloneId} disappeared after update`);
    }

    return fullClone;
};


export const encryptPayload = async (url: string, forkedDatabaseId: string) => {
    const encryptPayload = {
        uri: url,
    }
    const encryptedPayload = encrypt(JSON.stringify(encryptPayload));
    await prisma.forkedDatabase.update({
        where: { id: forkedDatabaseId },
        data: {
            encryptedPayload
        }
    })
}
import { prisma } from "@mirrordb/database";

/**
 * Marks a clone as COMPLETED with a timestamp.
 */
export async function markCloneCompleted(cloneId: string): Promise<void> {
    await prisma.databaseClone.update({
        where: { id: cloneId },
        data: {
            status: "COMPLETED",
            completedAt: new Date(),
        },
    });
}

/**
 * Marks a clone as CANCELLED with the given reason and timestamp.
 */
export async function markCloneCancelled(cloneId: string, reason = "Cancelled by user"): Promise<void> {
    await prisma.databaseClone.update({
        where: { id: cloneId },
        data: {
            status: "CANCELLED",
            errorMessage: reason,
            completedAt: new Date(),
        },
    });
}

/**
 * Marks a clone as FAILED, extracting the message from the error, and sets a timestamp.
 */
export async function markCloneFailed(cloneId: string, error: unknown): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);

    await prisma.databaseClone.update({
        where: { id: cloneId },
        data: {
            status: "FAILED",
            errorMessage,
            completedAt: new Date(),
        },
    });
}

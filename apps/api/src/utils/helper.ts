import { DatabaseEngine } from "@mirrordb/database";

export const getForkQueueName = (engine: DatabaseEngine) => {
    switch (engine) {
        case DatabaseEngine.POSTGRES:
            return "fork-postgres";
        case DatabaseEngine.MYSQL:
            return "fork-mysql";
        case DatabaseEngine.MONGODB:
            return "fork-mongodb";
        default:
            throw new Error(`Unsupported engine: ${engine}`);
    }
}

export const getCleanupQueueName = (engine: DatabaseEngine) => {
    switch (engine) {
        case DatabaseEngine.POSTGRES:
            return "cleanup-postgres";
        case DatabaseEngine.MYSQL:
            return "cleanup-mysql";
        case DatabaseEngine.MONGODB:
            return "cleanup-mongodb";
        default:
            throw new Error(`Unsupported engine: ${engine}`);
    }
}
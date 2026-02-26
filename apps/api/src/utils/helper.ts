import { DatabaseEngine } from "@mirrordb/database";

export const getJobType = (engine: DatabaseEngine) => {
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
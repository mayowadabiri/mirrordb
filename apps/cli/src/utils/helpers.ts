import { DatabaseEngine } from "@mirrordb/types";

export function normalizeEnum(value?: string) {
    return value?.toUpperCase();
}

export const getDbEngineName = (engine: DatabaseEngine) => {
    switch (engine) {
        case DatabaseEngine.POSTGRES:
            return "PostgreSQL";
        case DatabaseEngine.MONGODB:
            return "MongoDB";
        case DatabaseEngine.MYSQL:
            return "MySQL";
        default:
            return "Unknown";
    }
}

export const getDbEngineUriPrefix = (engine: DatabaseEngine) => {
    switch (engine) {
        case DatabaseEngine.POSTGRES:
            return "postgresql://";
        case DatabaseEngine.MONGODB:
            return "mongodb://";
        case DatabaseEngine.MYSQL:
            return "mysql://";
        default:
            return "";
    }
}

export const getDbEngineValidUriPrefixes = (engine: DatabaseEngine): string[] => {
    switch (engine) {
        case DatabaseEngine.POSTGRES:
            return ["postgresql://", "postgres://"];
        case DatabaseEngine.MONGODB:
            return ["mongodb://", "mongodb+srv://"];
        case DatabaseEngine.MYSQL:
            return ["mysql://"];
        default:
            return [];
    }
}

export const getDbEngineDefaultPort = (engine: DatabaseEngine) => {
    switch (engine) {
        case DatabaseEngine.POSTGRES:
            return 5432;
        case DatabaseEngine.MONGODB:
            return 27017;
        case DatabaseEngine.MYSQL:
            return 3306;
        default:
            return 5432;
    }
}
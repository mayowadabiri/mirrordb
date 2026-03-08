import { DatabaseClone, DatabaseEngine, DatabaseStatus, PrismaClient, User } from "@mirrordb/database";
import { AddDbPayload, DbCredentialsMethod, DbCredentialsPayload } from "@mirrordb/types";
import { BadRequestError } from "../../utils/appError";
import { Client } from "pg"
import { encrypt, validateMongoConnection, validatePgConnection } from "@mirrordb/utils";
import { validateMySqlConnection, parseMongoUri } from "../../utils/dbConnector";
import { prisma } from "../../lib/prisma";
import { forkQueue } from "@mirrordb/queue";
import { getForkQueueName } from "../../utils/helper";



export const addDatabase = async (prisma: PrismaClient, user: User, body: AddDbPayload) => {

    const db = await prisma.database.findUnique({
        where: {
            ownerUserId_name: {
                ownerUserId: user.id,
                name: body.name
            }
        }
    })

    if (db) {
        throw new BadRequestError("Database already exists", {
            code: "DATABASE_NAME_EXISTS"
        });
    }

    const database = await prisma.database.create({
        data: {
            name: body.name,
            ownerUserId: user.id,
            environment: body.environment,
            description: body.description,
            engine: body.engine
        }
    })

    return database;

}

export const listDatabases = async (prisma: PrismaClient, user: User) => {
    const databases = await prisma.database.findMany({
        where: {
            ownerUserId: user.id
        }
    })
    return databases;
}

export const getDatabase = async (prisma: PrismaClient, user: User, value: string) => {
    const database = await prisma.database.findFirst({
        where: {
            ownerUserId: user.id,
            OR: [
                { id: value },
                { name: value }
            ]
        }
    })
    if (!database) {
        throw new BadRequestError("Database not found", {
            code: "DATABASE_NOT_FOUND"
        });
    }
    return database;
}


export const connectDatabase = async (
    prisma: PrismaClient,
    body: DbCredentialsPayload,
    id: string,
    userId: string
) => {
    const database = await prisma.database.findFirst({
        where: {
            id,
            ownerUserId: userId,
        },
    });

    if (!database) {
        throw new BadRequestError("Database not found", {
            code: "DATABASE_NOT_FOUND",
        });
    }


    if (body.method === DbCredentialsMethod.URI) {
        const creds = body

        if (database.engine === DatabaseEngine.POSTGRES) {
            const client = new Client({
                connectionString: creds.uri,
                connectionTimeoutMillis: 5_000,
                query_timeout: 5_000,
            })
            await validatePgConnection(client)
        } else if (database.engine === DatabaseEngine.MONGODB) {
            const parsedUri = parseMongoUri(creds.uri);
            if (!parsedUri.database) {
                throw new BadRequestError("Database name is required in MongoDB URI", {
                    code: "MONGODB_URI_DATABASE_REQUIRED"
                });
            }
            const collections = await validateMongoConnection(creds.uri, parsedUri.database)
            if (collections.length === 0) {
                throw new BadRequestError("No collections found in MongoDB database", {
                    code: "MONGODB_NO_COLLECTIONS"
                });
            }
        } else if (database.engine === DatabaseEngine.MYSQL) {
            await validateMySqlConnection({ uri: creds.uri })
        }

    } else {
        if (database.engine === DatabaseEngine.POSTGRES) {
            const creds = body
            const client = new Client({
                host: creds.host,
                port: creds.port,
                user: creds.username,
                password: creds.password,
                database: creds.database,
                connectionTimeoutMillis: 5_000,
                query_timeout: 5_000,
            });

            await validatePgConnection(client)
        } else if (database.engine === DatabaseEngine.MYSQL) {
            const creds = body
            await validateMySqlConnection({
                host: creds.host,
                port: creds.port,
                user: creds.username,
                password: creds.password,
                database: creds.database,
            })
        }

    }

    const { method: _method, ...credentialPayload } = body;
    const encryptedPayload = encrypt(JSON.stringify(credentialPayload));
    const rotationTime = new Date();

    return prisma.$transaction(async (tx) => {
        await tx.databaseCredential.updateMany({
            where: {
                databaseId: database.id,
                isActive: true,
            },
            data: {
                isActive: false,
                rotatedAt: rotationTime,
            },
        });

        await tx.database.update({
            where: { id: database.id },
            data: {
                status: DatabaseStatus.CONNECTED,
                connectedAt: rotationTime,
            },
        });

        await tx.databaseCredential.create({
            data: {
                databaseId: database.id,
                type: body.method,
                encryptedPayload,
                isActive: true,
            },
        });

        return {
            databaseId: database.id,
            name: database.name
        };
    });
};


export const forkDatabase = async (prisma: PrismaClient, id: string, userId: string) => {
    const sourceDb = await prisma.database.findUnique({
        where: {
            id,
            ownerUserId: userId,
        },
    });

    if (!sourceDb) {
        throw new BadRequestError("Database not found", {
            code: "DATABASE_NOT_FOUND",
        });
    }

    const credentials = await prisma.databaseCredential.findFirst({
        where: {
            databaseId: id,
            isActive: true,
        },
    });

    if (!credentials) {
        throw new BadRequestError("Database credentials not found", {
            code: "DATABASE_CREDENTIALS_NOT_FOUND",
        });
    }

    const cloneId = await prisma.$transaction(async (tx) => {
        const forkedDb = await tx.forkedDatabase.create({
            data: {
                name: `fork_${Date.now()}`,
                sourceDatabaseId: sourceDb.id,
                ownerUserId: userId,
            },
        });

        await tx.forkedDatabase.update({
            where: {
                id: forkedDb.id
            },
            data: {
                name: `fork_${sourceDb.name}_${forkedDb.id.slice(0, 8)}`,
            }
        })

        const cloned = await tx.databaseClone.create({
            data: {
                sourceDatabaseId: sourceDb.id,
                forkedDatabaseId: forkedDb.id,
                status: "PENDING",
            },
        });

        return cloned.id;
    });

    const forkType = getForkQueueName(sourceDb.engine);

    await forkQueue.add(forkType, {
        cloneId: cloneId,
    }, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: false,
    })

    return {
        cloneId,
    }

}


export const updateForkedDatabase = async (databaseId: string, payload: object) => {

    await prisma.forkedDatabase.update({
        where: {
            id: databaseId
        },
        data: {
            ...payload
        }
    })
}


export const updateDatabaseCloneStatus = async (cloneId: string, payload: DatabaseClone) => {
    await prisma.databaseClone.update({
        where: {
            id: cloneId
        },
        data: {
            ...payload
        }
    })
}


export const cancelClone = async (prisma: PrismaClient, cloneId: string) => {
    const clone = await prisma.databaseClone.findUnique({
        where: { id: cloneId },
        include: {
            forkedDatabase: true
        }
    });

    if (!clone) {
        throw new BadRequestError("Clone not found", {
            code: "CLONE_NOT_FOUND",
        });
    }

    if (
        clone.status === "COMPLETED" ||
        clone.status === "FAILED" ||
        clone.status === "CANCELLED"
    ) {
        throw new BadRequestError("Clone already finished", {
            code: "CLONE_ALREADY_FINISHED",
        });
    }

    await prisma.databaseClone.update({
        where: { id: cloneId },
        data: {
            status: "CANCELLING",
            cancelledAt: new Date()
        }
    });

    return clone;
}



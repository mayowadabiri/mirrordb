import { DatabaseEngine, DatabaseStatus, PrismaClient, User } from "../../../generated/prisma";
import { AddDbPayload, DbCredentialsMethod, DbCredentialsPayload } from "@mirrordb/types";
import type { HostDbCredentials as _HostDbCredentials, UriDbCredentials as _UriDbCredentials } from "@mirrordb/types";
import { BadRequestError } from "../../utils/appError";
import { Client } from "pg"
import { encrypt } from "../../utils/security";
import { validateMongoConnection, validatePgConnection, validateMySqlConnection } from "../../utils/dbConnector";


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
            console.log(creds.uri)
            await validateMongoConnection(creds.uri)
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
            const creds = body as HostDbCredentials
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
                type: "PASSWORD",
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

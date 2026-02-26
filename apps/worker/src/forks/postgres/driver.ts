import { Client } from "pg";
import { prisma } from "@mirrordb/database";
import { decrypt, encrypt, neon, sanitizeDatabaseName, validatePgConnection } from "@mirrordb/utils";
import { streamDumpAndRestore } from "./actions";


class PostgresDriver {
    cloneId: string;
    forkedDatabaseId: string;
    sourceDbId: string;
    private client!: Client
    private connectionUri!: string;

    constructor(cloneId: string, forkedDatabaseId: string, sourceDbId: string) {
        this.cloneId = cloneId;
        this.forkedDatabaseId = forkedDatabaseId;
        this.sourceDbId = sourceDbId;
    }


    private async getSourceClient() {
        const credentials = await prisma.databaseCredential.findFirstOrThrow({
            where: { databaseId: this.sourceDbId, isActive: true }
        })
        const decryptedCredentials = decrypt(credentials.encryptedPayload);
        const parsedCredentials = JSON.parse(decryptedCredentials);
        const client = new Client({
            host: parsedCredentials.host,
            port: parsedCredentials.port,
            user: parsedCredentials.username,
            password: parsedCredentials.password,
            database: parsedCredentials.database,
            connectionTimeoutMillis: 5_000,
            query_timeout: 5_000,
        });
        await validatePgConnection(client)
        this.client = client;
    }

    private async createTargetRole() {
        const sourceDb = await prisma.database.findUniqueOrThrow({
            where: { id: this.sourceDbId }
        })
        try {
            const roleExist = await neon.getExistingRole(sourceDb.ownerUserId).catch(() => null);
            console.log("Role existence check result:", roleExist);
            if (roleExist) {
                return roleExist;
            }
            const response = await neon.createRole(sourceDb.ownerUserId);
            return response.data;
        } catch {
            return {
                role: {
                    name: sourceDb.ownerUserId
                }
            }
        }
    }

    private async initializeTargetDb() {
        const result = await this.createTargetRole();
        const targetDb = await prisma.forkedDatabase.findUniqueOrThrow({
            where: { id: this.forkedDatabaseId }
        })
        const payload = {
            database: {
                name: sanitizeDatabaseName(targetDb.id, targetDb.name),
                owner_name: result.role.name,
            }
        }
        const response = await neon.createDatabase(payload);
        const database = response.data.database;
        const operations = response.data.operations;

        const params = {
            branch_id: database.branch_id,
            endpoint_id: operations[0].endpoint_id,
            database_name: database.name,
            role_name: database.owner_name,
        }

        const connectionInfo = await neon.getConnectionUri(params);
        this.connectionUri = connectionInfo.uri;
        const encryptedPayload = encrypt(JSON.stringify(connectionInfo));
        await prisma.forkedDatabase.update({
            where: { id: this.forkedDatabaseId },
            data: {
                encryptedPayload
            }
        })
    }

    private async mirrorData() {

        const { host, port, user, password, database } = this.client;
        if (!user || !password || !database) {
            throw new Error("Source database client is missing required connection fields");
        }
        const source = { host, port, user, password, database };

        await streamDumpAndRestore({
            source,
            targetUri: this.connectionUri,
            onLog: (msg) => console.log(msg),
        });
        await prisma.databaseClone.update({
            where: { id: this.cloneId },
            data: {
                status: "COMPLETED",
                completedAt: new Date()
            }
        })

    }

    async cleanUp() {
        const clone = await prisma.databaseClone.findUnique({
            where: { id: this.cloneId }
        });
        if (clone?.status === "CANCELLING") {
            await this.deleteDatabase();
            await prisma.databaseClone.update({
                where: { id: this.cloneId },
                data: {
                    status: "CANCELLED",
                    completedAt: new Date()
                }
            })
        }
    }

    async deleteDatabase() {
        const targetDb = await prisma.forkedDatabase.findUniqueOrThrow({
            where: { id: this.forkedDatabaseId }
        });
        const targetDbName = sanitizeDatabaseName(targetDb.id, targetDb.name);
        await neon.deleteDatabase(targetDbName);
    }

    async fork() {
        await this.getSourceClient();
        await this.initializeTargetDb();
        await this.cleanUp()
        await this.mirrorData();
        await this.cleanUp()
    }

}

export default PostgresDriver;
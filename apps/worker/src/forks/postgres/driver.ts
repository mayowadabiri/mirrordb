import { Client } from "pg";
import { prisma } from "@mirrordb/database";
import { decrypt, neon, sanitizeDatabaseName, validatePgConnection } from "@mirrordb/utils";
import { streamDumpAndRestore } from "./actions";
import { encryptPayload } from "../../utils/cloneDb";
import { checkAborted } from "../../utils/cancellationMonitor";
import type { IForkDriver } from "../types";


class PostgresDriver implements IForkDriver {
    cloneId: string;
    forkedDatabaseId: string;
    sourceDbId: string;
    private client!: Client;
    private connectionUri!: string;
    private signal: AbortSignal;
    private targetDbCreated = false;

    constructor(
        cloneId: string,
        forkedDatabaseId: string,
        sourceDbId: string,
        signal: AbortSignal,
    ) {
        this.cloneId = cloneId;
        this.forkedDatabaseId = forkedDatabaseId;
        this.sourceDbId = sourceDbId;
        this.signal = signal;
    }


    private async getSourceClient() {
        const credentials = await prisma.databaseCredential.findFirstOrThrow({
            where: { databaseId: this.sourceDbId, isActive: true }
        });
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
        await validatePgConnection(client);
        this.client = client;
    }

    private async createTargetRole() {
        const sourceDb = await prisma.database.findUniqueOrThrow({
            where: { id: this.sourceDbId }
        });
        const user = `user_${sourceDb.ownerUserId}`;
        try {
            const roleExist = await neon.getExistingRole(user)
            if (roleExist) {
                return roleExist;
            }
            const response = await neon.createRole(user);
            return response.data;
        } catch {
            return {
                role: {
                    name: user
                }
            };
        }

    }

    private async initializeTargetDb() {
        const result = await this.createTargetRole();
        const targetDb = await prisma.forkedDatabase.findUniqueOrThrow({
            where: { id: this.forkedDatabaseId }
        });
        const payload = {
            database: {
                name: `fork_${targetDb.id}`,
                owner_name: result.role.name,
            }
        };
        const response = await neon.createDatabase(payload);
        this.targetDbCreated = true;
        const database = response.data.database;
        const operations = response.data.operations;

        const params = {
            branch_id: database.branch_id,
            endpoint_id: operations[0].endpoint_id,
            database_name: database.name,
            role_name: database.owner_name,
        };

        const connectionInfo = await neon.getConnectionUri(params);
        this.connectionUri = connectionInfo.uri;
        await encryptPayload(connectionInfo.uri, this.forkedDatabaseId);
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
            signal: this.signal,
            onLog: () => { },
        });
    }


    async cancel() {
        try {
            if (this.targetDbCreated) {
                await this.deleteDatabase().catch(() => { });
            }
        } catch {
            // Cleanup is best-effort
        }
        try {
            if (this.client) {
                await this.client.end().catch(() => { /* ignore */ });
            }
        } catch {
            /* ignore */
        }
    }

    async deleteDatabase() {
        const targetDb = await prisma.forkedDatabase.findUniqueOrThrow({
            where: { id: this.forkedDatabaseId }
        });
        const targetDbName = sanitizeDatabaseName(targetDb.name);
        await neon.deleteDatabase(targetDbName);
    }

    async fork() {
        await this.getSourceClient();

        checkAborted(this.signal, this.cloneId);

        await this.initializeTargetDb();

        checkAborted(this.signal, this.cloneId);

        await this.mirrorData();
    }
}

export default PostgresDriver;
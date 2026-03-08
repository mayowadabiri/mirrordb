import { Client } from "pg";
import { prisma } from "@mirrordb/database";
import { decrypt, neon, sanitizeDatabaseName, validatePgConnection } from "@mirrordb/utils";
import { streamDumpAndRestore } from "./actions";
import { encryptPayload } from "../../utils/cloneDb";
import { checkAborted } from "../../utils/cancellationMonitor";
import type { IForkDriver } from "../types";


class PostgresDriver implements IForkDriver {
    cloneId: string;
    targetDatabaseId: string;
    sourceDatabaseId: string;
    private client!: Client;
    private connectionUri!: string;
    private signal: AbortSignal;
    private targetDbCreated = false;
    private targetDbName!: string;

    constructor(
        cloneId: string,
        targetDatabaseId: string,
        sourceDatabaseId: string,
        signal: AbortSignal,
    ) {
        this.cloneId = cloneId;
        this.targetDatabaseId = targetDatabaseId;
        this.sourceDatabaseId = sourceDatabaseId;
        this.signal = signal;
    }

    private async resolveTargetDbName() {
        if (this.targetDbName) return;
        const forkedDb = await prisma.forkedDatabase.findUniqueOrThrow({
            where: { id: this.targetDatabaseId }
        });
        this.targetDbName = sanitizeDatabaseName(forkedDb.name, 38);
    }

    private async getSourceClient() {
        const credentials = await prisma.databaseCredential.findFirstOrThrow({
            where: { databaseId: this.sourceDatabaseId, isActive: true }
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
        const user = `user_${this.targetDatabaseId}`;
        try {
            const response = await neon.createRole(user);
            return response.data;
        } catch (error) {
            console.log(error);
            return {
                role: {
                    name: user
                }
            };
        }

    }

    private async initializeTargetDb() {
        const result = await this.createTargetRole();

        const payload = {
            database: {
                name: this.targetDbName,
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
        await encryptPayload(connectionInfo.uri, this.targetDatabaseId);
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
        await neon.deleteDatabase(this.targetDbName);
        await neon.deleteRoleName(`user_${this.targetDatabaseId}`);

    }

    async fork() {
        await this.resolveTargetDbName();
        await this.getSourceClient();

        checkAborted(this.signal, this.cloneId);

        await this.initializeTargetDb();

        checkAborted(this.signal, this.cloneId);

        await this.mirrorData();
    }
}

export default PostgresDriver;
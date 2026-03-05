import { prisma } from "@mirrordb/database";
import { decrypt, sanitizeDatabaseName, validateMongoConnection } from "@mirrordb/utils";
import { generateStrongPassword } from "../../utils/security";
import { buildMongoUri, createDatabaseUser, deleteDatabaseUser, dropMongoDatabase, forkMongoDatabase } from "./actions";
import { encryptPayload } from "../../utils/cloneDb";
import { checkAborted } from "../../utils/cancellationMonitor";
import type { IForkDriver } from "../types";

async function waitForMongoAuth(uri: string, retries = 5, delayMs = 3000): Promise<void> {
    for (let i = 1; i <= retries; i++) {
        try {
            await validateMongoConnection(uri);
            return;
        } catch (err) {
            if (i === retries) throw err;
            await new Promise((r) => setTimeout(r, delayMs * Math.pow(2, i - 1)));
        }
    }
}

class MongoDbDriver implements IForkDriver {
    cloneId: string;
    targetDatabaseId: string;
    sourceDatabaseId: string;
    private connectionUri!: string;
    private signal: AbortSignal;
    private targetDbCreated = false;
    private atlasUsername: string | null = null;
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

    private async getSourceUri() {
        const credentials = await prisma.databaseCredential.findFirstOrThrow({
            where: {
                databaseId: this.sourceDatabaseId,
                isActive: true,
            },
        });
        const decryptedCredentials = decrypt(credentials.encryptedPayload);
        const parsedCredentials = JSON.parse(decryptedCredentials);
        await validateMongoConnection(parsedCredentials.uri);
        return parsedCredentials.uri;
    }

    private async getTargetUri() {
        const clusterUri = process.env.MONGODB_CLUSTER_URI;
        const url = new URL(clusterUri!);
        url.pathname = `/${this.targetDbName}`;
        this.connectionUri = url.toString();
        return this.connectionUri;
    }

    private async dumpAndRestore() {
        const sourceUri = await this.getSourceUri();

        checkAborted(this.signal, this.cloneId);

        const targetUri = await this.getTargetUri();
        this.targetDbCreated = true;

        checkAborted(this.signal, this.cloneId);

        await forkMongoDatabase({
            sourceUri,
            targetUri,
            signal: this.signal,
        });

        await validateMongoConnection(targetUri);
    }

    private async assignDbToUser() {
        checkAborted(this.signal, this.cloneId);

        const username = `user_${this.targetDatabaseId}`;
        const password = generateStrongPassword();
        const dbName = this.targetDbName;
        await createDatabaseUser(username, password, dbName);
        this.atlasUsername = username;
        const targetUri = buildMongoUri(username, password, dbName);
        await waitForMongoAuth(targetUri);
        await encryptPayload(targetUri, this.targetDatabaseId);
    }


    async cancel() {
        try {
            if (this.atlasUsername) {
                await deleteDatabaseUser(this.atlasUsername)
            }
            if (this.targetDbCreated) {
                await dropMongoDatabase(this.targetDbName)
            }
        } catch {
            // Cleanup is best-effort
        }
    }

    async fork() {
        await this.resolveTargetDbName();
        await this.dumpAndRestore();
        await this.assignDbToUser();
    }
}

export default MongoDbDriver;

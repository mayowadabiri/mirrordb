import { Client } from "pg";
import { CloneStatus, Database, DatabaseClone, ForkedDatabase } from "../../generated/prisma";
// import { Client } from "pg"
import { prisma } from "../lib/prisma";
import { decrypt, encrypt } from "../utils/security";
import neon from "../utils/neon";
import { streamDumpAndRestore } from "./actions";
import { assertTablesExist, validatePgConnection } from "../utils/dbConnector";
import { updateDatabaseCloneStatus, updateForkedDatabase } from "../services/db";
// import { streamDumpAndRestore } from "./actions";

class PostgresDriver {
    sourceDb: Database;
    targetDb: ForkedDatabase;
    cloneId: string;
    private sourceDbClient!: Client;
    private targetDbClient!: Client;
    private targetConnectionUri!: string;


    // private targetDbClient!: Client;
    constructor(sourceDb: Database, targetDb: ForkedDatabase, cloneId: string) {
        this.sourceDb = sourceDb;
        this.targetDb = targetDb;
        this.cloneId = cloneId;
    }

    async initializeSourceDb() {
        // Implement connection logic here
        const dbCredentials = await prisma.databaseCredential.findFirst({
            where: { databaseId: this.sourceDb.id, isActive: true }
        })

        if (!dbCredentials) {
            throw new Error("No active credentials found for source database");
        }

        const decryptedCredentials = decrypt(dbCredentials.encryptedPayload);
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

        this.sourceDbClient = client;
    }

    private async createTargetRole() {
        const payload = {
            role: {
                name: this.sourceDb.ownerUserId
            }
        }
        const response = await neon.createRole(payload);
        return response.data;
    }

    async initializeTargetDb() {
        // await this.createTargetRole();
        const payload = {
            database: {
                name: `${this.targetDb.id}_${this.targetDb.name}`,
                owner_name: this.sourceDb.ownerUserId
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
        this.targetConnectionUri = connectionInfo.uri;
        const client = new Client({
            connectionString: this.targetConnectionUri,
            connectionTimeoutMillis: 5_000,
            query_timeout: 5_000,
        });
        this.targetDbClient = client;
        // Don't validate connection here - we need to keep the client for later use
        // Connection will be validated when assertTablesExist connects to it
        const encryptedPayload = encrypt(JSON.stringify(connectionInfo));
        await updateForkedDatabase(this.targetDb.id, {
            encryptedPayload
        })
    }


    async dumpAndRestore() {
        const source = {
            host: this.sourceDbClient.host,
            port: this.sourceDbClient.port,
            user: this.sourceDbClient.user,
            password: this.sourceDbClient.password,
            database: this.sourceDbClient.database,
        }

        const params = {
            source: source,
            targetUri: this.targetConnectionUri,
            onLog: (msg: string) => {
                console.log(msg)
            }
        }
        console.log("Starting dump and restore")
        await streamDumpAndRestore(params as any)
        console.log("Dump and restore completed")

        await assertTablesExist(this.targetDbClient)
        console.log("Tables asserted")
        await updateDatabaseCloneStatus(this.cloneId, {
            status: CloneStatus.COMPLETED
        } as DatabaseClone)

    }



    // async disconnect() {
    //     if (this.sourceDbClient) await this.sourceDbClient.end();
    //     if (this.targetDbClient) await this.targetDbClient.end();
    // }
}

export default PostgresDriver;
import net from "net";
import { DatabaseClone, ForkedDatabase, Database } from "@mirrordb/database";
import { DbCredentialsMethod } from "@mirrordb/types";

export interface TunnelParams {
    clone: DatabaseClone & {
        forkedDatabase: ForkedDatabase | null;
        sourceDatabase: Database;
    };
    emit: (event: string, payload?: any) => void;
    isSessionAlive: () => boolean;
    credentialType: DbCredentialsMethod;
}

export async function getFreePort(): Promise<number> {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.listen(0, "127.0.0.1", () => {
            const address = server.address();
            if (!address || typeof address === "string") {
                reject(new Error("Failed to allocate port"));
                return;
            }
            const port = address.port;
            server.close(() => resolve(port));
        });
        server.on("error", reject);
    });
}

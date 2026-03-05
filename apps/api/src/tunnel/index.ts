import { DatabaseEngine } from "@mirrordb/database";
import { TunnelParams } from "./helpers";
import { postgresTunnel } from "./postgres";
import { mongodbTunnel } from "./mongodb";

export type { TunnelParams };

export async function tunnelOrchestrator(params: TunnelParams) {
    const engine = params.clone.sourceDatabase.engine;

    switch (engine) {
        case DatabaseEngine.POSTGRES:
            return postgresTunnel(params);
        case DatabaseEngine.MONGODB:
            return mongodbTunnel(params);
        default:
            throw new Error(`Tunneling is not supported for ${engine} databases`);
    }
}

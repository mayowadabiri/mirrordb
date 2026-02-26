import 'fastify';
import { User, AuthAccount } from '@mirrordb/database';

declare module 'fastify' {
    interface FastifyRequest {

        user: User & {
            accounts: AuthAccount[];
        };

        deviceId: string;
    }
}

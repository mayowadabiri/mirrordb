import 'fastify';
import { User, Account } from '../../generated/prisma';

declare module 'fastify' {
    interface FastifyRequest {

        user: User & {
            accounts: Account[];
        };

        deviceId: string;
    }
}

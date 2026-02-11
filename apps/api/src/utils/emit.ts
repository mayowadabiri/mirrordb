import { Writable } from "node:stream";

export type EmitFn = (event: string, payload: unknown) => void;

export function createEmitter(res: Writable): EmitFn {
    return (event: string, payload: unknown) => {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };
}
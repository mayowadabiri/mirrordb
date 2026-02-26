import path from "node:path";
import { MirrorConfig } from "@mirrordb/types";
import { CONFIG_FILE, CONFIG_DIR } from "./path.js";
import fs from "node:fs";
import crypto from "node:crypto";

const KEY_FILE = path.join(CONFIG_DIR, ".key");

function getOrCreateEncryptionKey(): Buffer {
    if (fs.existsSync(KEY_FILE)) {
        const keyHex = fs.readFileSync(KEY_FILE, "utf-8").trim();
        const key = Buffer.from(keyHex, "hex");
        if (key.length === 32) return key;
    }
    const key = crypto.randomBytes(32);
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    fs.writeFileSync(KEY_FILE, key.toString("hex"), { mode: 0o600 });
    return key;
}

function encryptField(value: string, key: Buffer): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

function isEncrypted(value: string): boolean {
    const parts = value.split(":");
    return parts.length === 3 && parts.every(p => /^[0-9a-f]+$/i.test(p));
}

function decryptField(value: string, key: Buffer): string {
    if (!isEncrypted(value)) return value; // legacy plaintext token
    const [ivHex, authTagHex, dataHex] = value.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const data = Buffer.from(dataHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export const readConfig = (): MirrorConfig | null => {
    if (!fs.existsSync(CONFIG_FILE)) return null;
    const raw = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
    if (!raw.session) return raw;
    const key = getOrCreateEncryptionKey();
    return {
        ...raw,
        session: {
            ...raw.session,
            accessToken: decryptField(raw.session.accessToken, key),
            refreshToken: decryptField(raw.session.refreshToken, key),
        },
    };
};

export const writeConfig = (config: MirrorConfig) => {
    fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
    const key = getOrCreateEncryptionKey();
    const stored = {
        ...config,
        session: {
            ...config.session,
            accessToken: encryptField(config.session.accessToken, key),
            refreshToken: encryptField(config.session.refreshToken, key),
        },
    };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(stored, null, 2), { mode: 0o600 });
};
import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
    const key = process.env.MFA_ENCRYPTION_KEY;
    if (!key) {
        throw new Error("MFA_ENCRYPTION_KEY environment variable is required");
    }
    return Buffer.from(key, "hex");
}

export function encrypt(text: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);

    const encrypted = Buffer.concat([
        cipher.update(text, "utf8"),
        cipher.final(),
    ]);

    const tag = cipher.getAuthTag();

    return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decrypt(payload: string): string {
    const buffer = Buffer.from(payload, "base64");

    const iv = buffer.subarray(0, 12);
    const tag = buffer.subarray(12, 28);
    const encrypted = buffer.subarray(28);

    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
    decipher.setAuthTag(tag);

    return decipher.update(encrypted, undefined, "utf8") + decipher.final("utf8");
}
import crypto from "crypto";

/**
 * Generates a strong random password for MongoDB users.
 * - Default length: 32
 * - URL-safe
 * - High entropy
 */
export function generateStrongPassword(length = 32): string {
    return crypto
        .randomBytes(length)
        .toString("base64")
        .replace(/[+/=]/g, "") // remove non-url-safe chars
        .slice(0, length);
}
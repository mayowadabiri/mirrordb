import crypto, { randomBytes, randomUUID } from "crypto";
import bcrypt from "bcrypt";
import jwt, { SignOptions } from "jsonwebtoken";
import speakeasy from "speakeasy";

const SECRET = process.env.CODE_HASH_SECRET;
if (!SECRET) {
  throw new Error("CODE_HASH_SECRET environment variable is required");
}

const JWT_SECRET = process.env.JWT_SECRET;

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN as SignOptions["expiresIn"];

export const generateDeviceCode = () => randomUUID();

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateUserCode() {
  const bytes = randomBytes(8);
  const chars = Array.from(bytes).map((b) => ALPHABET[b % ALPHABET.length]);
  return `${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}`;
}

/**
 * Hash a value (e.g., user code, device code, etc.)
 * @param value - The plain text value to hash
 * @returns Promise<string> - The hashed value
 */

export function hashUserCode(code: string) {
  return crypto.createHmac("sha256", SECRET!).update(code).digest("hex");
}

/**
 * Generate a device auth token (JWT)
 */

export function generateJWT(payload: object): string {
  return jwt.sign(payload, JWT_SECRET!, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verify and decode a device auth token
 */
export function verifyJWT(token: string): object | null {
  try {
    return jwt.verify(token, JWT_SECRET!) as object;
  } catch {
    return null;
  }
}

export function generateTotpSecret() {
  const secret = speakeasy.generateSecret({
    length: 20,
  });

  return {
    base32: secret.base32,
    otpauthUrl: secret.otpauth_url,
  };
}

export function verifyTotpToken(secretBase32: string, token: string) {
  return speakeasy.totp.verify({
    secret: secretBase32,
    encoding: "base32",
    token,
  });
}

const ALGORITHM = "aes-256-gcm";
const KEY = Buffer.from(process.env.MFA_ENCRYPTION_KEY!, "hex");

export function encrypt(text: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);

  const encrypted = Buffer.concat([
    cipher.update(text, "utf8"),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decrypt(payload: string) {
  const buffer = Buffer.from(payload, "base64");

  const iv = buffer.subarray(0, 12);
  const tag = buffer.subarray(12, 28);
  const encrypted = buffer.subarray(28);

  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(tag);

  return decipher.update(encrypted, undefined, "utf8") + decipher.final("utf8");
}

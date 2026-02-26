import { randomBytes, randomUUID } from "crypto";
import crypto from "crypto";
import jwt, { SignOptions } from "jsonwebtoken";
import speakeasy from "speakeasy";

const SECRET = process.env.CODE_HASH_SECRET;
if (!SECRET) {
  throw new Error("CODE_HASH_SECRET environment variable is required");
}

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN as SignOptions["expiresIn"];

export const generateDeviceCode = () => randomUUID();

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const REJECTION_BOUND = 256 - (256 % ALPHABET.length);

export function generateUserCode(): string {
  const chars: string[] = [];
  while (chars.length < 8) {
    const byte = randomBytes(1)[0];
    if (byte < REJECTION_BOUND) {
      chars.push(ALPHABET[byte % ALPHABET.length]);
    }
  }
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


import crypto from "node:crypto";
import { config } from "./config";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const key = Buffer.from(config.encryptionKey, "base64");
  if (key.length !== 32) {
    throw new Error(
      `ASSISTANT_ENCRYPTION_KEY must be 32 bytes (base64), got ${key.length} bytes`,
    );
  }
  return key;
}

/** AES-256-GCM: returns base64(iv[12] | authTag[16] | ciphertext). */
export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

export function decryptSecret(encoded: string): string {
  const raw = Buffer.from(encoded, "base64");
  if (raw.length < 12 + 16) throw new Error("Malformed encrypted secret");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

/** Last 4 characters, for display only. */
export function apiKeyHint(apiKey: string): string {
  const trimmed = apiKey.trim();
  return trimmed.length <= 4 ? "****" : `…${trimmed.slice(-4)}`;
}

export function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

import crypto from "crypto";

/**
 * Symmetric encryption for third-party OAuth tokens kept at rest.
 *
 * A Google refresh token is a long-lived credential: whoever reads it can act on
 * the user's calendar. Unlike our own session tokens it cannot be hashed — we
 * have to send it back to Google — so it is stored encrypted with AES-256-GCM
 * (confidentiality + integrity) under a key that lives only in the environment:
 *
 *   GOOGLE_TOKEN_ENCRYPTION_KEY = 32 random bytes, base64 or hex
 *   (generate: `openssl rand -base64 32`)
 *
 * Stored format: `v1:<iv b64>:<auth tag b64>:<ciphertext b64>`. The version
 * prefix lets the key or algorithm rotate later without guessing.
 */

const ALGORITHM = "aes-256-gcm";
const VERSION = "v1";

function loadKey() {
  const raw = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  if (!raw) return null;
  const trimmed = raw.trim();
  const key = /^[0-9a-f]{64}$/i.test(trimmed)
    ? Buffer.from(trimmed, "hex")
    : Buffer.from(trimmed, "base64");
  return key.length === 32 ? key : null;
}

/** True when a usable 32-byte key is configured. */
export function isTokenEncryptionConfigured() {
  return loadKey() !== null;
}

export function encryptToken(plaintext) {
  if (plaintext === null || plaintext === undefined || plaintext === "") return null;
  const key = loadKey();
  if (!key) throw new Error("GOOGLE_TOKEN_ENCRYPTION_KEY is missing or not 32 bytes");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64"), tag.toString("base64"), ciphertext.toString("base64")].join(":");
}

export function decryptToken(stored) {
  if (!stored) return null;
  const key = loadKey();
  if (!key) throw new Error("GOOGLE_TOKEN_ENCRYPTION_KEY is missing or not 32 bytes");
  const [version, ivB64, tagB64, dataB64] = String(stored).split(":");
  if (version !== VERSION || !ivB64 || !tagB64 || dataB64 === undefined) {
    throw new Error("Unrecognised encrypted token format");
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

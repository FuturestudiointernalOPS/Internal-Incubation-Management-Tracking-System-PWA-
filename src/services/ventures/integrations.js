/**
 * VENTURE PUBLIC APIs — API KEYS & WEBHOOKS.
 *
 * The API keys (mint with the one-time secret, list, revoke, rotate) and the
 * webhooks (create with the HTTPS/event guards, list, delete) with their
 * delivery logs. Every mutation writes an audit event.
 *
 * The decisions — the key id/secret/hash generation, the HTTPS + event guards
 * and the audit calls — live here; every statement is in
 * `@/models/ventureIntegrationsStore`. Nothing here runs SQL.
 *
 * This module used to be re-exported through `@/lib/ventures`; that barrel is
 * gone (CH-4) and importers read this module directly. See docs/LAYER_SPLIT.md.
 */

import crypto from "crypto";
import {
  insertApiKey,
  selectApiKeys,
  selectActiveApiKey,
  revokeApiKeyRow,
  updateApiKeyHash,
  insertWebhook,
  selectWebhooks,
  selectWebhookById,
  deleteWebhookRow,
  selectWebhookDeliveryLogs,
} from "@/models/ventureIntegrationsStore";
import { logAuditEvent } from "@/services/ventures/auditSecurity";

const API_KEY_PREFIX = "IMP";

// ─── API Keys ───────────────────────────────────────────────────────────────────────────

function generateApiKeyId() {
  const suffix = crypto.randomBytes(6).toString("hex").toUpperCase();
  return `${API_KEY_PREFIX}-${suffix}`;
}

function generateApiKeySecret() {
  return `sk-${crypto.randomBytes(24).toString("hex")}`;
}

function hashApiKey(secret) {
  return crypto.createHash("sha256").update(secret).digest("hex");
}

export async function createApiKey({ name, description, scopes, expiresAt, allowedIps, rateLimit, createdBy }) {
  const keyId = generateApiKeyId();
  const secret = generateApiKeySecret();
  const keyHash = hashApiKey(secret);

  if (!scopes || scopes.length === 0) throw new Error("At least one scope is required.");

  const id = (await insertApiKey(keyId, keyHash, name.trim(), description||null, JSON.stringify(scopes), createdBy, expiresAt||null, JSON.stringify(allowedIps||[]), rateLimit||100)).rows[0]?.id;

  await logAuditEvent({
    eventType: "API_KEY_CREATED", actorCid: createdBy,
    entityType: "api_key", entityId: keyId,
    description: `API key created: ${name}`,
    severity: "info",
  });

  // Return the secret ONCE — it will never be shown again
  return { id, key_id: keyId, secret, name };
}

export async function getApiKeys({ createdBy, isActive, limit=50, offset=0 } = {}) {
  return (await selectApiKeys({ createdBy, isActive, limit, offset })).rows || [];
}

export async function revokeApiKey(keyId, revokedBy) {
  const key = (await selectActiveApiKey(keyId)).rows[0];
  if (!key) throw new Error("API key not found or already revoked.");
  await revokeApiKeyRow(keyId);
  await logAuditEvent({
    eventType: "API_KEY_REVOKED", actorCid: revokedBy,
    entityType: "api_key", entityId: keyId,
    description: `API key revoked: ${key.name}`,
    severity: "warning",
  });
  return { success: true };
}

export async function rotateApiKey(keyId, _rotatedBy) {
  const key = (await selectActiveApiKey(keyId)).rows[0];
  if (!key) throw new Error("API key not found or inactive.");
  const newSecret = generateApiKeySecret();
  const newHash = hashApiKey(newSecret);
  await updateApiKeyHash(keyId, newHash);
  return { key_id: keyId, secret: newSecret };
}

// ─── API Usage Logging & Rate Limiting ──────────────────────────────────────

// ─── Webhooks ───────────────────────────────────────────────────────────────

export async function createWebhook({ name, url, secret, events, ventureId, retryCount, timeoutMs, createdBy }) {
  if (!url || !url.startsWith("https://")) throw new Error("Webhook URL must use HTTPS.");
  if (!events || events.length === 0) throw new Error("At least one event is required.");

  const id = (await insertWebhook(name.trim(), url, secret||null, JSON.stringify(events), ventureId||null, retryCount||3, timeoutMs||10000, createdBy||"system")).rows[0]?.id;

  await logAuditEvent({
    eventType: "WEBHOOK_CREATED", actorCid: createdBy,
    entityType: "webhook", entityId: String(id),
    description: `Webhook created: ${name} → ${url}`,
    severity: "info",
  });

  return { id };
}

export async function getWebhooks({ ventureId, event, isActive, limit=50, offset=0 } = {}) {
  return (await selectWebhooks({ ventureId, event, isActive, limit, offset })).rows || [];
}

export async function deleteWebhook(id, _deletedBy) {
  const webhook = (await selectWebhookById(id)).rows[0];
  if (!webhook) throw new Error("Webhook not found.");
  await deleteWebhookRow(id);
  return { success: true };
}

// ─── Webhook Delivery Logs ──────────────────────────────────────────────────

export async function getWebhookDeliveryLogs(webhookId, { limit=50, offset=0, status } = {}) {
  return (await selectWebhookDeliveryLogs(webhookId, { limit, offset, status })).rows || [];
}

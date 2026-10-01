/**
 * Venture external integrations & public APIs — statements (REPOSITORY layer).
 *
 * The data access behind `@/services/ventures/integrations`: the integration
 * providers/configs, the API keys and the webhooks with their delivery logs.
 *
 * SQL is byte-identical to what used to sit inline in `src/lib/ventures.js`.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement, no
 * decisions.
 */

import db from "@/lib/db";

// ── Integrations ─────────────────────────────────────────────────────────────

/** The available integration providers, by name. */
export function selectIntegrationProviders() {
  return db.execute({ sql: "SELECT * FROM integration_providers WHERE is_available=TRUE ORDER BY name" });
}

/** Integration configs with their provider info (optional filters). */
export function selectIntegrations({ ventureId, provider, status, limit, offset } = {}) {
  let sql = "SELECT ic.*, ip.name as provider_name, ip.description as provider_description, ip.icon as provider_icon FROM integration_configs ic LEFT JOIN integration_providers ip ON ic.provider=ip.provider_key WHERE 1=1";
  const args = [];
  if (ventureId) { sql += " AND ic.venture_id=?"; args.push(ventureId); }
  if (provider) { sql += " AND ic.provider=?"; args.push(provider); }
  if (status) { sql += " AND ic.status=?"; args.push(status); }
  sql += " ORDER BY ic.created_at DESC LIMIT ? OFFSET ?"; args.push(limit, offset);
  return db.execute({ sql, args });
}

/** The id of an available provider. */
export function selectAvailableProvider(provider) {
  return db.execute({ sql: "SELECT id FROM integration_providers WHERE provider_key=? AND is_available=TRUE", args: [provider] });
}

/** Insert one integration config, returning its id. */
export function insertIntegration(provider, label, ventureId, configJson, createdBy) {
  return db.execute({
    sql: `INSERT INTO integration_configs (provider, label, venture_id, config, status, created_by) VALUES (?, ?, ?, ?::jsonb, 'connected', ?) RETURNING id`,
    args: [provider, label, ventureId, configJson, createdBy],
  });
}

/** Apply a computed SET list to an integration config. */
export function updateIntegrationColumns(sets, args) {
  return db.execute({ sql: `UPDATE integration_configs SET ${sets.join(",")} WHERE id=?`, args });
}

/** One integration config row. */
export function selectIntegrationById(id) {
  return db.execute({ sql: "SELECT * FROM integration_configs WHERE id=?", args: [id] });
}

/** Delete one integration config. */
export function deleteIntegrationRow(id) {
  return db.execute({ sql: "DELETE FROM integration_configs WHERE id=?", args: [id] });
}

// ── API keys ─────────────────────────────────────────────────────────────────

/** Insert one API key, returning its id. */
export function insertApiKey(keyId, keyHash, name, description, scopesJson, createdBy, expiresAt, allowedIpsJson, rateLimit) {
  return db.execute({
    sql: `INSERT INTO api_keys (key_id, key_hash, name, description, scopes, created_by, expires_at, allowed_ips, rate_limit) VALUES (?, ?, ?, ?, ?::jsonb, ?, ?, ?::jsonb, ?) RETURNING id`,
    args: [keyId, keyHash, name, description, scopesJson, createdBy, expiresAt, allowedIpsJson, rateLimit],
  });
}

/** API keys (optional filters), newest first. */
export function selectApiKeys({ createdBy, isActive, limit, offset } = {}) {
  let sql = "SELECT id, key_id, name, description, scopes, created_by, expires_at, last_used_at, is_active, rate_limit, created_at, updated_at FROM api_keys WHERE 1=1";
  const args = [];
  if (createdBy) { sql += " AND created_by=?"; args.push(createdBy); }
  if (isActive !== undefined) { sql += " AND is_active=?"; args.push(isActive ? 1 : 0); }
  sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?"; args.push(limit, offset);
  return db.execute({ sql, args });
}

/** One active API key row by key id. */
export function selectActiveApiKey(keyId) {
  return db.execute({ sql: "SELECT * FROM api_keys WHERE key_id=? AND is_active=TRUE", args: [keyId] });
}

/** Mark an API key revoked. */
export function revokeApiKeyRow(keyId) {
  return db.execute({ sql: "UPDATE api_keys SET is_active=FALSE, updated_at=NOW() WHERE key_id=?", args: [keyId] });
}

/** Replace an API key's secret hash. */
export function updateApiKeyHash(keyId, newHash) {
  return db.execute({ sql: "UPDATE api_keys SET key_hash=?, updated_at=NOW() WHERE key_id=?", args: [newHash, keyId] });
}

// ── Webhooks ─────────────────────────────────────────────────────────────────

/** Insert one webhook, returning its id. */
export function insertWebhook(name, url, secret, eventsJson, ventureId, retryCount, timeoutMs, createdBy) {
  return db.execute({
    sql: `INSERT INTO webhooks (name, url, secret, events, venture_id, retry_count, timeout_ms, created_by) VALUES (?, ?, ?, ?::jsonb, ?, ?, ?, ?) RETURNING id`,
    args: [name, url, secret, eventsJson, ventureId, retryCount, timeoutMs, createdBy],
  });
}

/** Webhooks (optional filters), newest first. */
export function selectWebhooks({ ventureId, event, isActive, limit, offset } = {}) {
  let sql = "SELECT * FROM webhooks WHERE 1=1";
  const args = [];
  if (ventureId) { sql += " AND venture_id=?"; args.push(ventureId); }
  if (event) { sql += " AND events::jsonb @> ?::jsonb"; args.push(JSON.stringify([event])); }
  if (isActive !== undefined) { sql += " AND is_active=?"; args.push(isActive ? 1 : 0); }
  sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?"; args.push(limit, offset);
  return db.execute({ sql, args });
}

/** One webhook row. */
export function selectWebhookById(id) {
  return db.execute({ sql: "SELECT * FROM webhooks WHERE id=?", args: [id] });
}

/** Delete one webhook. */
export function deleteWebhookRow(id) {
  return db.execute({ sql: "DELETE FROM webhooks WHERE id=?", args: [id] });
}

/** The delivery logs of a webhook (optional status filter), newest first. */
export function selectWebhookDeliveryLogs(webhookId, { limit, offset, status } = {}) {
  let sql = "SELECT * FROM webhook_delivery_logs WHERE webhook_id=?";
  const args = [webhookId];
  if (status) { sql += " AND status=?"; args.push(status); }
  sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?"; args.push(limit, offset);
  return db.execute({ sql, args });
}

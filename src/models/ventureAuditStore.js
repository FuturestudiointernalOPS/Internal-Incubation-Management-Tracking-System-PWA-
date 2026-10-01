/**
 * Venture audit logs, security and sessions — statements (REPOSITORY layer).
 *
 * The data access behind `@/services/ventures/auditSecurity`: the append-only
 * audit log, the security events, the user sessions and the login history.
 *
 * SQL is byte-identical to what used to sit inline in `src/lib/ventures.js`.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement, no
 * decisions.
 */

import db from "@/lib/db";

// ── Audit log ────────────────────────────────────────────────────────────────

/** Append one audit-log row, returning its id. */
export function insertAuditLog({
  eventType, actorCid, actorName, actorRole, ventureId, entityType, entityId,
  description, metadataJson, ipAddress, userAgent, sessionId, severity,
}) {
  return db.execute({
    sql: `INSERT INTO venture_audit_logs (event_type, actor_cid, actor_name, actor_role, venture_id, entity_type, entity_id, description, metadata, ip_address, user_agent, session_id, severity)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?, ?, ?) RETURNING id`,
    args: [eventType, actorCid, actorName, actorRole, ventureId, entityType, entityId, description, metadataJson, ipAddress, userAgent, sessionId, severity],
  });
}

/** Audit-log rows (optional filters), newest first. */
export function selectAuditLogs({ eventType, actorCid, ventureId, entityType, entityId, severity, limit, offset, fromDate, toDate } = {}) {
  let sql = "SELECT * FROM venture_audit_logs WHERE 1=1";
  const args = [];
  if (eventType) { sql += " AND event_type=?"; args.push(eventType); }
  if (actorCid) { sql += " AND actor_cid=?"; args.push(actorCid); }
  if (ventureId) { sql += " AND venture_id=?"; args.push(ventureId); }
  if (entityType) { sql += " AND entity_type=?"; args.push(entityType); }
  if (entityId) { sql += " AND entity_id=?"; args.push(entityId); }
  if (severity) { sql += " AND severity=?"; args.push(severity); }
  if (fromDate) { sql += " AND created_at >= ?"; args.push(fromDate); }
  if (toDate) { sql += " AND created_at <= ?"; args.push(toDate); }
  sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
  args.push(limit, offset);
  return db.execute({ sql, args });
}

/** One audit-log row. */
export function selectAuditLogById(id) {
  return db.execute({ sql: "SELECT * FROM venture_audit_logs WHERE id=?", args: [id] });
}

/** Count audit-log rows in the window. */
export function countAuditLogs(hoursAgo) {
  return db.execute({ sql: "SELECT COUNT(*) as c FROM venture_audit_logs WHERE created_at > NOW() - INTERVAL '1 hour' * ?", args: [hoursAgo] });
}

/** Audit-log counts grouped by severity in the window. */
export function selectAuditLogsBySeverity(hoursAgo) {
  return db.execute({ sql: "SELECT severity, COUNT(*) as c FROM venture_audit_logs WHERE created_at > NOW() - INTERVAL '1 hour' * ? GROUP BY severity", args: [hoursAgo] });
}

/** The top audit-log event types in the window. */
export function selectAuditLogsByType(hoursAgo) {
  return db.execute({ sql: "SELECT event_type, COUNT(*) as c FROM venture_audit_logs WHERE created_at > NOW() - INTERVAL '1 hour' * ? GROUP BY event_type ORDER BY c DESC LIMIT 10", args: [hoursAgo] });
}

// ── Security events ──────────────────────────────────────────────────────────

/** Security-event rows (optional filters), newest first. */
export function selectSecurityEvents({ eventType, actorCid, severity, isResolved, limit, offset, fromDate, toDate } = {}) {
  let sql = "SELECT * FROM venture_security_events WHERE 1=1";
  const args = [];
  if (eventType) { sql += " AND event_type=?"; args.push(eventType); }
  if (actorCid) { sql += " AND actor_cid=?"; args.push(actorCid); }
  if (severity) { sql += " AND severity=?"; args.push(severity); }
  if (isResolved !== undefined) { sql += " AND is_resolved=?"; args.push(isResolved ? 1 : 0); }
  if (fromDate) { sql += " AND created_at >= ?"; args.push(fromDate); }
  if (toDate) { sql += " AND created_at <= ?"; args.push(toDate); }
  sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
  args.push(limit, offset);
  return db.execute({ sql, args });
}

/** Resolve one security event. */
export function resolveSecurityEventRow(eventId, resolvedBy, notes) {
  return db.execute({
    sql: "UPDATE venture_security_events SET is_resolved=TRUE, resolved_by=?, resolved_at=NOW(), resolution_notes=? WHERE id=? AND NOT is_resolved",
    args: [resolvedBy, notes, eventId],
  });
}

/** Count security events in the window. */
export function countSecurityEvents(hoursAgo) {
  return db.execute({ sql: "SELECT COUNT(*) as c FROM venture_security_events WHERE created_at > NOW() - INTERVAL '1 hour' * ?", args: [hoursAgo] });
}

/** Count unresolved security events in the window. */
export function countUnresolvedSecurityEvents(hoursAgo) {
  return db.execute({ sql: "SELECT COUNT(*) as c FROM venture_security_events WHERE is_resolved=FALSE AND created_at > NOW() - INTERVAL '1 hour' * ?", args: [hoursAgo] });
}

/** Count critical security events in the window. */
export function countCriticalSecurityEvents(hoursAgo) {
  return db.execute({ sql: "SELECT COUNT(*) as c FROM venture_security_events WHERE severity='critical' AND created_at > NOW() - INTERVAL '1 hour' * ?", args: [hoursAgo] });
}

/** Security-event counts grouped by type in the window. */
export function selectSecurityEventsByType(hoursAgo) {
  return db.execute({ sql: "SELECT event_type, COUNT(*) as c FROM venture_security_events WHERE created_at > NOW() - INTERVAL '1 hour' * ? GROUP BY event_type ORDER BY c DESC", args: [hoursAgo] });
}

// ── Sessions ─────────────────────────────────────────────────────────────────

/** Active sessions with user info (optional user filter), newest first. */
export function selectActiveSessions({ userCid, limit, offset } = {}) {
  let sql = `SELECT s.*, c.name as user_name, c.email as user_email
             FROM user_sessions s
             LEFT JOIN contacts c ON s.user_cid = c.cid
             WHERE s.expires_at > NOW()`;
  const args = [];
  if (userCid) { sql += " AND s.user_cid=?"; args.push(userCid); }
  sql += " ORDER BY s.created_at DESC LIMIT ? OFFSET ?";
  args.push(limit, offset);
  return db.execute({ sql, args });
}

/** An active session matched by token hash or raw token. */
export function selectSessionByToken(tokenHash, sessionToken) {
  return db.execute({ sql: "SELECT * FROM user_sessions WHERE expires_at > NOW() AND (token_hash = ? OR token = ?)", args: [tokenHash, sessionToken] });
}

/** Revoke a session matched by token hash or raw token. */
export function revokeSessionByToken(tokenHash, sessionToken) {
  return db.execute({ sql: "UPDATE user_sessions SET expires_at=NOW(), logout_time=NOW(), session_status='revoked' WHERE token_hash = ? OR token = ?", args: [tokenHash, sessionToken] });
}

/** A user's other active sessions (for a bulk revoke). */
export function selectUserSessionsToRevoke(userCid, exceptToken) {
  return db.execute({
    sql: "SELECT * FROM user_sessions WHERE user_cid=? AND token!=? AND expires_at > NOW()",
    args: [userCid, exceptToken],
  });
}

/** Revoke a user's other active sessions. */
export function revokeUserSessionsRows(userCid, exceptToken) {
  return db.execute({
    sql: "UPDATE user_sessions SET expires_at=NOW(), logout_time=NOW(), session_status='revoked' WHERE user_cid=? AND token!=? AND expires_at > NOW()",
    args: [userCid, exceptToken],
  });
}

// ── Login history ────────────────────────────────────────────────────────────

/** Login-history rows (optional filters), newest first. */
export function selectLoginHistory({ userCid, action, isSuccess, limit, offset, fromDate, toDate } = {}) {
  let sql = "SELECT * FROM venture_login_history WHERE 1=1";
  const args = [];
  if (userCid) { sql += " AND user_cid=?"; args.push(userCid); }
  if (action) { sql += " AND action=?"; args.push(action); }
  if (isSuccess !== undefined) { sql += " AND is_success=?"; args.push(isSuccess ? 1 : 0); }
  if (fromDate) { sql += " AND created_at >= ?"; args.push(fromDate); }
  if (toDate) { sql += " AND created_at <= ?"; args.push(toDate); }
  sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
  args.push(limit, offset);
  return db.execute({ sql, args });
}

/** Count login-history rows in the window. */
export function countLogins(hoursAgo) {
  return db.execute({ sql: "SELECT COUNT(*) as c FROM venture_login_history WHERE created_at > NOW() - INTERVAL '1 hour' * ?", args: [hoursAgo] });
}

/** Count successful logins in the window. */
export function countSuccessfulLogins(hoursAgo) {
  return db.execute({ sql: "SELECT COUNT(*) as c FROM venture_login_history WHERE is_success=TRUE AND created_at > NOW() - INTERVAL '1 hour' * ?", args: [hoursAgo] });
}

/** Count failed logins in the window. */
export function countFailedLogins(hoursAgo) {
  return db.execute({ sql: "SELECT COUNT(*) as c FROM venture_login_history WHERE is_success=FALSE AND created_at > NOW() - INTERVAL '1 hour' * ?", args: [hoursAgo] });
}

/** Count distinct users in the window. */
export function countUniqueLoginUsers(hoursAgo) {
  return db.execute({ sql: "SELECT COUNT(DISTINCT user_cid) as c FROM venture_login_history WHERE created_at > NOW() - INTERVAL '1 hour' * ?", args: [hoursAgo] });
}

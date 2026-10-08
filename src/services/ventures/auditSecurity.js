/**
 * VENTURE AUDIT LOGS, SECURITY AND SESSIONS.
 *
 * The append-only audit log (write with a safe failure, filtered query, stats),
 * the security events (query, resolve, stats), the admin session management
 * (list, revoke one, bulk revoke) and the login history (query, stats).
 *
 * The decisions — the filters, the token hashing, the non-blocking audit write
 * and the login-stat shaping — live here; every statement is in
 * `@/models/ventureAuditStore`. Nothing here runs SQL.
 *
 * This module used to be re-exported through `@/lib/ventures`; that barrel is
 * gone (CH-4) and importers read this module directly. See docs/LAYER_SPLIT.md.
 */

import {
  insertAuditLog,
  selectAuditLogs,
  selectAuditLogById,
  countAuditLogs,
  selectAuditLogsBySeverity,
  selectAuditLogsByType,
  selectSecurityEvents,
  resolveSecurityEventRow,
  countSecurityEvents,
  countUnresolvedSecurityEvents,
  countCriticalSecurityEvents,
  selectSecurityEventsByType,
  selectActiveSessions,
  selectSessionByToken,
  revokeSessionByToken,
  selectUserSessionsToRevoke,
  revokeUserSessionsRows,
  selectLoginHistory,
  countLogins,
  countSuccessfulLogins,
  countFailedLogins,
  countUniqueLoginUsers,
} from "@/models/ventureAuditStore";
import { hashToken } from "@/lib/token-hashing";

/**
 * Log an audit event (immutable, append-only).
 */
export async function logAuditEvent({ eventType, actorCid, actorName, actorRole, ventureId, entityType, entityId, description, metadata, ipAddress, userAgent, sessionId, severity }) {
  try {
    const id = (await insertAuditLog({
      eventType, actorCid, actorName: actorName||null, actorRole: actorRole||null, ventureId: ventureId||null,
      entityType: entityType||null, entityId: entityId||null, description: description||null,
      metadataJson: JSON.stringify(metadata||{}),
      ipAddress: ipAddress||null, userAgent: userAgent||null, sessionId: sessionId||null, severity: severity||"info",
    })).rows[0]?.id;
    return { id };
  } catch (error) {
    console.error("Audit log error:", error.message);
    return null;
  }
}

/**
 * Query audit logs with filtering and pagination.
 */
export async function queryAuditLogs({ eventType, actorCid, ventureId, entityType, entityId, severity, limit=50, offset=0, fromDate, toDate } = {}) {
  return (await selectAuditLogs({ eventType, actorCid, ventureId, entityType, entityId, severity, limit, offset, fromDate, toDate })).rows || [];
}

/**
 * Get a single audit log entry.
 */
export async function getAuditLog(id) {
  return (await selectAuditLogById(id)).rows[0] || null;
}

/**
 * Get audit log count for stats.
 */
export async function getAuditLogStats(hoursAgo = 24) {
  const [total, bySeverity, byType] = await Promise.all([
    countAuditLogs(hoursAgo).catch(() => ({ rows: [{ c: 0 }] })),
    selectAuditLogsBySeverity(hoursAgo).catch(() => ({ rows: [] })),
    selectAuditLogsByType(hoursAgo).catch(() => ({ rows: [] })),
  ]);
  return {
    total: parseInt(total.rows[0]?.c || 0),
    by_severity: bySeverity.rows || [],
    by_type: byType.rows || [],
  };
}

// ─── Security Events ────────────────────────────────────────────────────────

/**
 * Query security events with filtering and pagination.
 */
export async function querySecurityEvents({ eventType, actorCid, severity, isResolved, limit=50, offset=0, fromDate, toDate } = {}) {
  return (await selectSecurityEvents({ eventType, actorCid, severity, isResolved, limit, offset, fromDate, toDate })).rows || [];
}

/**
 * Resolve a security event.
 */
export async function resolveSecurityEvent(eventId, resolvedBy, notes) {
  await resolveSecurityEventRow(eventId, resolvedBy, notes||null);
  return { success: true };
}

/**
 * Get security event stats.
 */
export async function getSecurityStats(hoursAgo = 24) {
  const [total, unresolved, critical, byType] = await Promise.all([
    countSecurityEvents(hoursAgo).catch(() => ({ rows: [{ c: 0 }] })),
    countUnresolvedSecurityEvents(hoursAgo).catch(() => ({ rows: [{ c: 0 }] })),
    countCriticalSecurityEvents(hoursAgo).catch(() => ({ rows: [{ c: 0 }] })),
    selectSecurityEventsByType(hoursAgo).catch(() => ({ rows: [] })),
  ]);
  return {
    total: parseInt(total.rows[0]?.c || 0),
    unresolved: parseInt(unresolved.rows[0]?.c || 0),
    critical: parseInt(critical.rows[0]?.c || 0),
    by_type: byType.rows || [],
  };
}

// ─── Session Management ──────────────────────────────────────────────────────

/**
 * Get all active sessions with user info.
 */
export async function getActiveSessions({ userCid, limit=50, offset=0 } = {}) {
  return (await selectActiveSessions({ userCid, limit, offset })).rows || [];
}

/**
 * Revoke a specific session.
 */
export async function revokeSession(sessionToken, revokedBy) {
  const tokenHash = hashToken(sessionToken);
  const session = (await selectSessionByToken(tokenHash, sessionToken)).rows[0];
  if (!session) return { success: false, error: "Session not found or already expired" };
  await revokeSessionByToken(tokenHash, sessionToken);
  // Log the revocation
  await logAuditEvent({
    eventType: "SESSION_REVOKED", actorCid: revokedBy, actorName: null,
    entityType: "session", entityId: sessionToken.substring(0, 8),
    description: `Session revoked for user ${session.user_cid}`,
    severity: "warning",
  });
  return { success: true };
}

/**
 * Revoke all sessions for a user except current one.
 */
export async function revokeUserSessions(userCid, exceptToken, revokedBy) {
  const sessions = (await selectUserSessionsToRevoke(userCid, exceptToken)).rows || [];
  await revokeUserSessionsRows(userCid, exceptToken);
  for (const session of sessions) {
    await logAuditEvent({
      eventType: "SESSION_REVOKED", actorCid: revokedBy,
      entityType: "session", entityId: session.token.substring(0, 8),
      description: `Bulk revoked session for user ${userCid}`,
      severity: "info",
    });
  }
  return { success: true, count: sessions.length };
}

// ─── Login History ──────────────────────────────────────────────────────────

/**
 * Query login history with filtering and pagination.
 */
export async function queryLoginHistory({ userCid, action, isSuccess, limit=50, offset=0, fromDate, toDate } = {}) {
  return (await selectLoginHistory({ userCid, action, isSuccess, limit, offset, fromDate, toDate })).rows || [];
}

/**
 * Get login stats (success/failure counts).
 */
export async function getLoginStats(hoursAgo = 24) {
  const [total, successes, failures, unique] = await Promise.all([
    countLogins(hoursAgo).catch(() => ({ rows: [{ c: 0 }] })),
    countSuccessfulLogins(hoursAgo).catch(() => ({ rows: [{ c: 0 }] })),
    countFailedLogins(hoursAgo).catch(() => ({ rows: [{ c: 0 }] })),
    countUniqueLoginUsers(hoursAgo).catch(() => ({ rows: [{ c: 0 }] })),
  ]);
  const successCount = parseInt(successes.rows[0]?.c || 0);
  const failureCount = parseInt(failures.rows[0]?.c || 0);
  return {
    total: parseInt(total.rows[0]?.c || 0),
    successes: successCount,
    failures: failureCount,
    unique_users: parseInt(unique.rows[0]?.c || 0),
    // The admin Security console's "Login Success"/"Login Failures" cards read
    // these names; without them the cards stayed at a permanent zero.
    login_successes: successCount,
    login_failures: failureCount,
  };
}

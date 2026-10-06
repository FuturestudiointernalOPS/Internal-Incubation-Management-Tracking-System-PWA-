import db from "@/lib/db";

// ── Session versioning ───────────────────────────────────────────────────────

/** Full current v2_sessions row — snapshot source before an update. */
export async function getSessionRowById(sessionId) {
  return db.execute({
    sql: "SELECT * FROM v2_sessions WHERE id = ?",
    args: [sessionId],
  });
}

/** Record one pre-update snapshot into the version history. */
export async function insertSessionVersion(sessionId, version, snapshot, changedBy) {
  return db.execute({
    sql: "INSERT INTO v2_session_versions (session_id, version, snapshot, changed_by) VALUES (?, ?, ?::jsonb, ?)",
    args: [sessionId, version, snapshot, changedBy],
  });
}

/** Advance the session's live `version` counter after a snapshot. */
export async function setSessionVersion(version, sessionId) {
  return db.execute({
    sql: "UPDATE v2_sessions SET version = ? WHERE id = ?",
    args: [version, sessionId],
  });
}

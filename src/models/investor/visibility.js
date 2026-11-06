import db from "@/lib/db";

// ── Phase 2 — investor visibility mode ───────────────────────────────────────

/** The visibility mode of one investor profile. */
export async function selectVisibilityMode(investorId) {
  return db.execute({
    sql: "SELECT visibility_mode FROM investor_profiles WHERE id = ?",
    args: [investorId],
  });
}

/** Set the visibility mode (studio-controlled, never the investor). */
export async function updateVisibilityMode(investorId, mode) {
  return db.transaction(async query => {
    await query("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");
    await query("SELECT id FROM investor_profiles WHERE id = ? FOR UPDATE", [investorId]);
    const previous = await query("SELECT visibility_mode FROM investor_profiles WHERE id = ?", [investorId]);
    const result = await query(
      `UPDATE investor_profiles SET visibility_mode = ?, updated_at = NOW()
       WHERE id = ? RETURNING id, visibility_mode`, [mode, investorId],
    );
    return { ...result, previousMode: previous.rows[0]?.visibility_mode ?? null };
  });
}

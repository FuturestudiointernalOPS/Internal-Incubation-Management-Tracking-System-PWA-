import db from "@/lib/db";

// ── Studio capital (F metrics) — read-only ───────────────────────────────────

/** Financing events with their date, so first round vs follow-on can be split. */
export async function selectFinancingEventsDetailed() {
  return db.execute({
    sql: `SELECT venture_uuid, event_date, amount_mode, amount_value, amount_band, financing_type
            FROM venture_event_log
           WHERE event_type = 'financing_received' AND deleted_at IS NULL
           ORDER BY venture_uuid, event_date ASC, created_at ASC`,
    args: [],
  });
}

export async function selectVenturesCreatedAt() {
  return db.execute({
    sql: "SELECT id::text AS venture_uuid, venture_id AS code, created_at FROM ventures",
    args: [],
  });
}

/** Capital recorded by THIS module (investments confirmed on the investor side). */
export async function selectPlatformInvestmentsTotal() {
  return db.execute({
    sql: `SELECT COALESCE(SUM(amount), 0)::float AS total, COUNT(*)::int AS count
            FROM investor_investments`,
    args: [],
  });
}

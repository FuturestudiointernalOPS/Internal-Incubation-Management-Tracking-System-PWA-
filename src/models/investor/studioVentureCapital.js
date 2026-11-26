import db from "@/lib/db";

// ── Studio capital inputs — valuation / ownership / exits ────────────────────

export async function upsertStudioVentureCapital({
  ventureId,
  studioCapitalInvested,
  valuation,
  valuationCurrency,
  ownershipPct,
  realizedProceeds,
  cashDistributed,
  exited,
  asOf,
  updatedBy,
}) {
  return db.execute({
    sql: `INSERT INTO studio_venture_capital
            (venture_id, studio_capital_invested, valuation, valuation_currency, ownership_pct,
             realized_proceeds, cash_distributed, exited, as_of, updated_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (venture_id) DO UPDATE
            SET studio_capital_invested = COALESCE(EXCLUDED.studio_capital_invested, studio_venture_capital.studio_capital_invested),
                valuation = COALESCE(EXCLUDED.valuation, studio_venture_capital.valuation),
                valuation_currency = COALESCE(EXCLUDED.valuation_currency, studio_venture_capital.valuation_currency),
                ownership_pct = COALESCE(EXCLUDED.ownership_pct, studio_venture_capital.ownership_pct),
                realized_proceeds = COALESCE(EXCLUDED.realized_proceeds, studio_venture_capital.realized_proceeds),
                cash_distributed = COALESCE(EXCLUDED.cash_distributed, studio_venture_capital.cash_distributed),
                exited = COALESCE(EXCLUDED.exited, studio_venture_capital.exited),
                as_of = COALESCE(EXCLUDED.as_of, studio_venture_capital.as_of),
                updated_by = EXCLUDED.updated_by,
                updated_at = NOW()
          RETURNING *`,
    args: [
      String(ventureId),
      studioCapitalInvested ?? null,
      valuation ?? null,
      valuationCurrency ?? null,
      ownershipPct ?? null,
      realizedProceeds ?? null,
      cashDistributed ?? null,
      exited === undefined ? null : Boolean(exited),
      asOf ?? null,
      updatedBy ?? null,
    ],
  });
}

export async function listStudioVentureCapital() {
  return db.execute({
    sql: "SELECT * FROM studio_venture_capital ORDER BY updated_at DESC",
    args: [],
  });
}

export async function getStudioVentureCapital(ventureId) {
  return db.execute({
    sql: "SELECT * FROM studio_venture_capital WHERE venture_id = ?",
    args: [String(ventureId)],
  });
}

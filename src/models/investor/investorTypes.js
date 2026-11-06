import db from "@/lib/db";

export async function listInvestorTypes({ activeOnly = true } = {}) {
  return db.execute({
    sql: `SELECT id, name_en, name_fr, active, sort_order
            FROM investor_types
           WHERE (? = false OR active = true)
           ORDER BY sort_order ASC, id ASC`,
    args: [activeOnly],
  });
}

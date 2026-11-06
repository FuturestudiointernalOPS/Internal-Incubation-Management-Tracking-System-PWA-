import db from "@/lib/db";

export async function listDeclineReasons({ appliesTo, activeOnly = true } = {}) {
  const args = [];
  let where = "WHERE 1=1";
  if (appliesTo) {
    where += " AND applies_to = ?";
    args.push(appliesTo);
  }
  if (activeOnly) {
    where += " AND active = true";
  }
  return db.execute({
    sql: `SELECT id, applies_to, name_en, name_fr, active, sort_order
            FROM investor_decline_reasons
            ${where}
           ORDER BY sort_order ASC, id ASC`,
    args,
  });
}

export async function getDeclineReasonById(id) {
  return db.execute({
    sql: "SELECT * FROM investor_decline_reasons WHERE id = ?",
    args: [id],
  });
}

export async function insertDeclineReason({ appliesTo, nameEn, nameFr, sortOrder = 0 }) {
  return db.execute({
    sql: `INSERT INTO investor_decline_reasons (applies_to, name_en, name_fr, sort_order, active)
          VALUES (?, ?, ?, ?, true)
          RETURNING *`,
    args: [appliesTo, nameEn, nameFr, sortOrder],
  });
}

export async function updateDeclineReason({ id, nameEn = null, nameFr = null, active = null, sortOrder = null }) {
  return db.execute({
    sql: `UPDATE investor_decline_reasons
             SET name_en = COALESCE(?, name_en),
                 name_fr = COALESCE(?, name_fr),
                 active = COALESCE(?, active),
                 sort_order = COALESCE(?, sort_order),
                 updated_at = NOW()
           WHERE id = ?
           RETURNING *`,
    args: [nameEn, nameFr, active, sortOrder, id],
  });
}

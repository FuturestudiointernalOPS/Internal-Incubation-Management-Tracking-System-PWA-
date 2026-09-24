import db from "@/lib/db";
import {
  BUILT_IN_DOCUMENT_TYPE_CODES,
  DEFAULT_VENTURE_DOCUMENT_TYPES,
  DOCUMENT_VERIFICATION_METHODS,
  slugifyDocumentTypeCode,
} from "@/lib/ventureDocumentTypeDefaults";

/**
 * VENTURE DOCUMENT TYPES — the documents the Data bank asks ONE Venture for.
 *
 * The list belongs to the VENTURE: a Super Admin, or the Lead Manager of that
 * Venture, defines it, and only that Venture's Data bank changes. The set used
 * to be six hardcoded categories copied in three places (the founder screen, the
 * reviewer screen and the code that generated the per-Venture items).
 *
 * Every Venture starts with the six built-in categories, seeded here the first
 * time its list is needed, keeping the SAME `code`s the Data bank already
 * stored — so existing per-Venture items and uploaded documents keep matching.
 *
 * A built-in type cannot be deleted (it is turned off instead), because its code
 * is what past documents were filed under.
 *
 * `venture_id` is the Venture's public code (`VNT-…`), the same value
 * `venture_verifications.venture_id` holds, so the whole Data bank is keyed the
 * same way.
 */

/**
 * Create the table. The database layer already runs each CREATE at most once per
 * process, so this is cheap; `database` is injectable for tests.
 */
const preparedDatabases = new WeakSet();

export async function ensureVentureDocumentTypesTable(database = db) {
  if (preparedDatabases.has(database)) return;

  await database.execute({
    sql: `CREATE TABLE IF NOT EXISTS venture_document_types (
      id SERIAL PRIMARY KEY,
      venture_id TEXT NOT NULL REFERENCES ventures(venture_id) ON DELETE CASCADE,
      code TEXT NOT NULL,
      label_en TEXT NOT NULL,
      label_fr TEXT,
      description TEXT,
      required BOOLEAN NOT NULL DEFAULT TRUE,
      verification_method TEXT NOT NULL DEFAULT 'upload',
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_by TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(venture_id, code)
    )`,
    args: [],
  });

  await database.execute({
    sql: `CREATE INDEX IF NOT EXISTS idx_venture_document_types_venture
            ON venture_document_types(venture_id, is_active, sort_order)`,
    args: [],
  });

  preparedDatabases.add(database);
}

/**
 * Give a Venture the six built-in categories when it has none yet — and leave an
 * edited list alone from then on. Called on both the read and the write path, so
 * a Venture created before this feature, and one created after it, end up with
 * the same starting point.
 */
export async function ensureVentureDocumentTypesForVenture(ventureId, database = db) {
  if (!ventureId) return;

  await ensureVentureDocumentTypesTable(database);

  const counted = await database.execute({
    sql: "SELECT COUNT(*) AS n FROM venture_document_types WHERE venture_id = ?",
    args: [ventureId],
  });
  if (Number(counted.rows?.[0]?.n || 0) > 0) return;

  const seeds = DEFAULT_VENTURE_DOCUMENT_TYPES;
  const values = seeds.map(() => "(?, ?, ?, ?, ?, ?, ?, TRUE)").join(", ");
  const args = seeds.flatMap((seed) => [
    ventureId,
    seed.code,
    seed.label_en,
    seed.label_fr,
    seed.required ? 1 : 0,
    seed.verification_method,
    seed.sort_order,
  ]);

  await database.execute({
    sql: `INSERT INTO venture_document_types
            (venture_id, code, label_en, label_fr, required, verification_method, sort_order, is_active)
          VALUES ${values}`,
    args,
  });
}

/** One Venture's document types, in the order the Data bank must show them. */
export async function listVentureDocumentTypes({ ventureId, includeInactive = false, database = db } = {}) {
  if (!ventureId) return [];
  const result = await database.execute({
    sql: `SELECT id, venture_id, code, label_en, label_fr, description, required,
                 verification_method, sort_order, is_active, created_at, updated_at
          FROM venture_document_types
          WHERE venture_id = ? AND (? = 1 OR is_active = TRUE)
          ORDER BY sort_order ASC, id ASC`,
    args: [ventureId, includeInactive ? 1 : 0],
  });
  return result.rows || [];
}

/**
 * One Venture's active types, or the built-in seed when the rows cannot be read
 * (a database that predates the table). The Data bank must never render empty
 * just because the configuration could not be loaded.
 */
export async function listActiveVentureDocumentTypesOrDefaults(ventureId, database = db) {
  try {
    await ensureVentureDocumentTypesForVenture(ventureId, database);
    const rows = await listVentureDocumentTypes({ ventureId, database });
    if (rows.length > 0) return rows;
  } catch (_) {
    /* fall through to the built-in set */
  }
  return DEFAULT_VENTURE_DOCUMENT_TYPES.map((seed) => ({
    id: null,
    venture_id: ventureId || null,
    ...seed,
    is_active: true,
  }));
}

async function findDocumentType(ventureId, id, database = db) {
  const result = await database.execute({
    sql: "SELECT id, code, is_active FROM venture_document_types WHERE id = ? AND venture_id = ?",
    args: [id, ventureId],
  });
  return result.rows?.[0] || null;
}

/** A code that is free WITHIN this Venture ("Legal Documents" → legal_documents_2 if taken). */
export async function buildUniqueDocumentTypeCode(ventureId, label, database = db) {
  const base = slugifyDocumentTypeCode(label) || "document";
  let candidate = base;
  let suffix = 1;
  for (;;) {
    const taken = await database.execute({
      sql: "SELECT id FROM venture_document_types WHERE venture_id = ? AND code = ?",
      args: [ventureId, candidate],
    });
    if (!taken.rows?.length) return candidate;
    suffix += 1;
    candidate = `${base}_${suffix}`;
  }
}

export async function createVentureDocumentType({
  ventureId,
  label_en,
  label_fr = null,
  description = null,
  required = true,
  verification_method = "upload",
  sort_order = 0,
  created_by = null,
}, database = db) {
  if (!ventureId) throw new Error("venture.documentTypes.errorVentureRequired");

  const label = String(label_en || "").trim();
  if (!label) throw new Error("venture.documentTypes.errorNameRequired");

  const method = DOCUMENT_VERIFICATION_METHODS.includes(verification_method)
    ? verification_method
    : "upload";
  const code = await buildUniqueDocumentTypeCode(ventureId, label, database);

  const result = await database.execute({
    sql: `INSERT INTO venture_document_types
            (venture_id, code, label_en, label_fr, description, required, verification_method, sort_order, is_active, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE, ?)
          RETURNING id`,
    args: [
      ventureId,
      code,
      label,
      label_fr ? String(label_fr).trim() : null,
      description ? String(description).trim() : null,
      required ? 1 : 0,
      method,
      Number.isFinite(Number(sort_order)) ? Number(sort_order) : 0,
      created_by,
    ],
  });
  return { id: result.rows?.[0]?.id ?? null, code };
}

/**
 * Update only the fields the caller named, WITHIN one Venture. The code is
 * deliberately not editable: it is what uploaded documents are filed under.
 */
export async function updateVentureDocumentType({ ventureId, id, fields }, database = db) {
  if (!ventureId) throw new Error("venture.documentTypes.errorVentureRequired");
  if (!id) throw new Error("venture.documentTypes.errorIdRequired");

  const sets = [];
  const args = [];
  const { label_en, label_fr, description, required, verification_method, sort_order, is_active } = fields || {};

  if (label_en !== undefined) {
    const label = String(label_en).trim();
    if (!label) throw new Error("venture.documentTypes.errorNameRequired");
    sets.push("label_en = ?");
    args.push(label);
  }
  if (label_fr !== undefined) {
    sets.push("label_fr = ?");
    args.push(label_fr ? String(label_fr).trim() : null);
  }
  if (description !== undefined) {
    sets.push("description = ?");
    args.push(description ? String(description).trim() : null);
  }
  if (required !== undefined) {
    sets.push("required = ?");
    args.push(required ? 1 : 0);
  }
  if (verification_method !== undefined) {
    if (!DOCUMENT_VERIFICATION_METHODS.includes(verification_method)) {
      throw new Error("venture.documentTypes.errorMethodInvalid");
    }
    sets.push("verification_method = ?");
    args.push(verification_method);
  }
  if (sort_order !== undefined) {
    sets.push("sort_order = ?");
    args.push(Number(sort_order) || 0);
  }
  if (is_active !== undefined) {
    sets.push("is_active = ?");
    args.push(is_active ? 1 : 0);
  }
  if (sets.length === 0) throw new Error("venture.documentTypes.errorNothingToUpdate");

  sets.push("updated_at = NOW()");
  args.push(id, ventureId);

  await database.execute({
    sql: `UPDATE venture_document_types SET ${sets.join(", ")} WHERE id = ? AND venture_id = ?`,
    args,
  });
  return { success: true };
}

/**
 * How many documents THIS Venture already filed under a type. Deleting a type
 * that holds documents would hide them from the Data bank without deleting the
 * files, so the delete is refused instead.
 */
export async function countVentureDocumentsForType(ventureId, code, database = db) {
  const result = await database.execute({
    sql: `SELECT COUNT(*) AS n
          FROM venture_verification_documents d
          JOIN venture_verifications v ON v.id = d.verification_id
          WHERE v.venture_id = ? AND d.category = ?`,
    args: [ventureId, code],
  });
  return Number(result.rows?.[0]?.n || 0);
}

export async function deleteVentureDocumentType({ ventureId, id }, database = db) {
  if (!ventureId) throw new Error("venture.documentTypes.errorVentureRequired");
  if (!id) throw new Error("venture.documentTypes.errorIdRequired");

  const found = await findDocumentType(ventureId, id, database);
  if (!found) return { success: true };

  if (BUILT_IN_DOCUMENT_TYPE_CODES.includes(found.code)) {
    throw new Error("venture.documentTypes.errorBuiltIn");
  }

  const documents = await countVentureDocumentsForType(ventureId, found.code, database);
  if (documents > 0) {
    throw new Error("venture.documentTypes.errorHasDocuments");
  }

  await database.execute({
    sql: "DELETE FROM venture_document_types WHERE id = ? AND venture_id = ?",
    args: [id, ventureId],
  });
  return { success: true };
}

/**
 * Who may define ONE Venture's document types: a Super Admin, or a delegated
 * member of staff carrying the `lead_manager` responsibility ON THAT Venture.
 * Mirrors the codebase rule that a Lead Manager is the staff role with that
 * responsibility code — never inferred from the role string alone.
 *
 * `ventureId` must be the Venture CODE: assignments are stored by code.
 */
export async function canManageVentureDocumentTypes(session, ventureId, database = db) {
  if (!session || !ventureId) return false;
  if (session.role === "super_admin") return true;
  if (!session.cid) return false;

  const result = await database.execute({
    sql: `SELECT 1 FROM venture_staff_assignments
          WHERE venture_id = ? AND staff_contact_id = ? AND responsibility_code = 'lead_manager' AND status = 'active'
          LIMIT 1`,
    args: [ventureId, session.cid],
  });
  return (result.rows || []).length > 0;
}

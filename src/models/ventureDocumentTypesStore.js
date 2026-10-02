/**
 * Venture document types — statements (REPOSITORY layer).
 *
 * Every statement behind a Venture's Data-bank document list: the table, the
 * counters, the reads and the writes. The decisions (seed only when empty,
 * fall back to the built-in set, unique code, delete guards, who may manage) live
 * in `@/services/ventures/ventureDocumentTypes`.
 *
 * SQL is byte-identical to what used to sit inline in
 * `models/ventureDocumentTypes.js`.
 *
 * Every function takes the database last (injectable for tests and transactions).
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, decisions live in the service.
 */

import db from "@/lib/db";

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
      is_readiness BOOLEAN NOT NULL DEFAULT TRUE,
      created_by TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(venture_id, code)
    )`,
    args: [],
  });

  // The CREATE above is a no-op on a database that already has the table, so the
  // column has to be added separately or it would only ever exist on fresh
  // installs. Idempotent, and run before the database is marked as prepared.
  await database.execute({
    sql: `ALTER TABLE venture_document_types
            ADD COLUMN IF NOT EXISTS is_readiness BOOLEAN NOT NULL DEFAULT TRUE`,
    args: [],
  });

  await database.execute({
    sql: `CREATE INDEX IF NOT EXISTS idx_venture_document_types_venture
            ON venture_document_types(venture_id, is_active, sort_order)`,
    args: [],
  });

  preparedDatabases.add(database);
}

/** How many types a Venture already has. */
export function countVentureDocumentTypes(ventureId, database = db) {
  return database.execute({
    sql: "SELECT COUNT(*) AS n FROM venture_document_types WHERE venture_id = ?",
    args: [ventureId],
  });
}

/** Seed a Venture's list with the built-in set, in one statement. */
export function insertVentureDocumentTypeSeeds(ventureId, seeds, database = db) {
  // The built-in types are the ones the readiness engine was written against, so
  // they all count for readiness. A type an admin creates later does not (see
  // `insertVentureDocumentTypeRow`).
  const values = seeds.map(() => "(?, ?, ?, ?, ?, ?, ?, TRUE, TRUE)").join(", ");
  const args = seeds.flatMap((seed) => [
    ventureId,
    seed.code,
    seed.label_en,
    seed.label_fr,
    seed.required ? 1 : 0,
    seed.verification_method,
    seed.sort_order,
  ]);

  return database.execute({
    sql: `INSERT INTO venture_document_types
            (venture_id, code, label_en, label_fr, required, verification_method, sort_order, is_active, is_readiness)
          VALUES ${values}`,
    args,
  });
}

/** One Venture's document types, in the order the Data bank must show them. */
export async function listVentureDocumentTypes({ ventureId, includeInactive = false, database = db } = {}) {
  if (!ventureId) return [];
  const result = await database.execute({
    sql: `SELECT id, venture_id, code, label_en, label_fr, description, required,
                 verification_method, sort_order, is_active, is_readiness, created_at, updated_at
          FROM venture_document_types
          WHERE venture_id = ? AND (? = 1 OR is_active = TRUE)
          ORDER BY sort_order ASC, id ASC`,
    args: [ventureId, includeInactive ? 1 : 0],
  });
  return result.rows || [];
}

/** One type's identity within a Venture (or null). */
export async function selectDocumentTypeMeta(ventureId, id, database = db) {
  const result = await database.execute({
    sql: "SELECT id, code, is_active FROM venture_document_types WHERE id = ? AND venture_id = ?",
    args: [id, ventureId],
  });
  return result.rows?.[0] || null;
}

/** Whether a code is already taken WITHIN a Venture. */
export function selectDocumentTypeCode(ventureId, code, database = db) {
  return database.execute({
    sql: "SELECT id FROM venture_document_types WHERE venture_id = ? AND code = ?",
    args: [ventureId, code],
  });
}

/** Insert one document type. */
export async function insertVentureDocumentTypeRow({
  ventureId,
  code,
  label_en,
  label_fr,
  description,
  required,
  verification_method,
  sort_order,
  is_readiness = false,
  created_by,
}, database = db) {
  const result = await database.execute({
    sql: `INSERT INTO venture_document_types
            (venture_id, code, label_en, label_fr, description, required, verification_method, sort_order, is_active, is_readiness, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE, ?, ?)
          RETURNING id`,
    args: [
      ventureId,
      code,
      label_en,
      label_fr,
      description,
      required ? 1 : 0,
      verification_method,
      sort_order,
      is_readiness ? 1 : 0,
      created_by,
    ],
  });
  return result.rows?.[0]?.id ?? null;
}

/**
 * Update only the fields the caller named, WITHIN one Venture. The code is
 * deliberately not editable: it is what uploaded documents are filed under.
 * `changes` is already validated and trimmed by the service.
 */
export function updateVentureDocumentTypeRow({ ventureId, id, changes }, database = db) {
  const sets = [];
  const args = [];

  if (changes.label_en !== undefined) {
    sets.push("label_en = ?");
    args.push(changes.label_en);
  }
  if (changes.label_fr !== undefined) {
    sets.push("label_fr = ?");
    args.push(changes.label_fr);
  }
  if (changes.description !== undefined) {
    sets.push("description = ?");
    args.push(changes.description);
  }
  if (changes.required !== undefined) {
    sets.push("required = ?");
    args.push(changes.required ? 1 : 0);
  }
  if (changes.verification_method !== undefined) {
    sets.push("verification_method = ?");
    args.push(changes.verification_method);
  }
  if (changes.sort_order !== undefined) {
    sets.push("sort_order = ?");
    args.push(Number(changes.sort_order) || 0);
  }
  if (changes.is_active !== undefined) {
    sets.push("is_active = ?");
    args.push(changes.is_active ? 1 : 0);
  }
  if (changes.is_readiness !== undefined) {
    sets.push("is_readiness = ?");
    args.push(changes.is_readiness ? 1 : 0);
  }

  sets.push("updated_at = NOW()");
  args.push(id, ventureId);

  return database.execute({
    sql: `UPDATE venture_document_types SET ${sets.join(", ")} WHERE id = ? AND venture_id = ?`,
    args,
  });
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

/** Delete one document type. */
export function deleteVentureDocumentTypeRow(ventureId, id, database = db) {
  return database.execute({
    sql: "DELETE FROM venture_document_types WHERE id = ? AND venture_id = ?",
    args: [id, ventureId],
  });
}

/**
 * The active `lead_manager` assignment of a person ON a Venture. Assignments are
 * stored by the Venture CODE, never by the internal id.
 */
export function selectLeadManagerAssignment(ventureId, cid, database = db) {
  return database.execute({
    sql: `SELECT 1 FROM venture_staff_assignments
          WHERE venture_id = ? AND staff_contact_id = ? AND responsibility_code = 'lead_manager' AND status = 'active'
          LIMIT 1`,
    args: [ventureId, cid],
  });
}

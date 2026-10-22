/**
 * VENTURE DATA ROOM — statements (REPOSITORY layer).
 *
 * Everything that touches storage for the Data Room: the additive schema, the
 * document catalogue (reusing `venture_documents` and
 * `venture_document_versions`), the per-investor grants, the per-venture
 * requirements and the audit reads. Decisions live in
 * `@/services/ventures/dataRoom`.
 *
 * The tables already exist (`venture_documents` is the original "pitch deck &
 * data room" table). What is added here is additive and idempotent: review
 * metadata, an expiry date, a soft-delete marker, two small configuration
 * tables and a partial index. No existing column is rewritten.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement.
 * `database` is injectable last, for tests and transactions.
 */

import db from "@/lib/db";
import { resolveVentureInternalId } from "@/models/ventureIdentityStore";

const preparedDatabases = new WeakSet();

/**
 * Create/complete the Data Room schema. Idempotent and cheap after the first
 * call per process: every statement is `IF NOT EXISTS`.
 */
export async function ensureDataRoomSchema(database = db) {
  if (preparedDatabases.has(database)) return;

  const statements = [
    `CREATE TABLE IF NOT EXISTS venture_data_room_grants (
       id SERIAL PRIMARY KEY,
       venture_id UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
       document_id UUID REFERENCES venture_documents(id) ON DELETE CASCADE,
       category TEXT,
       grantee_cid TEXT NOT NULL,
       access_level TEXT NOT NULL DEFAULT 'view',
       granted_by TEXT,
       expires_at TIMESTAMP,
       revoked_at TIMESTAMP,
       revoked_by TEXT,
       created_at TIMESTAMP DEFAULT NOW()
     )`,
    `CREATE INDEX IF NOT EXISTS idx_data_room_grants_venture
       ON venture_data_room_grants(venture_id, grantee_cid)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_data_room_grants_doc_user
       ON venture_data_room_grants(document_id, grantee_cid)
       WHERE document_id IS NOT NULL AND revoked_at IS NULL`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_data_room_grants_category_user
       ON venture_data_room_grants(venture_id, category, grantee_cid)
       WHERE document_id IS NULL AND revoked_at IS NULL`,
    `CREATE TABLE IF NOT EXISTS venture_data_room_requirements (
       id SERIAL PRIMARY KEY,
       venture_id UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
       category TEXT NOT NULL,
       level TEXT NOT NULL DEFAULT 'conditional',
       stage_bucket TEXT,
       note TEXT,
       customized BOOLEAN NOT NULL DEFAULT FALSE,
       updated_by TEXT,
       created_at TIMESTAMP DEFAULT NOW(),
       updated_at TIMESTAMP DEFAULT NOW(),
       UNIQUE(venture_id, category)
     )`,
    `CREATE INDEX IF NOT EXISTS idx_data_room_requirements_venture
       ON venture_data_room_requirements(venture_id)`,
    `ALTER TABLE venture_data_room_requirements
       ADD COLUMN IF NOT EXISTS stage_bucket TEXT`,
    `ALTER TABLE venture_documents
       ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'uploaded'`,
    `ALTER TABLE venture_documents ADD COLUMN IF NOT EXISTS reviewer_id TEXT`,
    `ALTER TABLE venture_documents ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP`,
    `ALTER TABLE venture_documents ADD COLUMN IF NOT EXISTS review_notes TEXT`,
    `ALTER TABLE venture_documents ADD COLUMN IF NOT EXISTS reviewed_version INTEGER`,
    `ALTER TABLE venture_documents ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP`,
    `ALTER TABLE venture_documents ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP`,
    `ALTER TABLE venture_documents ADD COLUMN IF NOT EXISTS deleted_by TEXT`,
    // The version table's shape predates this feature and the legacy writer
    // only set half of it; both spellings are kept in step so a row can never
    // exist with a NULL version number.
    `ALTER TABLE venture_document_versions ADD COLUMN IF NOT EXISTS version_number INTEGER`,
    `ALTER TABLE venture_document_versions ADD COLUMN IF NOT EXISTS version_notes TEXT`,
    `ALTER TABLE venture_document_versions ADD COLUMN IF NOT EXISTS file_type TEXT`,
    `CREATE INDEX IF NOT EXISTS idx_venture_documents_room
       ON venture_documents(venture_id, is_deleted, category)`,
  ];

  for (const sql of statements) {
    await database.execute({ sql, args: [] });
  }

  preparedDatabases.add(database);
}

/** The venture's stored business stage, or null. */
export async function selectVentureStage(ventureRef, database = db) {
  const ventureId = await resolveVentureInternalId(ventureRef, database);
  return database.execute({
    sql: "SELECT business_stage FROM ventures WHERE id::text = ? LIMIT 1",
    args: [ventureId],
  });
}

// ── Batch reads for readiness (many Ventures, constant number of queries) ────
//
// The directory and the Intelligence dashboard need one readiness figure per
// Venture. Calling the per-Venture engine in a loop would cost 3 queries per
// row; these three statements answer the whole page at once and feed the SAME
// `computeDataRoomCompleteness` the Data Room screen uses, so a list and a
// detail page can never disagree.

/** Business stages for many Ventures (keyed by internal id). */
export function selectVentureStagesForVentures(ventureIds = []) {
  const ids = (ventureIds || []).filter(Boolean).map(String);
  if (ids.length === 0) return Promise.resolve({ rows: [] });
  const placeholders = ids.map(() => "?").join(", ");
  return db.execute({
    sql: `SELECT id::text AS id, business_stage FROM ventures WHERE id::text IN (${placeholders})`,
    args: ids,
  });
}

/** Stored requirement levels for many Ventures. No seeding: this is a READ. */
export function selectDataRoomRequirementsForVentures(ventureIds = []) {
  const ids = (ventureIds || []).filter(Boolean).map(String);
  if (ids.length === 0) return Promise.resolve({ rows: [] });
  const placeholders = ids.map(() => "?").join(", ");
  return db.execute({
    sql: `SELECT venture_id::text AS venture_id, category, level
            FROM venture_data_room_requirements
           WHERE venture_id::text IN (${placeholders})`,
    args: ids,
  });
}

/**
 * Live document statuses for many Ventures, with the SAME expiry rule the
 * per-Venture catalogue applies — a document whose expiry has passed reads as
 * `expired` without a write, so a list never counts a stale file as verified.
 */
export function selectDataRoomDocumentStatusesForVentures(ventureIds = []) {
  const ids = (ventureIds || []).filter(Boolean).map(String);
  if (ids.length === 0) return Promise.resolve({ rows: [] });
  const placeholders = ids.map(() => "?").join(", ");
  return db.execute({
    sql: `SELECT d.venture_id::text AS venture_id, d.category,
                 CASE
                   WHEN d.expires_at IS NOT NULL AND d.expires_at < NOW()
                    AND COALESCE(NULLIF(d.review_status, ''), 'uploaded') <> 'rejected'
                   THEN 'expired'
                   ELSE COALESCE(NULLIF(d.review_status, ''), 'uploaded')
                 END AS status
            FROM venture_documents d
           WHERE d.venture_id::text IN (${placeholders}) AND d.is_deleted = false`,
    args: ids,
  });
}

/**
 * The live documents of one Venture, newest first.
 *
 * `review_status` is DERIVED: a document whose expiry date has passed reads as
 * `expired` without a write on every page view. A reviewer's `rejected`
 * decision is preserved (an expired rejected document is still rejected), so
 * the answer never rewrites the audit trail.
 *
 * `granteeCid` switches the read into INVESTOR mode: only documents covered by
 * a live grant for that person are returned, and expired documents are hidden.
 */
export async function selectDataRoomDocuments(
  ventureRef,
  { category, status, search, granteeCid = null, includeDeleted = false } = {},
  database = db,
) {
  const ventureId = await resolveVentureInternalId(ventureRef, database);
  const effectiveStatus = `CASE
      WHEN d.expires_at IS NOT NULL AND d.expires_at < NOW()
       AND COALESCE(NULLIF(d.review_status, ''), 'uploaded') <> 'rejected'
      THEN 'expired'
      ELSE COALESCE(NULLIF(d.review_status, ''), 'uploaded')
    END`;

  const args = [ventureId];
  let sql = `
    SELECT * FROM (
      SELECT d.id, d.venture_id, COALESCE(d.title, d.name) AS title, d.name,
             d.description, d.category, d.document_type, d.file_name, d.file_size,
             d.file_type, d.storage_path, d.file_url, d.current_version,
             d.approval_status, d.is_pitch_deck, d.uploaded_by,
             d.reviewer_id, d.reviewed_at, d.review_notes, d.reviewed_version,
             d.expires_at, d.created_at, d.updated_at, d.is_deleted,
             ${effectiveStatus} AS review_status
      FROM venture_documents d
      WHERE d.venture_id = ? AND (d.is_deleted = false OR ? = 1)`;

  args.push(includeDeleted ? 1 : 0);

  if (granteeCid) {
    sql += `
        AND EXISTS (
          SELECT 1 FROM venture_data_room_grants g
          WHERE g.venture_id = d.venture_id
            AND g.grantee_cid = ?
            AND g.revoked_at IS NULL
            AND (g.expires_at IS NULL OR g.expires_at > NOW())
            AND (g.document_id = d.id OR (g.document_id IS NULL AND g.category = d.category))
        )`;
    args.push(granteeCid);
  }

  sql += "\n    ) doc WHERE 1 = 1";

  if (granteeCid) sql += " AND doc.review_status <> 'expired'";
  if (category) {
    sql += " AND doc.category = ?";
    args.push(category);
  }
  if (status) {
    sql += " AND doc.review_status = ?";
    args.push(status);
  }
  if (search) {
    sql += " AND (doc.title ILIKE ? OR doc.description ILIKE ? OR doc.file_name ILIKE ?)";
    args.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  sql += " ORDER BY doc.created_at DESC";
  return database.execute({ sql, args });
}

/** One live document of one Venture. Never another Venture's row. */
export async function selectDataRoomDocument(
  ventureRef,
  documentId,
  { granteeCid = null } = {},
  database = db,
) {
  const ventureId = await resolveVentureInternalId(ventureRef, database);
  const args = [documentId, ventureId];
  let sql = `SELECT d.*,
               CASE
                 WHEN d.expires_at IS NOT NULL AND d.expires_at < NOW()
                  AND COALESCE(NULLIF(d.review_status, ''), 'uploaded') <> 'rejected'
                 THEN 'expired'
                 ELSE COALESCE(NULLIF(d.review_status, ''), 'uploaded')
               END AS review_status_effective
             FROM venture_documents d
             WHERE d.id = ? AND d.venture_id = ? AND d.is_deleted = false`;
  if (granteeCid) {
    sql += ` AND EXISTS (
               SELECT 1 FROM venture_data_room_grants g
               WHERE g.venture_id = d.venture_id AND g.grantee_cid = ?
                 AND g.revoked_at IS NULL
                 AND (g.expires_at IS NULL OR g.expires_at > NOW())
                 AND (g.document_id = d.id OR (g.document_id IS NULL AND g.category = d.category))
             )`;
    args.push(granteeCid);
  }
  return database.execute({ sql, args });
}

/** A document's versions, oldest first, scoped through its Venture. */
export async function selectDataRoomVersions(ventureRef, documentId, database = db) {
  const ventureId = await resolveVentureInternalId(ventureRef, database);
  return database.execute({
    sql: `SELECT v.*
          FROM venture_document_versions v
          JOIN venture_documents d ON d.id = v.document_id
          WHERE v.document_id = ? AND d.venture_id = ?
          ORDER BY COALESCE(v.version_number, v.version, 1) ASC, v.created_at ASC`,
    args: [documentId, ventureId],
  });
}

/** The highest version recorded for a document. */
export function selectMaxDataRoomVersion(documentId, database = db) {
  return database.execute({
    sql: `SELECT COALESCE(MAX(COALESCE(version_number, version, 1)), 0) AS max_version
          FROM venture_document_versions WHERE document_id = ?`,
    args: [documentId],
  });
}

/** Insert one document and return its id. */
export async function insertDataRoomDocument({
  ventureId,
  title,
  description,
  category,
  fileName,
  fileSize,
  fileType,
  storagePath,
  uploadedBy,
  expiresAt,
  isPitchDeck = false,
}, database = db) {
  return database.execute({
    sql: `INSERT INTO venture_documents
            (venture_id, title, name, description, document_type, category,
             file_name, file_size, file_type, file_url, storage_path,
             is_pitch_deck, current_version, review_status, uploaded_by, expires_at)
          VALUES (?, ?, ?, ?, 'data_room', ?, ?, ?, ?, ?, ?, ?, 1, 'uploaded', ?, ?)
          RETURNING id`,
    args: [ventureId, title, title, description, category, fileName, fileSize,
      fileType, storagePath, storagePath, isPitchDeck ? 1 : 0, uploadedBy, expiresAt],
  });
}

/** Apply a computed SET list to one document. */
export function updateDataRoomDocument(sets, args, database = db) {
  return database.execute({
    sql: `UPDATE venture_documents SET ${sets.join(", ")} WHERE id = ?`,
    args,
  });
}

/** Soft-delete: the row and its versions stay, the catalogue stops showing it. */
export function softDeleteDataRoomDocument(documentId, actorCid, database = db) {
  return database.execute({
    sql: `UPDATE venture_documents
          SET is_deleted = true, deleted_at = NOW(), deleted_by = ?, updated_at = NOW()
          WHERE id = ?`,
    args: [actorCid, documentId],
  });
}

/** Record one version. Both version spellings are written. */
export async function insertDataRoomVersion({
  documentId,
  versionNumber,
  fileName,
  fileSize,
  fileType,
  storagePath,
  notes,
  uploadedBy,
}, database = db) {
  return database.execute({
    sql: `INSERT INTO venture_document_versions
            (document_id, version_number, version, file_name, file_size, file_type,
             file_url, storage_path, version_notes, uploaded_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [documentId, versionNumber, versionNumber, fileName, fileSize, fileType,
      storagePath, storagePath, notes, uploadedBy],
  });
}

/** Apply a reviewer's decision to a document. */
export function updateDataRoomReview({
  documentId,
  status,
  reviewerId,
  notes,
  reviewedVersion,
}, database = db) {
  return database.execute({
    sql: `UPDATE venture_documents
          SET review_status = ?, reviewer_id = ?, reviewed_at = NOW(),
              review_notes = ?, reviewed_version = ?, updated_at = NOW()
          WHERE id = ?`,
    args: [status, reviewerId, notes, reviewedVersion, documentId],
  });
}

/** Remove ONE version row — the compensating step when a replace cannot finish. */
export function deleteDataRoomVersion(documentId, versionNumber, database = db) {
  return database.execute({
    sql: `DELETE FROM venture_document_versions
          WHERE document_id = ? AND COALESCE(version_number, version) = ?`,
    args: [documentId, versionNumber],
  });
}

// ── Grants ──────────────────────────────────────────────────────────────────

/** Every live grant of a Venture, with the person's contact details. */
export async function selectDataRoomGrants(ventureRef, database = db) {
  const ventureId = await resolveVentureInternalId(ventureRef, database);
  return database.execute({
    sql: `SELECT g.*, c.name AS grantee_name, c.email AS grantee_email,
                 COALESCE(d.title, d.name) AS document_title,
                 (g.expires_at IS NOT NULL AND g.expires_at < NOW()) AS is_expired
          FROM venture_data_room_grants g
          LEFT JOIN contacts c ON c.cid = g.grantee_cid
          LEFT JOIN venture_documents d ON d.id = g.document_id
          WHERE g.venture_id = ? AND g.revoked_at IS NULL
          ORDER BY g.created_at DESC`,
    args: [ventureId],
  });
}

/** Live grants for ONE document. */
export async function selectDataRoomDocumentGrants(ventureRef, documentId, database = db) {
  const ventureId = await resolveVentureInternalId(ventureRef, database);
  return database.execute({
    sql: `SELECT g.*, c.name AS grantee_name, c.email AS grantee_email,
                 (g.expires_at IS NOT NULL AND g.expires_at < NOW()) AS is_expired
          FROM venture_data_room_grants g
          LEFT JOIN contacts c ON c.cid = g.grantee_cid
          WHERE g.venture_id = ? AND g.document_id = ? AND g.revoked_at IS NULL
          ORDER BY g.created_at DESC`,
    args: [ventureId, documentId],
  });
}

/** Insert one grant (document or whole category when documentId is null). */
export async function insertDataRoomGrant({
  ventureId,
  documentId = null,
  category = null,
  granteeCid,
  accessLevel = "view",
  grantedBy,
  expiresAt = null,
}, database = db) {
  const id = await resolveVentureInternalId(ventureId, database);
  return database.execute({
    sql: `INSERT INTO venture_data_room_grants
            (venture_id, document_id, category, grantee_cid, access_level, granted_by, expires_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [id, documentId, category, granteeCid, accessLevel, grantedBy, expiresAt],
  });
}

/** Revoke ONE grant, scoped to its Venture. */
export async function revokeDataRoomGrant(ventureRef, grantId, actorCid, database = db) {
  const ventureId = await resolveVentureInternalId(ventureRef, database);
  return database.execute({
    sql: `UPDATE venture_data_room_grants
          SET revoked_at = NOW(), revoked_by = ?
          WHERE id = ? AND venture_id = ? AND revoked_at IS NULL`,
    args: [actorCid, grantId, ventureId],
  });
}

/** Whether a person holds at least one live grant on a Venture. */
export async function selectDataRoomGrantForPerson(ventureRef, granteeCid, database = db) {
  const ventureId = await resolveVentureInternalId(ventureRef, database);
  return database.execute({
    sql: `SELECT 1 FROM venture_data_room_grants
          WHERE venture_id = ? AND grantee_cid = ? AND revoked_at IS NULL
            AND (expires_at IS NULL OR expires_at > NOW())
          LIMIT 1`,
    args: [ventureId, granteeCid],
  });
}

/** A contact by email (the address a manager grants access to). */
export function selectContactByEmail(email, database = db) {
  return database.execute({
    sql: "SELECT cid, name, email FROM contacts WHERE LOWER(email) = LOWER(?) LIMIT 1",
    args: [String(email || "").trim()],
  });
}

/** An investor profile by its user id — the "is this person an investor?" probe. */
export function selectInvestorProfileByUserId(userCid, database = db) {
  return database.execute({
    sql: "SELECT id, user_id, approval_status FROM investor_profiles WHERE user_id = ? LIMIT 1",
    args: [String(userCid || "")],
  });
}

// ── Requirements ────────────────────────────────────────────────────────────

/** The stored requirement rows of a Venture. */
export async function selectDataRoomRequirements(ventureRef, database = db) {
  const ventureId = await resolveVentureInternalId(ventureRef, database);
  return database.execute({
    sql: `SELECT id, venture_id, category, level, stage_bucket, note, customized, updated_by, updated_at
          FROM venture_data_room_requirements
          WHERE venture_id = ?
          ORDER BY category ASC`,
    args: [ventureId],
  });
}

/** Seed the initial matrix for a Venture, ignoring rows that already exist. */
export async function insertDataRoomRequirementSeeds(ventureRef, seeds, stageBucket, database = db) {
  const ventureId = await resolveVentureInternalId(ventureRef, database);
  const values = seeds.map(() => "(?, ?, ?, ?, FALSE)").join(", ");
  const args = seeds.flatMap((seed) => [ventureId, seed.category, seed.level, stageBucket]);
  return database.execute({
    sql: `INSERT INTO venture_data_room_requirements (venture_id, category, level, stage_bucket, customized)
          VALUES ${values}
          ON CONFLICT (venture_id, category) DO NOTHING`,
    args,
  });
}

/**
 * Bring every NON-customized requirement level in step with the Venture's
 * current stage. Called only when the stored bucket actually differs, so a
 * normal read pays nothing for it.
 */
export async function updateDataRoomRequirementsForStage(ventureRef, stageBucket, seeds, database = db) {
  const ventureId = await resolveVentureInternalId(ventureRef, database);
  for (const seed of seeds) {
    await database.execute({
      sql: `UPDATE venture_data_room_requirements
            SET level = ?, stage_bucket = ?, updated_at = NOW()
            WHERE venture_id = ? AND category = ? AND customized = FALSE`,
      args: [seed.level, stageBucket, ventureId, seed.category],
    });
  }
}

/** One requirement row, scoped to its Venture. */
export async function selectDataRoomRequirement(ventureRef, category, database = db) {
  const ventureId = await resolveVentureInternalId(ventureRef, database);
  return database.execute({
    sql: `SELECT * FROM venture_data_room_requirements
          WHERE venture_id = ? AND category = ?`,
    args: [ventureId, category],
  });
}

/** Apply a manager's explicit level change and mark it customized. */
export async function updateDataRoomRequirement({
  ventureRef,
  category,
  level,
  note,
  updatedBy,
}, database = db) {
  const ventureId = await resolveVentureInternalId(ventureRef, database);
  return database.execute({
    sql: `UPDATE venture_data_room_requirements
          SET level = ?, note = ?, customized = TRUE, updated_by = ?, updated_at = NOW()
          WHERE venture_id = ? AND category = ?`,
    args: [level, note, updatedBy, ventureId, category],
  });
}

/** One person's live membership row in a Venture (or none). */
export async function selectVentureMembership(ventureRef, cid, database = db) {
  const ventureId = await resolveVentureInternalId(ventureRef, database);
  return database.execute({
    sql: `SELECT member_type, lead_founder, is_owner
          FROM venture_members
          WHERE venture_id = ? AND (contact_id = ? OR user_cid = ?) AND removed_at IS NULL
          LIMIT 1`,
    args: [ventureId, String(cid || ""), String(cid || "")],
  });
}

// ── Access journal ──────────────────────────────────────────────────────────

/**
 * The readable VNT code of a Venture from either its internal id or its code.
 *
 * The access journal stores that code (its foreign key is the business key),
 * while the Data Room mostly holds the internal id. Resolving it here keeps the
 * writer honest instead of guessing which form the caller passed.
 */
export function selectDataRoomVentureCode(ventureRef, database = db) {
  const value = String(ventureRef || "").trim();
  return database.execute({
    sql: `SELECT venture_id FROM ventures
           WHERE id::text = ? OR venture_id = ? LIMIT 1`,
    args: [value, value],
  });
}

/**
 * Recent access events of a Venture, newest first. Manager/reviewer only —
 * the caller decides who may receive it, exactly as it does for the audit log.
 */
export function selectDataRoomAccessLog(ventureRef, { limit = 50 } = {}, database = db) {
  return database.execute({
    sql: `SELECT al.id, al.document_id, al.access_type,
                 al.viewer_email, al.viewer_name, al.created_at,
                 COALESCE(d.title, d.name, 'document') AS document_title
            FROM venture_document_access_logs al
            LEFT JOIN venture_documents d ON d.id = al.document_id
           WHERE al.venture_id = (
             SELECT venture_id FROM ventures
              WHERE id::text = ? OR venture_id = ? LIMIT 1
           )
           ORDER BY al.created_at DESC
           LIMIT ?`,
    args: [String(ventureRef || ""), String(ventureRef || ""), Number(limit) || 50],
  });
}

/**
 * One consultation / download event. Reuses the existing access-log table; no
 * schema change and no file contents are recorded.
 */
export function insertDataRoomAccessLog({
  documentId,
  ventureCode,
  accessType,
  viewerEmail = null,
  viewerName = null,
  ipAddress = null,
  userAgent = null,
}, database = db) {
  return database.execute({
    sql: `INSERT INTO venture_document_access_logs
            (document_id, venture_id, access_type, viewer_email, viewer_name,
             ip_address, user_agent)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [documentId, ventureCode, accessType, viewerEmail, viewerName, ipAddress, userAgent],
  });
}

// ── Audit ───────────────────────────────────────────────────────────────────

/**
 * The storage type of `venture_activity_log.details`.
 *
 * The column is TEXT on the production database and JSONB on databases built
 * from the later migration. Reading it once lets the insert below send the
 * value in the shape the column actually accepts, instead of failing the whole
 * audit write on a cast.
 */
let activityDetailsType = null;

export async function detectActivityDetailsType(database = db) {
  if (activityDetailsType) return activityDetailsType;
  const result = await database.execute({
    sql: `SELECT data_type FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'venture_activity_log'
            AND column_name = 'details' LIMIT 1`,
    args: [],
  });
  activityDetailsType = String(result.rows?.[0]?.data_type || "text");
  return activityDetailsType;
}

/** Append one Data Room audit row (the details cast follows the column). */
export async function insertDataRoomActivity({
  ventureRef,
  action,
  actorCid,
  actorName,
  detailsJson,
}, database = db) {
  const type = await detectActivityDetailsType(database).catch(() => "text");
  const cast = type === "jsonb" ? "?::jsonb" : "?";
  return database.execute({
    sql: `INSERT INTO venture_activity_log (venture_id, action, actor_cid, actor_name, details)
          VALUES ((SELECT id FROM ventures WHERE venture_id = ? OR id::text = ?), ?, ?, ?, ${cast})`,
    args: [ventureRef, ventureRef, action, actorCid, actorName || "", detailsJson],
  });
}

/** Every Data Room audit row of a Venture, newest first. */
export async function selectDataRoomActivity(ventureRef, database = db) {
  return database.execute({
    sql: `SELECT id, action, actor_cid, actor_name, details, created_at
          FROM venture_activity_log
          WHERE venture_id = (SELECT id FROM ventures WHERE venture_id = ? OR id::text = ?)
            AND action LIKE 'DATA_ROOM%'
          ORDER BY created_at DESC
          LIMIT 200`,
    args: [ventureRef, ventureRef],
  });
}

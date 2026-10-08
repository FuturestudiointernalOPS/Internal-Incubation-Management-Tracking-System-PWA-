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
 *
 * Layer (see docs/LAYER_SPLIT.md): the decisions live here; every statement lives
 * in `@/models/ventureDocumentTypesStore`. The database is injectable last, for
 * tests and transactions.
 */

import {
  BUILT_IN_DOCUMENT_TYPE_CODES,
  DEFAULT_VENTURE_DOCUMENT_TYPES,
  DOCUMENT_VERIFICATION_METHODS,
  slugifyDocumentTypeCode,
} from "@/lib/ventureDocumentTypeDefaults";
import {
  ensureVentureDocumentTypesTable,
  countVentureDocumentTypes,
  insertVentureDocumentTypeSeeds,
  listVentureDocumentTypes,
  selectDocumentTypeMeta,
  selectDocumentTypeCode,
  insertVentureDocumentTypeRow,
  updateVentureDocumentTypeRow,
  countVentureDocumentsForType,
  deleteVentureDocumentTypeRow,
  selectLeadManagerAssignment,
} from "@/models/ventureDocumentTypesStore";

/**
 * Give a Venture the six built-in categories when it has none yet — and leave an
 * edited list alone from then on. Called on both the read and the write path, so
 * a Venture created before this feature, and one created after it, end up with
 * the same starting point.
 */
export async function ensureVentureDocumentTypesForVenture(ventureId, database) {
  if (!ventureId) return;

  await ensureVentureDocumentTypesTable(database);

  const counted = await countVentureDocumentTypes(ventureId, database);
  if (Number(counted.rows?.[0]?.n || 0) > 0) return;

  await insertVentureDocumentTypeSeeds(ventureId, DEFAULT_VENTURE_DOCUMENT_TYPES, database);
}

/**
 * One Venture's active types, or the built-in seed when the rows cannot be read
 * (a database that predates the table). The Data bank must never render empty
 * just because the configuration could not be loaded.
 */
export async function listActiveVentureDocumentTypesOrDefaults(ventureId, database) {
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

/** A code that is free WITHIN this Venture ("Legal Documents" → legal_documents_2 if taken). */
export async function buildUniqueDocumentTypeCode(ventureId, label, database) {
  const base = slugifyDocumentTypeCode(label) || "document";
  let candidate = base;
  let suffix = 1;
  for (;;) {
    const taken = await selectDocumentTypeCode(ventureId, candidate, database);
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
  is_readiness = false,
  created_by = null,
}, database) {
  if (!ventureId) throw new Error("venture.documentTypes.errorVentureRequired");

  const label = String(label_en || "").trim();
  if (!label) throw new Error("venture.documentTypes.errorNameRequired");

  const method = DOCUMENT_VERIFICATION_METHODS.includes(verification_method)
    ? verification_method
    : "upload";
  const code = await buildUniqueDocumentTypeCode(ventureId, label, database);

  const id = await insertVentureDocumentTypeRow({
    ventureId,
    code,
    label_en: label,
    label_fr: label_fr ? String(label_fr).trim() : null,
    description: description ? String(description).trim() : null,
    required: required ? 1 : 0,
    verification_method: method,
    sort_order: Number.isFinite(Number(sort_order)) ? Number(sort_order) : 0,
    is_readiness: is_readiness ? 1 : 0,
    created_by,
  }, database);
  return { id, code };
}

/**
 * Update only the fields the caller named, WITHIN one Venture. The code is
 * deliberately not editable: it is what uploaded documents are filed under.
 */
export async function updateVentureDocumentType({ ventureId, id, fields }, database) {
  if (!ventureId) throw new Error("venture.documentTypes.errorVentureRequired");
  if (!id) throw new Error("venture.documentTypes.errorIdRequired");

  const { label_en, label_fr, description, required, verification_method, sort_order, is_active, is_readiness } = fields || {};
  const changes = {};

  if (label_en !== undefined) {
    const label = String(label_en).trim();
    if (!label) throw new Error("venture.documentTypes.errorNameRequired");
    changes.label_en = label;
  }
  if (label_fr !== undefined) {
    changes.label_fr = label_fr ? String(label_fr).trim() : null;
  }
  if (description !== undefined) {
    changes.description = description ? String(description).trim() : null;
  }
  if (required !== undefined) {
    changes.required = required ? 1 : 0;
  }
  if (verification_method !== undefined) {
    if (!DOCUMENT_VERIFICATION_METHODS.includes(verification_method)) {
      throw new Error("venture.documentTypes.errorMethodInvalid");
    }
    changes.verification_method = verification_method;
  }
  if (sort_order !== undefined) {
    changes.sort_order = Number(sort_order) || 0;
  }
  if (is_active !== undefined) {
    changes.is_active = is_active ? 1 : 0;
  }
  if (is_readiness !== undefined) {
    changes.is_readiness = is_readiness ? 1 : 0;
  }
  if (Object.keys(changes).length === 0) throw new Error("venture.documentTypes.errorNothingToUpdate");

  await updateVentureDocumentTypeRow({ ventureId, id, changes }, database);
  return { success: true };
}

export async function deleteVentureDocumentType({ ventureId, id }, database) {
  if (!ventureId) throw new Error("venture.documentTypes.errorVentureRequired");
  if (!id) throw new Error("venture.documentTypes.errorIdRequired");

  const found = await selectDocumentTypeMeta(ventureId, id, database);
  if (!found) return { success: true };

  if (BUILT_IN_DOCUMENT_TYPE_CODES.includes(found.code)) {
    throw new Error("venture.documentTypes.errorBuiltIn");
  }

  const documents = await countVentureDocumentsForType(ventureId, found.code, database);
  if (documents > 0) {
    throw new Error("venture.documentTypes.errorHasDocuments");
  }

  await deleteVentureDocumentTypeRow(ventureId, id, database);
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
export async function canManageVentureDocumentTypes(session, ventureId, database) {
  if (!session || !ventureId) return false;
  if (session.role === "super_admin") return true;
  if (!session.cid) return false;

  const result = await selectLeadManagerAssignment(ventureId, session.cid, database);
  return (result.rows || []).length > 0;
}

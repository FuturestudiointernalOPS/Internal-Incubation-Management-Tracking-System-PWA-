/**
 * Data Room — investor grants and requirement configuration.
 *
 * Access is GRANTED, never inherited: an investor profile, a watchlist entry
 * or a pipeline row are not enough on their own. A grant covers one document or
 * one whole category, is read-only, can expire, and can be revoked at any time.
 */

import {
  ensureDataRoomSchema,
  selectDataRoomDocument,
  selectContactByEmail,
  selectInvestorProfileByUserId,
  insertDataRoomGrant,
  revokeDataRoomGrant,
  updateDataRoomRequirement,
} from "@/models/ventureDataRoomStore";
import {
  isDataRoomCategory,
  isDataRoomRequirementLevel,
} from "@/lib/dataRoom";
import { resolveDataRoomViewer, loadDataRoomRequirements } from "./access";
import { audit, cleanText, refusal } from "./shared";

// ── Investor access ─────────────────────────────────────────────────────────

/**
 * Grant ONE investor access to one document or one whole category.
 *
 * The grantee must be a real contact holding an investor profile — a manager
 * cannot turn an arbitrary email into a "viewer". The grant is read-only;
 * investors never gain edit rights over venture-owned documents.
 */
export async function grantDataRoomAccess({
  ventureId,
  session,
  documentId = null,
  category = null,
  email,
  expiresInDays = null,
  database,
}) {
  const viewer = await resolveDataRoomViewer({ ventureId, session, database });
  if (!viewer.allowed) return refusal(404, "errors.notFound");
  if (!viewer.canManage) return refusal(403, "errors.insufficientPermissions");

  if (!documentId && !isDataRoomCategory(category)) {
    return refusal(400, "dataRoom.errors.scopeRequired");
  }

  await ensureDataRoomSchema(database);

  if (documentId) {
    const existing = await selectDataRoomDocument(ventureId, documentId, {}, database);
    if (!existing.rows?.[0]) return refusal(404, "errors.notFound");
  }

  const contactResult = await selectContactByEmail(email, database);
  const contact = contactResult.rows?.[0];
  if (!contact) return refusal(400, "dataRoom.errors.investorNotFound");

  const profile = await selectInvestorProfileByUserId(contact.cid, database);
  if (!profile.rows?.[0]) return refusal(400, "dataRoom.errors.notInvestor");

  let expiresAt = null;
  if (expiresInDays !== null && expiresInDays !== undefined && expiresInDays !== "") {
    const days = Number(expiresInDays);
    if (!Number.isFinite(days) || days <= 0) return refusal(400, "dataRoom.errors.invalidExpiry");
    expiresAt = new Date(Date.now() + days * 86400000).toISOString();
  }

  try {
    await insertDataRoomGrant(
      {
        ventureId,
        documentId: documentId || null,
        category: documentId ? null : category,
        granteeCid: contact.cid,
        accessLevel: "view",
        grantedBy: session.cid || "system",
        expiresAt,
      },
      database,
    );
  } catch (_error) {
    // The partial unique index refuses a second LIVE grant for the same
    // person and scope. That is a duplicate, not a server fault.
    return refusal(400, "dataRoom.errors.alreadyGranted");
  }

  await audit(
    ventureId,
    "DATA_ROOM_ACCESS_GRANTED",
    session,
    {
      document_id: documentId || null,
      category: documentId ? null : category,
      grantee_cid: contact.cid,
      expires_at: expiresAt,
    },
    database,
  );

  return { ok: true };
}

/** Revoke ONE grant. Subsequent reads stop returning the covered documents. */
export async function revokeDataRoomAccess({ ventureId, grantId, session, database }) {
  const viewer = await resolveDataRoomViewer({ ventureId, session, database });
  if (!viewer.allowed) return refusal(404, "errors.notFound");
  if (!viewer.canManage) return refusal(403, "errors.insufficientPermissions");

  await ensureDataRoomSchema(database);
  const result = await revokeDataRoomGrant(ventureId, grantId, session.cid || "system", database);
  if (Number(result.rowsAffected || result.rowCount || 0) === 0) return refusal(404, "errors.notFound");

  await audit(
    ventureId,
    "DATA_ROOM_ACCESS_REVOKED",
    session,
    { grant_id: grantId },
    database,
  );

  return { ok: true };
}

// ── Requirements ────────────────────────────────────────────────────────────

/** An authorised reviewer/staff member changes one category's requirement. */
export async function setDataRoomRequirement({ ventureId, session, category, level, note, database }) {
  const viewer = await resolveDataRoomViewer({ ventureId, session, database });
  if (!viewer.allowed) return refusal(404, "errors.notFound");
  // A Lead Manager does not review documents, but DOES decide what the Venture
  // must provide. The two rights are deliberately separate.
  if (!viewer.canConfigureRequirements) return refusal(403, "errors.insufficientPermissions");

  if (!isDataRoomCategory(category)) return refusal(400, "dataRoom.errors.categoryInvalid");
  if (!isDataRoomRequirementLevel(level)) return refusal(400, "dataRoom.errors.levelInvalid");

  await ensureDataRoomSchema(database);
  await loadDataRoomRequirements(ventureId, database); // guarantee the row exists
  await updateDataRoomRequirement(
    {
      ventureRef: ventureId,
      category,
      level,
      note: cleanText(note, 1000) || null,
      updatedBy: session.cid || "system",
    },
    database,
  );

  await audit(
    ventureId,
    "DATA_ROOM_REQUIREMENT_UPDATED",
    session,
    { category, level },
    database,
  );

  return { ok: true };
}

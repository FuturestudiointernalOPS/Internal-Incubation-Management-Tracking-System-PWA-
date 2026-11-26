import crypto from "crypto";
import {
  ensureDataRoomSchema,
  insertDataRoomShareLink,
  selectDataRoomShareLinks,
  selectDataRoomShareLinkByToken,
  incrementDataRoomShareLinkViews,
  revokeDataRoomShareLink,
  selectDataRoomDocuments,
} from "@/models/ventureDataRoomStore";
import { resolveDataRoomViewer } from "./access";
import { audit, refusal, withSignedUrl } from "./shared";

const FUTURE_STUDIO_INVESTOR_URL =
  process.env.NEXT_PUBLIC_INVESTOR_POOL_URL ||
  "https://futurestudio.impactos.org/investors";

/**
 * Generate a new shareable read-only link for external investors.
 */
export async function createDataRoomShareLink({
  ventureId,
  session,
  name,
  expiresInDays = 30,
  database,
}) {
  const viewer = await resolveDataRoomViewer({ ventureId, session, database });
  if (!viewer.allowed) return refusal(404, "errors.notFound");
  if (!viewer.canManage) return refusal(403, "errors.insufficientPermissions");

  await ensureDataRoomSchema(database);

  const token = `dtr_${crypto.randomBytes(18).toString("hex")}`;
  let expiresAt = null;
  if (expiresInDays && Number(expiresInDays) > 0) {
    expiresAt = new Date(Date.now() + Number(expiresInDays) * 86400000).toISOString();
  }

  const result = await insertDataRoomShareLink(
    {
      ventureRef: ventureId,
      token,
      name: name?.trim() || "General Investor Link",
      createdBy: session.cid || session.email || "founder",
      expiresAt,
    },
    database,
  );

  await audit(
    ventureId,
    "DATA_ROOM_SHARE_LINK_CREATED",
    session,
    { token, name, expires_at: expiresAt },
    database,
  );

  return { ok: true, link: result.rows?.[0] };
}

/**
 * Retrieve all active and historic share links for this venture.
 */
export async function listDataRoomShareLinks({ ventureId, session, database }) {
  const viewer = await resolveDataRoomViewer({ ventureId, session, database });
  if (!viewer.allowed) return refusal(404, "errors.notFound");
  if (!viewer.canManage) return refusal(403, "errors.insufficientPermissions");

  await ensureDataRoomSchema(database);
  const result = await selectDataRoomShareLinks(ventureId, database);
  return { ok: true, links: result.rows || [] };
}

/**
 * Revoke an existing share link immediately.
 */
export async function revokeDataRoomShareLinkService({ ventureId, linkId, session, database }) {
  const viewer = await resolveDataRoomViewer({ ventureId, session, database });
  if (!viewer.allowed) return refusal(404, "errors.notFound");
  if (!viewer.canManage) return refusal(403, "errors.insufficientPermissions");

  await ensureDataRoomSchema(database);
  const result = await revokeDataRoomShareLink(ventureId, linkId, database);
  await audit(
    ventureId,
    "DATA_ROOM_SHARE_LINK_REVOKED",
    session,
    { link_id: linkId },
    database,
  );
  return { ok: true, link: result.rows?.[0] };
}

/**
 * Public unauthenticated resolution of an investor share link.
 */
export async function resolvePublicDataRoom({ token, database }) {
  if (!token) return refusal(400, "dataRoom.errors.tokenRequired");

  await ensureDataRoomSchema(database);
  const linkResult = await selectDataRoomShareLinkByToken(token, database);
  const link = linkResult.rows?.[0];
  if (!link) {
    return refusal(404, "dataRoom.errors.linkExpiredOrInvalid");
  }

  // Increment view counter asynchronously
  void incrementDataRoomShareLinkViews(token, database).catch(() => {});

  // Fetch approved/verified documents for this venture
  const docsResult = await selectDataRoomDocuments(link.venture_id, {}, database);
  const rawDocs = docsResult.rows || [];

  // Filter only documents suitable for external diligence
  // (approved/verified or uploaded; exclude deleted)
  const documents = await Promise.all(
    rawDocs.map(async (doc) => {
      const signed = await withSignedUrl(doc);
      return {
        id: signed.id,
        title: signed.title || signed.name,
        category: signed.category,
        description: signed.description,
        file_name: signed.file_name,
        file_type: signed.file_type,
        file_size: signed.file_size,
        file_url_signed: signed.file_url_signed,
        status: signed.review_status || "uploaded",
        created_at: signed.created_at,
        current_version: signed.current_version || 1,
      };
    }),
  );

  return {
    ok: true,
    venture: {
      name: link.company_name,
      stage: link.business_stage,
      industry: link.industry,
      description: link.description,
      logo_url: link.logo_url,
      website: link.website,
    },
    documents,
    link: {
      name: link.name,
      created_at: link.created_at,
      expires_at: link.expires_at,
    },
    investorPoolUrl: FUTURE_STUDIO_INVESTOR_URL,
  };
}

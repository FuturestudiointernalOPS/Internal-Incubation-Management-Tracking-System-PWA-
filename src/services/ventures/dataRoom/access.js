/**
 * Data Room — who may see what, and the catalogue read.
 *
 * This is the one access verdict for the feature. Every route and every
 * mutation asks it, so a listing, a download and a review can never disagree
 * about who the caller is.
 */

import {
  ensureDataRoomSchema,
  selectVentureStage,
  selectDataRoomDocuments,
  selectDataRoomDocument,
  selectDataRoomVersions,
  selectDataRoomGrants,
  selectDataRoomDocumentGrants,
  selectDataRoomGrantForPerson,
  selectDataRoomRequirements,
  insertDataRoomRequirementSeeds,
  updateDataRoomRequirementsForStage,
  selectVentureMembership,
  selectDataRoomActivity,
  selectDataRoomAccessLog,
  selectDataRoomVentureCode,
  insertDataRoomAccessLog,
} from "@/models/ventureDataRoomStore";
import {
  DATA_ROOM_CATEGORIES,
  DATA_ROOM_MAX_FILE_MB,
  defaultRequirementLevel,
  defaultRequirements,
  isDataRoomRequirementLevel,
  requirementStageBucket,
} from "@/lib/dataRoom";
import { isInternalStaffFamilyRole } from "@/lib/identity";
import { canManageVerification } from "@/services/ventures/verification/categories";
import {
  hasAnyVentureAssignment,
  hasVentureCapability,
} from "@/services/ventures/permissions";
import { resolveInvestorScope } from "@/models/authorization/investorScope";
import { getAuthorizationContext } from "@/models/authorization/index";
import { refusal, withSignedUrl, withSignedVersion, parseDetails } from "./shared";

// ── Who is asking ───────────────────────────────────────────────────────────

/**
 * The one access verdict for the Data Room.
 *
 *   super admin                     → view + manage + review
 *   venture founder / owner         → view + manage
 *   other venture member            → view (and download)
 *   assigned staff with documents.* → view + manage (edit/upload/manage)
 *   assigned staff with review      → review
 *   investor with a live grant      → view + download, their granted subset only
 *   anyone else                     → refused (404 at the HTTP boundary)
 */
export async function resolveDataRoomViewer({ ventureId, session, database } = {}) {
  if (!session) return { allowed: false, reason: "unauthenticated" };

  const authContext = await getAuthorizationContext(session);
  const superAdmin = Boolean(authContext?.isSuperAdmin);
  const internalStaff = isInternalStaffFamilyRole(session.role);
  const cid = session.cid || null;

  let membership = null;
  if (cid) {
    const result = await selectVentureMembership(ventureId, cid, database);
    membership = result.rows?.[0] || null;
  }
  const isMember = Boolean(membership);
  const isFounder = Boolean(
    membership &&
      (membership.member_type === "founder" || membership.lead_founder || membership.is_owner),
  );

  let assigned = false;
  if (cid && internalStaff && !superAdmin) {
    assigned = await hasAnyVentureAssignment({ ventureId, contactId: cid });
  }

  const canView = superAdmin || isMember || assigned;

  let canManage = superAdmin || isFounder;
  if (!canManage && assigned && cid) {
    canManage =
      (await hasVentureCapability({ ventureId, contactId: cid, area: "documents", action: "edit" })) ||
      (await hasVentureCapability({ ventureId, contactId: cid, area: "documents", action: "upload" })) ||
      (await hasVentureCapability({ ventureId, contactId: cid, area: "documents", action: "manage" }));
  }

  let canReview = false;
  if (superAdmin) {
    canReview = true;
  } else if (assigned) {
    canReview =
      (await canManageVerification(ventureId, session).catch(() => ({ allowed: false }))).allowed === true ||
      (cid
        ? await hasVentureCapability({ ventureId, contactId: cid, area: "documents", action: "review" })
        : false);
  }

  if (canView) {
    return {
      allowed: true,
      session,
      viewerType: superAdmin ? "super_admin" : internalStaff ? "staff" : "member",
      isFounder,
      isMember,
      canManage,
      canReview,
      granteeCid: null,
    };
  }

  // ── Explicit investor grant ───────────────────────────────────────────────
  const scope = await resolveInvestorScope(session);
  if (scope.profileId && cid) {
    const grant = await selectDataRoomGrantForPerson(ventureId, cid, database).catch(() => ({ rows: [] }));
    if ((grant.rows || []).length > 0) {
      return {
        allowed: true,
        session,
        viewerType: "investor",
        isFounder: false,
        isMember: false,
        canManage: false,
        canReview: false,
        granteeCid: cid,
      };
    }
  }

  return { allowed: false, reason: "out-of-scope" };
}

// ── Requirements + completeness ─────────────────────────────────────────────

/**
 * The venture's requirement list, seeded from its stage the first time and kept
 * in step with the stage afterwards. A level a person deliberately changed is
 * never overwritten (the row is marked `customized`).
 */
export async function loadDataRoomRequirements(ventureId, database) {
  await ensureDataRoomSchema(database);
  const stageResult = await selectVentureStage(ventureId, database);
  const stage = stageResult.rows?.[0]?.business_stage || "idea";
  const bucket = requirementStageBucket(stage);
  const seeds = defaultRequirements(stage);

  let rows = (await selectDataRoomRequirements(ventureId, database)).rows || [];

  if (rows.length === 0) {
    await insertDataRoomRequirementSeeds(ventureId, seeds, bucket, database);
    rows = (await selectDataRoomRequirements(ventureId, database)).rows || [];
  } else if (rows.some((row) => !row.customized && (row.stage_bucket || null) !== bucket)) {
    await updateDataRoomRequirementsForStage(ventureId, bucket, seeds, database);
    rows = (await selectDataRoomRequirements(ventureId, database)).rows || [];
  }

  const byCategory = new Map(rows.map((row) => [row.category, row]));
  return DATA_ROOM_CATEGORIES.map((category) => {
    const stored = byCategory.get(category.code);
    return {
      category: category.code,
      level: isDataRoomRequirementLevel(stored?.level)
        ? stored.level
        : defaultRequirementLevel(stage, category.code),
      customized: Boolean(stored?.customized),
      note: stored?.note || null,
      counts_toward_readiness:
        (stored?.level || defaultRequirementLevel(stage, category.code)) === "required",
    };
  });
}

/**
 * Data Room completeness.
 *
 * The denominator is ONLY the categories whose requirement level is
 * `required`. Recommended / conditional / not-applicable categories are never
 * counted as missing, so a pre-revenue idea-stage venture is not punished for
 * documents that do not apply to it.
 *
 * Points per required category (the highest result among its documents):
 *   verified → 1 · rejected → 0.5 · anything else / no document → 0
 * The percentage is null when nothing is required (indeterminate, not 100%).
 */
export function computeDataRoomCompleteness(requirements, documents) {
  const list = Array.isArray(documents) ? documents : [];
  const required = (requirements || []).filter((row) => row.level === "required");

  const statusFor = (category) => {
    const entries = list.filter((documentEntry) => documentEntry.category === category);
    if (entries.some((entry) => entry.status === "verified")) return "verified";
    if (entries.some((entry) => entry.status === "rejected")) return "rejected";
    if (entries.some((entry) => entry.status === "under_review")) return "under_review";
    if (entries.some((entry) => entry.status === "uploaded")) return "uploaded";
    if (entries.some((entry) => entry.status === "expired")) return "expired";
    return "missing";
  };

  const pointsFor = (status) => (status === "verified" ? 1 : status === "rejected" ? 0.5 : 0);

  const requirementRows = (requirements || []).map((row) => {
    const status = statusFor(row.category);
    return {
      ...row,
      status,
      documents_count: list.filter((documentEntry) => documentEntry.category === row.category).length,
    };
  });

  let points = 0;
  for (const row of requirementRows) {
    if (row.level !== "required") continue;
    points += pointsFor(row.status);
  }

  const denominator = required.length;
  const percent = denominator > 0 ? Math.round((points / denominator) * 100) : null;

  return {
    total_documents: list.length,
    awaiting_review: list.filter((entry) => entry.status === "uploaded" || entry.status === "under_review").length,
    verified_documents: list.filter((entry) => entry.status === "verified").length,
    rejected_documents: list.filter((entry) => entry.status === "rejected").length,
    expired_documents: list.filter((entry) => entry.status === "expired").length,
    // A rejected document is still uploaded; "missing" means nothing was filed.
    missing_required: requirementRows
      .filter((row) => row.level === "required" && row.status === "missing")
      .map((row) => row.category),
    required_total: denominator,
    readiness_percent: percent,
    is_ready: denominator > 0 && percent === 100,
    requirements: requirementRows,
  };
}

/** Categories with a count, for the sidebar. Empty categories stay listed. */
function categorise(documents, requirements) {
  const levelByCategory = new Map((requirements || []).map((row) => [row.category, row.level]));
  return DATA_ROOM_CATEGORIES.map((category) => {
    const entries = documents.filter((documentEntry) => documentEntry.category === category.code);
    return {
      code: category.code,
      labelKey: category.labelKey,
      label_en: category.label_en,
      label_fr: category.label_fr,
      count: entries.length,
      verified_count: entries.filter((entry) => entry.status === "verified").length,
      level: levelByCategory.get(category.code) || "conditional",
    };
  });
}

// ── Read ────────────────────────────────────────────────────────────────────

/** The whole Data Room as one answer, for a viewer already resolved. */
export async function buildDataRoom({ ventureId, session, access, filters = {}, database }) {
  const viewer = access || (await resolveDataRoomViewer({ ventureId, session, database }));
  if (!viewer.allowed) return refusal(404, "errors.notFound");

  await ensureDataRoomSchema(database);

  const documentsResult = await selectDataRoomDocuments(
    ventureId,
    {
      category: filters.category || null,
      status: filters.status || null,
      search: filters.search || null,
      granteeCid: viewer.granteeCid || null,
    },
    database,
  );

  const documents = await Promise.all((documentsResult.rows || []).map(withSignedUrl));

  const requirements = viewer.granteeCid ? [] : await loadDataRoomRequirements(ventureId, database);
  const completeness = viewer.granteeCid
    ? null
    : computeDataRoomCompleteness(requirements, documents);

  let grants = [];
  if (viewer.canManage || viewer.canReview) {
    const grantResult = await selectDataRoomGrants(ventureId, database);
    grants = grantResult.rows || [];
  }

  let history = [];
  let accessHistory = [];
  if (viewer.canManage || viewer.canReview) {
    const [activityResult, accessResult] = await Promise.all([
      selectDataRoomActivity(ventureId, database).catch(() => ({ rows: [] })),
      selectDataRoomAccessLog(ventureId, { limit: 200 }, database).catch(() => ({ rows: [] })),
    ]);
    history = (activityResult.rows || []).map((row) => ({
      id: row.id,
      action: row.action,
      actor_cid: row.actor_cid,
      actor_name: row.actor_name,
      details: parseDetails(row.details),
      created_at: row.created_at,
    }));
    accessHistory = (accessResult.rows || []).map((row) => ({
      id: row.id,
      document_id: row.document_id,
      document_title: row.document_title || null,
      access_type: row.access_type,
      viewer_name: row.viewer_name || null,
      viewer_email: row.viewer_email || null,
      created_at: row.created_at,
    }));
  }

  return {
    ok: true,
    viewer: {
      type: viewer.viewerType,
      can_manage: viewer.canManage,
      can_review: viewer.canReview,
      can_download: true,
    },
    categories: viewer.granteeCid ? [] : categorise(documents, requirements),
    documents,
    requirements,
    completeness,
    grants,
    history,
    access_history: accessHistory,
    max_file_mb: DATA_ROOM_MAX_FILE_MB,
  };
}

// ── Access journal ──────────────────────────────────────────────────────────

const DATA_ROOM_ACCESS_TYPES = ["view", "download"];

/**
 * Record one explicit consultation or download.
 *
 * This is an AUDIT side effect, never an access decision: the viewer has already
 * been resolved and the document re-read through the same grant rule as the
 * catalogue. A journal write failure is logged and the file still opens — the
 * journal must not become a second way to lose access to a document.
 *
 * The stored Venture key is the readable VNT code, because the existing access
 * table's foreign key is the business key. The document's internal id is resolved
 * to that code first; the caller's own reference is only a fallback.
 */
export async function recordDataRoomAccess({
  ventureId,
  documentId,
  session,
  accessType,
  meta = {},
  database,
} = {}) {
  const viewer = await resolveDataRoomViewer({ ventureId, session, database });
  if (!viewer.allowed) return refusal(404, "errors.notFound");

  const type = String(accessType || "");
  if (!DATA_ROOM_ACCESS_TYPES.includes(type)) {
    return refusal(400, "dataRoom.errors.invalidAccessType");
  }
  if (!documentId) return refusal(404, "errors.notFound");

  const result = await selectDataRoomDocument(
    ventureId,
    documentId,
    { granteeCid: viewer.granteeCid || null },
    database,
  );
  const document = result.rows?.[0];
  if (!document) return refusal(404, "errors.notFound");

  let ventureCode = null;
  try {
    const codeResult = await selectDataRoomVentureCode(document.venture_id, database);
    ventureCode = codeResult.rows?.[0]?.venture_id || null;
  } catch (_) {
    ventureCode = null;
  }
  if (!ventureCode && /^VNT-/i.test(String(ventureId || ""))) {
    ventureCode = String(ventureId);
  }
  if (!ventureCode) return { ok: true, recorded: false };

  try {
    await insertDataRoomAccessLog(
      {
        documentId: document.id,
        ventureCode,
        accessType: type,
        viewerEmail: session?.email || null,
        viewerName: session?.name || null,
        ipAddress: meta.ip || null,
        userAgent: meta.userAgent || null,
      },
      database,
    );
    return { ok: true, recorded: true };
  } catch (error) {
    console.error("[data-room-access] journal write failed:", error?.message || error);
    return { ok: true, recorded: false };
  }
}

/** One document with its versions and (for managers) its live grants. */
export async function loadDataRoomDocument({ ventureId, documentId, session, access, database }) {
  const viewer = access || (await resolveDataRoomViewer({ ventureId, session, database }));
  if (!viewer.allowed) return refusal(404, "errors.notFound");

  await ensureDataRoomSchema(database);

  const result = await selectDataRoomDocument(
    ventureId,
    documentId,
    { granteeCid: viewer.granteeCid || null },
    database,
  );
  const row = result.rows?.[0];
  if (!row) return refusal(404, "errors.notFound");

  const documentEntry = await withSignedUrl(row);
  const versionsResult = await selectDataRoomVersions(ventureId, documentId, database);
  const versions = await Promise.all(
    (versionsResult.rows || []).map(async (version) => {
      const signed = await withSignedVersion(version);
      return { ...signed, version_number: version.version_number || version.version || 1 };
    }),
  );

  let grants = [];
  if (viewer.canManage || viewer.canReview) {
    const grantsResult = await selectDataRoomDocumentGrants(ventureId, documentId, database);
    grants = grantsResult.rows || [];
  }

  return {
    ok: true,
    document: { ...documentEntry, versions },
    grants,
    viewer: {
      type: viewer.viewerType,
      can_manage: viewer.canManage,
      can_review: viewer.canReview,
      can_download: true,
    },
  };
}


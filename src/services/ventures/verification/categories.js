/**
 * verification — Verification categories and who may manage / submit.
 *
 * Part of `services/ventures/verification` (split out of the former single
 * 487-line module, lane L2; code moved verbatim). The public surface is
 * re-exported unchanged by `src/services/ventures/verification.js`.
 */
import { DEFAULT_VENTURE_DOCUMENT_TYPES } from "@/lib/ventureDocumentTypeDefaults";
import { canManageVentureDocumentTypes, listActiveVentureDocumentTypesOrDefaults } from "@/models/ventureDocumentTypes";
import { selectVerificationFounderIdByEmail } from "@/models/ventureVerificationStore";

/**
 * The document types the Data bank asks for now live in `venture_document_types`
 * (see the model) and are defined by a Super Admin or a Lead Manager. These two
 * exports are the built-in seed, kept as the load-bearing fallback for a
 * database whose configuration table cannot be read.
 */
export const VERIFICATION_CATEGORIES = DEFAULT_VENTURE_DOCUMENT_TYPES.map(
  (documentType) => documentType.code,
);

export const VERIFICATION_CATEGORY_LABELS = Object.fromEntries(
  DEFAULT_VENTURE_DOCUMENT_TYPES.map((documentType) => [documentType.code, documentType.label_en]),
);

/**
 * The codes a document may be filed under right now FOR ONE VENTURE: the
 * types its Data bank asks for, falling back to the built-in set. Used to refuse
 * a document filed under an unknown (or retired) type.
 */
export async function resolveActiveDocumentTypeCodes(ventureId) {
  const types = await listActiveVentureDocumentTypesOrDefaults(ventureId);
  return (types || []).map((documentType) => documentType.code);
}

/**
 * Check if user can manage verification (review/submit for others).
 */
export async function canManageVerification(ventureId, session) {
  if (!session) return { allowed: false };
  if (session.role === "super_admin") return { allowed: true, isReviewer: true };
  if (session.role === "verification_officer") return { allowed: true, isReviewer: true };
  // The Data bank sign-off belongs to whoever leads the WHOLE Venture — the
  // Super Admin, or its Lead Manager. This is the same rule that lets them
  // define the Venture's Data bank documents, so the two doors agree. A scoped
  // coach reviews the milestones they were given, not the Venture's compliance
  // file, so a milestone/task-scoped assignment is deliberately not enough.
  if (session.role === "staff") {
    // Assignments key on the VNT code; the rule above is asked of the code, so
    // an internal id in the URL is resolved first.
    const { resolveVentureCode } = await import("@/lib/ventureScope");
    const code = await resolveVentureCode(ventureId);
    if (code && (await canManageVentureDocumentTypes(session, code))) {
      return { allowed: true, isReviewer: true };
    }
  }
  return { allowed: false };
}

/**
 * Check if user can submit verification (founder).
 */
export async function canSubmitVerification(ventureId, session) {
  if (!session) return false;
  if (session.role === "super_admin") return true;

  const founderRes = await selectVerificationFounderIdByEmail(ventureId, session.email || "");
  return founderRes.rows.length > 0;
}

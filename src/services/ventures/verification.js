/**
 * VENTURE VERIFICATION (the Data bank).
 *
 * The compliance file of a Venture: the verification record and its items, the
 * founder submission / reviewer sign-off / resubmission flows, the document
 * uploads and their version history, and the comments.
 *
 * The decisions — who may manage the sign-off or submit, which document types
 * are asked for, the missing-document gate, the status transitions and the
 * version numbering — live here; every statement is in
 * `@/models/ventureVerificationStore`. Nothing here runs SQL.
 *
 * Re-exported unchanged through `@/lib/ventures` (the module it came from) —
 * see docs/LAYER_SPLIT.md.
 *
 * Split (lane L2): the code lives in `./verification/` — categories, workflow, versions.
 * This file re-exports the same public surface (named + default when there is
 * one), so importers and tests are unchanged.
 */

export {
  VERIFICATION_CATEGORIES,
  VERIFICATION_CATEGORY_LABELS,
  canManageVerification,
  canSubmitVerification,
} from "./verification/categories";
export {
  getOrCreateVerification,
  submitVerification,
  updateVerificationStatus,
  resubmitVerification,
  uploadVerificationDocument,
  deleteVerificationDocument,
} from "./verification/workflow";
export {
  listVerificationDocumentVersions,
  addVerificationDocumentVersion,
  addVerificationComment,
} from "./verification/versions";


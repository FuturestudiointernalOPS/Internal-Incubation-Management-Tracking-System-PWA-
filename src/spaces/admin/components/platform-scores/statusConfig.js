/**
 * The status → label/colour map shared by the platform-scores filters and rows.
 * Extracted verbatim from ScoresPage.
 */
export const STATUS_CONFIG = {
  submitted: { label: "adminMisc.platformScores.statusSubmitted", color: "text-amber-500", bg: "bg-amber-500/10" },
  approved: { label: "adminMisc.platformScores.statusApproved", color: "text-emerald-500", bg: "bg-emerald-500/10" },
  rejected: { label: "adminMisc.platformScores.statusRejected", color: "text-rose-500", bg: "bg-rose-500/10" },
  revision_requested: { label: "adminMisc.platformScores.statusRevision", color: "text-blue-500", bg: "bg-blue-500/10" },
  draft: { label: "adminMisc.platformScores.statusDraft", color: "text-slate-500", bg: "bg-slate-500/10" },
};

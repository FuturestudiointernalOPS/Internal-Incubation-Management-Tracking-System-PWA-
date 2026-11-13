export const STATUS_CONFIG = {
  draft: { label: "vadmin.verification.statusDraft", color: "text-slate-400 bg-slate-500/10", dot: "bg-slate-400" },
  pending_review: { label: "vadmin.verification.statusPendingReview", color: "text-amber-400 bg-amber-500/10", dot: "bg-amber-400" },
  verified: { label: "vadmin.verification.statusVerified", color: "text-emerald-400 bg-emerald-500/10", dot: "bg-emerald-400" },
  rejected: { label: "vadmin.verification.statusRejected", color: "text-rose-400 bg-rose-500/10", dot: "bg-rose-400" },
  suspended: { label: "vadmin.verification.statusSuspended", color: "text-red-400 bg-red-500/10", dot: "bg-red-400" },
};

export const ITEM_STATUS_CONFIG = {
  pending: { label: "vadmin.verification.itemStatusPending", color: "text-slate-400 bg-slate-500/10" },
  under_review: { label: "vadmin.verification.itemStatusUnderReview", color: "text-amber-400 bg-amber-500/10" },
  verified: { label: "vadmin.verification.statusVerified", color: "text-emerald-400 bg-emerald-500/10" },
  rejected: { label: "vadmin.verification.statusRejected", color: "text-rose-400 bg-rose-500/10" },
  not_applicable: { label: "vadmin.verification.itemStatusNotApplicable", color: "text-slate-500 bg-slate-500/5" },
};

export function VerificationStatusBadge({ status, t }) {
  const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  return (
    <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${statusConfig.color} flex items-center gap-1.5 w-fit`}>
      <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
      {t(statusConfig.label)}
    </span>
  );
}

export function VerificationItemStatusBadge({ status, t }) {
  const itemStatusConfig = ITEM_STATUS_CONFIG[status] || ITEM_STATUS_CONFIG.pending;
  return <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${itemStatusConfig.color}`}>{t(itemStatusConfig.label)}</span>;
}

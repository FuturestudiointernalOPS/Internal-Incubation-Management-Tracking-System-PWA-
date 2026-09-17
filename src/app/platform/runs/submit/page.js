"use client";

import { useRouter } from "next/navigation";
import {
  Loader2, FileText, Send, Clock,
  RotateCcw, AlertTriangle, ArrowLeft, Play,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";

const cn = (...classes) => classes.filter(Boolean).join(" ");

const SUB_STATUS = {
  draft: { color: "text-slate-500", bg: "bg-slate-500/10", label: "Draft" },
  submitted: { color: "text-blue-500", bg: "bg-blue-500/10", label: "Submitted" },
  approved: { color: "text-emerald-500", bg: "bg-emerald-500/10", label: "Approved" },
  rejected: { color: "text-rose-500", bg: "bg-rose-500/10", label: "Rejected" },
  revision_requested: { color: "text-amber-500", bg: "bg-amber-500/10", label: "Revision" },
};

const STATUS_KEYS = {
  draft: "platformMisc.runSubmit.statusDraft",
  submitted: "platformMisc.runSubmit.statusSubmitted",
  approved: "platformMisc.runSubmit.statusApproved",
  rejected: "platformMisc.runSubmit.statusRejected",
  revision_requested: "platformMisc.runSubmit.statusRevision",
};

export default function MySubmissionsPage() {
  const router = useRouter();
  const { t } = useI18n();
  // The loader's work — painting from the cache first, discarding a stale
  // response, the background refresh — belongs to the hook, so the screen keeps
  // no list state of its own and never sets state from an effect. The read is
  // kept raw here because its failure payload carries the message the screen
  // shows.
  const { data, loading, error: fetchError } = useApi(
    "/api/platform/form-runs?my_submissions=true",
  );
  const submissions = data?.success ? data.submissions || [] : [];
  // The "could not load" banner is derived from the payload rather than written
  // by the loader, so a rejected read and an unreachable one still read the same
  // way on screen.
  const error = data && !data.success
    ? t(data.error || "platformMisc.runSubmit.loadFailed")
    : fetchError
      ? t(fetchError) || fetchError
      : null;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-secondary border-b border-[var(--border-primary)]">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.push("/platform")} className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" /> {t("platformMisc.runSubmit.platform")}
          </button>
          <span className="text-[var(--text-secondary)] opacity-30">|</span>
          <FileText className="w-4 h-4 text-[var(--brand-orange)]" />
          <h1 className="text-sm font-black uppercase text-[var(--text-primary)]">{t("platformMisc.runSubmit.title")}</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-5 h-5 animate-spin text-[var(--brand-orange)]" />
          </div>
        ) : error ? (
          <div className="py-16 text-center space-y-3">
            <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
            <p className="text-[11px] font-bold text-[var(--text-primary)]">{error}</p>
          </div>
        ) : submissions.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <FileText className="w-8 h-8 mx-auto text-[var(--text-secondary)] opacity-30" />
            <p className="text-sm text-[var(--text-secondary)]">{t("platformMisc.runSubmit.noSubmissions")}</p>
            <p className="text-[10px] font-medium text-[var(--text-secondary)]">{t("platformMisc.runSubmit.noSubmissionsHint")}</p>
          </div>
        ) : (
          submissions.map((sub) => {
            const sc = SUB_STATUS[sub.status] || SUB_STATUS.draft;
            return (
              <div
                key={sub.id}
                onClick={() => router.push(`/platform/runs/submit/${sub.run_id}`)}
                className="p-4 rounded-2xl bg-secondary border border-[var(--border-primary)] hover:border-[var(--brand-orange)]/50 transition-all cursor-pointer space-y-2"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-[var(--brand-orange)]/10 flex items-center justify-center">
                      <Play className="w-4 h-4 text-[var(--brand-orange)]" />
                    </div>
                    <div>
                      <h3 className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-primary)]">{sub.run_name || t("platformMisc.runSubmit.formRunNumber", { id: sub.run_id })}</h3>
                      <p className="text-[10px] font-medium text-[var(--text-secondary)]">{t("platformMisc.runSubmit.id", { id: sub.run_id })}</p>
                    </div>
                  </div>
                  <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase", sc.color, sc.bg)}>{t(STATUS_KEYS[sub.status] || STATUS_KEYS.draft)}</span>
                </div>
                <div className="flex items-center gap-3 text-[10px] font-medium text-[var(--text-secondary)]">
                  {sub.submitted_at && (
                    <span className="flex items-center gap-1">
                      <Send className="w-2.5 h-2.5" />
                      {t("platformMisc.runSubmit.submittedOn", { date: new Date(sub.submitted_at).toLocaleDateString() })}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    {t("platformMisc.runSubmit.updatedOn", { date: new Date(sub.updated_at).toLocaleDateString() })}
                  </span>
                </div>
                {sub.status === "draft" && (
                  <p className="text-[10px] font-bold text-amber-500 flex items-center gap-1">
                    <AlertTriangle className="w-2.5 h-2.5" />
                    {t("platformMisc.runSubmit.incomplete")}
                  </p>
                )}
                {sub.status === "revision_requested" && (
                  <p className="text-[10px] font-bold text-amber-500 flex items-center gap-1">
                    <RotateCcw className="w-2.5 h-2.5" />
                    {t("platformMisc.runSubmit.revisionRequested")}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

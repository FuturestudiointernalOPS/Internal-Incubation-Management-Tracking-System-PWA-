import { AlertTriangle, CheckCircle2, FileText, Hash, RotateCcw, Send, XCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "./helpers";

export default function OverviewStats({ ctx }) {
  const { t } = useI18n();
  const { approved, drafts, overdue, rejected, revision, setSubFilter, subFilter, submitted, subtotal } = ctx;
  return (
    <>
              {/* Stats cards */}
              <div className="grid grid-cols-4 md:grid-cols-7 gap-3">
                {[
                  { label: t("platformMisc.runs.total"), value: subtotal, filter: "all", icon: Hash, color: "text-[var(--text-primary)]" },
                  { label: t("platformMisc.runs.statusSubmitted"), value: submitted, filter: "submitted", icon: Send, color: "text-blue-500" },
                  { label: t("platformMisc.runs.statusApproved"), value: approved, filter: "approved", icon: CheckCircle2, color: "text-emerald-500" },
                  { label: t("platformMisc.runs.statusRejected"), value: rejected, filter: "rejected", icon: XCircle, color: "text-rose-500" },
                  { label: t("platformMisc.runs.statusRevision"), value: revision, filter: "revision_requested", icon: RotateCcw, color: "text-amber-500" },
                  { label: t("platformMisc.runs.drafts"), value: drafts, filter: "draft", icon: FileText, color: "text-slate-500" },
                  ...(overdue > 0 ? [{ label: t("platformMisc.runs.overdue"), value: overdue, filter: "submitted", icon: AlertTriangle, color: "text-rose-500" }] : []),
                ].map((statCard) => (
                  <button
                    key={statCard.label}
                    onClick={() => setSubFilter(subFilter === statCard.filter ? "all" : statCard.filter)}
                    className={cn(
                      "p-4 rounded-2xl border text-center transition-all",
                      subFilter === statCard.filter
                        ? "bg-brand-orange/10 border-[var(--brand-orange)]"
                        : "bg-secondary border-[var(--border-primary)] hover:border-[var(--text-secondary)]"
                    )}
                  >
                    <p className={cn("text-2xl font-black", statCard.color)}>{statCard.value}</p>
                    <div className="flex items-center justify-center gap-1 mt-0.5"><statCard.icon className={cn("w-2.5 h-2.5", statCard.color)} /><p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{statCard.label}</p></div>
                  </button>
                ))}
              </div>
    </>
  );
}

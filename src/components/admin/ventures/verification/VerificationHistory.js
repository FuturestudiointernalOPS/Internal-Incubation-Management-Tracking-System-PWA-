import { AlertCircle, CheckCircle2, Clock } from "lucide-react";

export default function VerificationHistory({ history, t }) {
  if (!(history.length > 0)) return null;
  return (
    <div className="card">
      <h3 className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide mb-4">{t("vadmin.verification.activityTimeline")}</h3>
      <div className="space-y-3">
        {history.map((entry, index) => (
          <div key={entry.id || index} className="flex items-start gap-4 p-3 rounded-lg bg-tertiary border border-[var(--border-primary)]">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              entry.action.includes("APPROVED") || entry.action.includes("VERIFIED") ? "bg-emerald-500/10 text-emerald-500" :
              entry.action.includes("REJECTED") || entry.action.includes("SUSPENDED") ? "bg-rose-500/10 text-rose-500" :
              "bg-amber-500/10 text-amber-500"
            }`}>
              {entry.action.includes("APPROVED") || entry.action.includes("VERIFIED") ? <CheckCircle2 className="w-4 h-4" /> :
               entry.action.includes("REJECTED") || entry.action.includes("SUSPENDED") ? <AlertCircle className="w-4 h-4" /> :
               <Clock className="w-4 h-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[11px] font-bold text-[var(--text-primary)]">{entry.action.replace(/_/g, " ")}</p>
                <span className="text-[10px] text-[var(--text-secondary)]">{t("vadmin.verification.byActor", { name: entry.actor_name || t("vadmin.verification.system") })}</span>
              </div>
              <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">{entry.previous_status} → {entry.new_status}</p>
              {entry.notes && <p className="text-sm text-[var(--text-secondary)] mt-1">{entry.notes}</p>}
              <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">{new Date(entry.created_at).toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

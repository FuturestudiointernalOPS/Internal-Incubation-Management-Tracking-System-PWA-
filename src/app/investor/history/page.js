"use client";

import { useState, useEffect } from "react";
import {
  Clock, TrendingUp, DollarSign, Target, XCircle, Download,
  FileText, Loader2, Building2, ArrowLeft, CheckCircle2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import AppCard from "@/components/ui/AppCard";
import AppButton from "@/components/ui/AppButton";
import { useI18n } from "@/lib/i18n";

const DECISION_COLORS = {
  invest: "bg-emerald-500/10 text-emerald-400",
  decline: "bg-rose-500/10 text-rose-400",
  continue_discussions: "bg-amber-500/10 text-amber-400",
  revisit_later: "bg-blue-500/10 text-blue-400",
};

const DECISION_LABELS = {
  invest: "Invested",
  decline: "Declined",
  continue_discussions: "Continue Discussions",
  revisit_later: "Revisit Later",
};

const STAGE_COLORS = {
  interested: "text-slate-400", watching: "text-blue-400",
  meeting_requested: "text-amber-400", due_diligence: "text-purple-400",
  negotiation: "text-orange-400", invested: "text-emerald-400", declined: "text-rose-400",
};

export default function InvestmentHistoryPage() {
  const router = useRouter();
  const [decisions, setDecisions] = useState([]);
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/investor/decisions");
      const data = await res.json();
      if (data.success) {
        setDecisions(data.decisions || []);
        setHistory(data.history || []);
        setStats(data.stats || {});
      }
    } catch (_) {}
    setLoading(false);
  };

  const exportCSV = () => {
    const headers = "Venture,Industry,Stage,Decision,Amount,Date\n";
    const rows = history.map(h =>
      `"${h.venture_name || ""}","${h.decision_type || h.stage}","${h.stage}","${h.decision_type ? DECISION_LABELS[h.decision_type] : ""}","${h.investment_amount || ""}","${h.decision_date || h.stage_changed_at || ""}"`
    ).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "investment_history.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify({ decisions, history, stats }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "investment_report.json"; a.click();
    URL.revokeObjectURL(url);
  };

  const exportPrintable = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const html = `<!DOCTYPE html><html><head><title>Investment Report</title><style>body{font-family:Arial;padding:40px;color:#333}h1{font-size:20px;text-transform:uppercase}h2{font-size:14px;color:#f60;margin-top:24px}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #ddd;padding:8px;font-size:12px;text-align:left}th{background:#f5f5f5}.amount{text-align:right}.stat{display:inline-block;margin:0 24px 12px 0}.stat span{font-size:24px;font-weight:bold;color:#f60}</style></head><body><h1>Investment Report</h1><p>Generated: ${new Date().toLocaleDateString()}</p><h2>Summary</h2><div><div class="stat"><span>${stats.total_decisions||0}</span> Decisions</div><div class="stat"><span>${stats.total_invested||0}</span> Invested</div><div class="stat"><span>$${(stats.total_capital||0).toLocaleString()}</span> Capital</div></div><h2>Decisions</h2><table><tr><th>Venture</th><th>Decision</th><th>Amount</th><th>Date</th></tr>${decisions.map(d=>`<tr><td>${d.venture_name||""}</td><td>${DECISION_LABELS[d.decision_type]||d.decision_type}</td><td class="amount">${d.investment_amount?"$"+Number(d.investment_amount).toLocaleString():"—"}</td><td>${new Date(d.decision_date).toLocaleDateString()}</td></tr>`).join("")}</table><h2>Activity Timeline</h2><table><tr><th>Venture</th><th>Stage</th><th>Date</th><th>Notes</th></tr>${history.map(h=>`<tr><td>${h.venture_name||""}</td><td>${h.stage?.replace(/_/g," ")||""}</td><td>${new Date(h.stage_changed_at||h.created_at).toLocaleDateString()}</td><td>${h.notes||(h.decision_type?DECISION_LABELS[h.decision_type]:"")}</td></tr>`).join("")}</table></body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  if (loading) {
    return <DashboardLayout role="investor"><div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[var(--brand-orange)]" /></div></DashboardLayout>;
  }

  return (
    <DashboardLayout role="investor">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="p-2 hover:text-[var(--brand-orange)]"><ArrowLeft className="w-5 h-5" /></button>
            <div>
              <h1 className="text-xl font-black text-[var(--text-primary)] uppercase tracking-tighter">Investment History</h1>
              <p className="text-xs text-[var(--text-secondary)]">Decisions, timeline & reports</p>
            </div>
          </div>
          <div className="flex gap-2">
            <AppButton variant="secondary" size="sm" icon={Download} onClick={exportCSV}>CSV</AppButton>
            <AppButton variant="secondary" size="sm" icon={Download} onClick={exportJSON}>JSON</AppButton>
            <AppButton variant="secondary" size="sm" icon={FileText} onClick={exportPrintable}>Printable</AppButton>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Decisions", value: stats.total_decisions || 0, icon: Target, color: "text-[var(--brand-orange)]" },
            { label: "Invested", value: stats.total_invested || 0, icon: TrendingUp, color: "text-emerald-400" },
            { label: "Total Capital", value: `$${(stats.total_capital || 0).toLocaleString()}`, icon: DollarSign, color: "text-[var(--brand-orange)]" },
            { label: "Declined", value: stats.total_declined || 0, icon: XCircle, color: "text-rose-400" },
          ].map((s, i) => (
            <AppCard key={i} padding="md">
              <div className="flex items-center gap-3">
                <s.icon className={`w-5 h-5 ${s.color}`} />
                <div>
                  <p className="text-xl font-black text-[var(--text-primary)]">{s.value}</p>
                  <p className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">{s.label}</p>
                </div>
              </div>
            </AppCard>
          ))}
        </div>

        {/* Decisions */}
        {decisions.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-black text-[var(--text-primary)] uppercase">Decisions</h3>
            {decisions.map(d => (
              <AppCard key={d.id} padding="md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Building2 className="w-8 h-8 text-[var(--brand-orange)]/60" />
                    <div>
                      <p className="text-sm font-bold text-[var(--text-primary)]">{d.venture_name || "Venture"}</p>
                      <p className="text-[10px] text-[var(--text-secondary)]">{d.industry || ""}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    <div>
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${DECISION_COLORS[d.decision_type] || "bg-slate-500/10 text-slate-400"}`}>
                        {DECISION_LABELS[d.decision_type] || d.decision_type}
                      </span>
                      {d.investment_amount && (
                        <p className="text-xs font-bold text-emerald-400 mt-1">${Number(d.investment_amount).toLocaleString()}</p>
                      )}
                    </div>
                    <span className="text-[10px] text-[var(--text-tertiary)]">{new Date(d.decision_date).toLocaleDateString()}</span>
                  </div>
                </div>
              </AppCard>
            ))}
          </div>
        )}

        {/* Timeline */}
        <div className="space-y-3">
          <h3 className="text-sm font-black text-[var(--text-primary)] uppercase">Activity Timeline</h3>
          {history.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-10 h-10 text-[var(--text-tertiary)] mx-auto mb-3" />
              <p className="text-sm font-bold text-[var(--text-secondary)]">No activity yet</p>
            </div>
          ) : (
            <div className="relative pl-8 space-y-4 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-px before:bg-[var(--border-primary)]">
              {history.map((h, i) => (
                <div key={i} className="relative">
                  <div className={`absolute -left-[25px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-[var(--surface-1)] ${STAGE_COLORS[h.stage]?.replace("text-", "bg-") || "bg-slate-400"}`} />
                  <AppCard padding="sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-[var(--text-primary)]">
                          {h.venture_name || "Venture"} — <span className={STAGE_COLORS[h.stage] || "text-slate-400"}>{h.stage?.replace(/_/g, " ")}</span>
                        </p>
                        {h.notes && <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">{h.notes}</p>}
                        {h.decision_type && (
                          <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[8px] font-black uppercase ${DECISION_COLORS[h.decision_type]}`}>
                            {DECISION_LABELS[h.decision_type]}
                            {h.investment_amount ? ` — $${Number(h.investment_amount).toLocaleString()}` : ""}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-[var(--text-tertiary)] shrink-0">{new Date(h.stage_changed_at || h.created_at).toLocaleDateString()}</span>
                    </div>
                  </AppCard>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

"use client";

import { useState, useEffect } from "react";
import {
  Building2, Target, TrendingUp, DollarSign, Calendar, Loader2, ArrowLeft, BarChart3,
} from "lucide-react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import AppCard from "@/components/ui/AppCard";
import AppButton from "@/components/ui/AppButton";

export default function PortfolioPage() {
  const router = useRouter();
  const [pipeline, setPipeline] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Dashboard includes pipeline
      const dash = await fetch("/api/investor/dashboard");
      const dashData = await dash.json();
      if (dashData.success) {
        setPipeline(dashData.pipeline?.filter(p => p.stage === "invested") || []);
      }
      // Decisions for details
      const dec = await fetch("/api/investor/decisions");
      const decData = await dec.json();
      if (decData.success) {
        setDecisions(decData.decisions || []);
        setStats(decData.stats || {});
      }
    } catch (_) {}
    setLoading(false);
  };

  const getDecision = (ventureId) => decisions.find(d => d.venture_id === ventureId);

  if (loading) {
    return <DashboardLayout role="investor"><div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[var(--brand-orange)]" /></div></DashboardLayout>;
  }

  return (
    <DashboardLayout role="investor">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 hover:text-[var(--brand-orange)]"><ArrowLeft className="w-5 h-5" /></button>
          <div>
            <h1 className="text-xl font-black text-[var(--text-primary)] uppercase tracking-tighter">Portfolio</h1>
            <p className="text-xs text-[var(--text-secondary)]">Your invested ventures</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { label: "Invested", value: pipeline.length, icon: Target, color: "text-emerald-400" },
            { label: "Total Capital", value: `$${(stats.total_capital || 0).toLocaleString()}`, icon: DollarSign, color: "text-[var(--brand-orange)]" },
            { label: "Decisions", value: stats.total_decisions || 0, icon: BarChart3, color: "text-purple-400" },
          ].map((s, i) => (
            <AppCard key={i} padding="md">
              <div className="flex items-center gap-3">
                <s.icon className={`w-5 h-5 ${s.color}`} />
                <div><p className="text-xl font-black text-[var(--text-primary)]">{s.value}</p><p className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">{s.label}</p></div>
              </div>
            </AppCard>
          ))}
        </div>

        {selected ? (
          /* Company Detail */
          <div className="space-y-4">
            <button onClick={() => setSelected(null)}
              className="text-xs font-bold text-[var(--brand-orange)] hover:underline uppercase flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" /> Back to portfolio
            </button>
            <AppCard padding="lg">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <Building2 className="w-7 h-7 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-[var(--text-primary)] uppercase">{selected.venture_name}</h2>
                  <p className="text-sm text-emerald-400 font-bold">Invested</p>
                </div>
              </div>
              {(() => {
                const dec = getDecision(selected.venture_id);
                return dec ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: "Decision", value: dec.decision_type },
                      { label: "Date", value: new Date(dec.decision_date).toLocaleDateString() },
                      { label: "Amount", value: dec.investment_amount ? `$${Number(dec.investment_amount).toLocaleString()}` : "—" },
                      { label: "Notes", value: dec.decision_notes || "—" },
                    ].map((m, i) => (
                      <div key={i} className="p-3 rounded-xl bg-[var(--surface-3)]">
                        <p className="text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest">{m.label}</p>
                        <p className="text-xs font-bold text-[var(--text-primary)] mt-1">{m.value}</p>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-xs text-[var(--text-tertiary)]">No decision details available.</p>;
              })()}
            </AppCard>
          </div>
        ) : pipeline.length === 0 ? (
          <div className="text-center py-20">
            <Target className="w-16 h-16 text-[var(--text-tertiary)] mx-auto mb-4" />
            <h2 className="text-lg font-black text-[var(--text-primary)] uppercase mb-2">Portfolio Empty</h2>
            <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto">
              Investments will appear here once you record an "Invest" decision.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {pipeline.map(p => {
              const dec = getDecision(p.venture_id);
              return (
                <AppCard key={p.id} padding="md" hover onClick={() => setSelected(p)}>
                  <div className="flex items-center justify-between cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[var(--text-primary)]">{p.venture_name || "Venture"}</p>
                        <p className="text-[10px] text-[var(--text-secondary)]">Invested · {new Date(p.stage_changed_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    {dec?.investment_amount && (
                      <span className="text-sm font-black text-emerald-400">${Number(dec.investment_amount).toLocaleString()}</span>
                    )}
                  </div>
                </AppCard>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Loader2, CheckCircle2, AlertCircle, X, Plus, Search, RefreshCw,
  Building2, Globe, Linkedin, DollarSign, Target, TrendingUp, Users, Star,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useI18n } from "@/lib/i18n";

export default function VentureInvestorsPage() {
  const { id } = useParams();
  const router = useRouter();
  const { t } = useI18n();
  const [venture, setVenture] = useState(null);
  const [matches, setMatches] = useState([]);
  const [allInvestors, setAllInvestors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [activeView, setActiveView] = useState("matches");
  const [search, setSearch] = useState("");

  // Create investor modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [invForm, setInvForm] = useState({ name: "", email: "", organization: "", industries: "", preferred_stage: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [vRes, mRes, iRes] = await Promise.all([
        fetch(`/api/ventures/${id}`),
        fetch(`/api/ventures/${id}/investors?type=matches`),
        fetch(`/api/ventures/${id}/investors?type=directory`),
      ]);
      const v = await vRes.json(); const m = await mRes.json(); const i = await iRes.json();
      if (v.success) setVenture(v.venture);
      if (m.success) setMatches(m.matches || []);
      if (i.success) setAllInvestors(i.investors || []);
    } catch {} finally { setLoading(false); }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    await fetch(`/api/ventures/${id}/investors`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "generate_matches" }),
    });
    const res = await fetch(`/api/ventures/${id}/investors?type=matches`);
    const d = await res.json();
    if (d.success) setMatches(d.matches || []);
    setGenerating(false);
  };

  const handleUpdateMatch = async (matchId, status) => {
    await fetch(`/api/ventures/${id}/investors`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_match", match_id: matchId, status }),
    });
    fetchAll();
  };

  const handleCreateInvestor = async () => {
    if (!invForm.name.trim() || !invForm.email.trim()) return;
    setSaving(true);
    await fetch(`/api/ventures/${id}/investors`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create_investor", ...invForm, industries: invForm.industries ? invForm.industries.split(",").map((s) => s.trim()) : [] }),
    });
    setSaving(false);
    setShowCreateModal(false);
    setInvForm({ name: "", email: "", organization: "", industries: "", preferred_stage: "" });
    fetchAll();
  };

  const progressBar = (pct) => (
    <div className="w-full bg-tertiary rounded-full h-2 overflow-hidden">
      <div className={`h-full rounded-full ${pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-[var(--brand-orange)]"}`} style={{ width: `${pct}%` }} />
    </div>
  );

  if (loading) return (
    <DashboardLayout role="super_admin"><div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-[var(--brand-orange)]" /></div></DashboardLayout>
  );

  const filteredMatches = matches.filter((m) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return m.investor_name?.toLowerCase().includes(q) || m.organization?.toLowerCase().includes(q);
  });

  return (
    <DashboardLayout role="super_admin">
      <div className="space-y-8 pb-20">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <button onClick={() => router.push(`/admin/ventures/${id}/dashboard`)}
              className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-[var(--text-primary)] transition-all mb-2">
              <ArrowLeft className="w-3 h-3" /> {t("vadmin.investors.backToDashboard")}
            </button>
            <h1 className="text-2xl font-black text-[var(--text-primary)] flex items-center gap-3">
              <Target className="w-6 h-6 text-[var(--brand-orange)]" /> {t("vadmin.investors.title")}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">{venture?.company_name || ""} · {t("vadmin.investors.matches", { count: matches.length })}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleGenerate} disabled={generating}
              className="px-3 py-2 rounded-xl border border-[var(--border-primary)] text-[8px] font-black uppercase tracking-wider hover:bg-tertiary transition-all flex items-center gap-1.5">
              {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} {t("vadmin.investors.generateMatches")}
            </button>
            <button onClick={() => setShowCreateModal(true)} className="px-3 py-2 bg-[var(--brand-orange)] text-black rounded-xl text-[8px] font-black uppercase tracking-wider hover:brightness-110 flex items-center gap-1.5">
              <Plus className="w-3 h-3" /> {t("vadmin.investors.addInvestor")}
            </button>
          </div>
        </div>

        {/* View Tabs */}
        <div className="flex gap-1 border-b border-[var(--border-primary)]">
          {[
            { id: "matches", label: t("vadmin.investors.tabMatches", { count: matches.length }), icon: Target },
            { id: "directory", label: t("vadmin.investors.tabDirectory", { count: allInvestors.length }), icon: Building2 },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveView(tab.id)}
                className={`px-4 py-2.5 text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5 border-b-2 transition-all ${activeView===tab.id?"border-[var(--brand-orange)] text-[var(--brand-orange)]":"border-transparent text-slate-500"}`}>
                <Icon className="w-3 h-3" />{tab.label}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("vadmin.investors.searchPlaceholder")}
            className="w-full pl-12 pr-4 py-3 bg-secondary border border-[var(--border-primary)] rounded-xl text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]" />
        </div>

        {/* Matches View */}
        {activeView === "matches" && (
          <div className="space-y-3">
            {filteredMatches.length === 0 ? (
              <div className="text-center py-16"><Target className="w-12 h-12 text-slate-600 mx-auto mb-3" /><p className="text-sm text-slate-500">{t("vadmin.investors.noMatchesYet")}</p></div>
            ) : (
              filteredMatches.map((m) => (
                <div key={m.id} className="p-5 rounded-2xl bg-tertiary border border-[var(--border-primary)]">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-black shrink-0 ${
                        m.match_score >= 70 ? "bg-emerald-500/20 text-emerald-400" :
                        m.match_score >= 40 ? "bg-amber-500/20 text-amber-400" :
                        "bg-slate-500/10 text-slate-400"
                      }`}>{m.investor_name?.charAt(0) || "?"}</div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-[var(--text-primary)]">{m.investor_name}</p>
                          {m.organization && <span className="text-[8px] text-slate-500">{m.organization}</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-2xl font-black">{m.match_score}</span>
                          <span className="text-[9px] text-slate-500">{t("vadmin.investors.matchScore")}</span>
                        </div>
                        {progressBar(m.match_score)}
                        {/* Match reasons */}
                        {(m.match_reasons || []).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {m.match_reasons.map((r, i) => <span key={i} className="text-[7px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">{r}</span>)}
                          </div>
                        )}
                        {/* Ticket range */}
                        {m.min_ticket && m.max_ticket && (
                          <p className="text-[8px] text-slate-500 mt-1">{t("vadmin.investors.ticket")}: ${parseInt(m.min_ticket).toLocaleString()} — ${parseInt(m.max_ticket).toLocaleString()}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {m.status === "pending" && (
                        <>
                          <button onClick={() => handleUpdateMatch(m.id, "contacted")} className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg text-[7px] font-black uppercase hover:brightness-110">{t("vadmin.investors.contact")}</button>
                          <button onClick={() => handleUpdateMatch(m.id, "rejected")} className="px-3 py-1.5 bg-rose-500/10 text-rose-400 rounded-lg text-[7px] font-black uppercase hover:brightness-110">{t("vadmin.investors.pass")}</button>
                        </>
                      )}
                      {m.status === "contacted" && <span className="text-[8px] font-bold text-amber-400">{t("vadmin.investors.contacted")}</span>}
                      {m.status === "accepted" && <span className="text-[8px] font-bold text-emerald-400">{t("vadmin.investors.accepted")}</span>}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Directory View */}
        {activeView === "directory" && (
          <div className="space-y-2">
            {allInvestors.length === 0 ? (
              <div className="text-center py-16"><Building2 className="w-12 h-12 text-slate-600 mx-auto mb-3" /><p className="text-sm text-slate-500">{t("vadmin.investors.noInvestorsDirectory")}</p></div>
            ) : (
              allInvestors.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between p-4 rounded-xl bg-tertiary border border-[var(--border-primary)]">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-[var(--brand-orange)]/10 flex items-center justify-center text-sm font-black text-[var(--brand-orange)]">{inv.name?.charAt(0)}</div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[var(--text-primary)]">{inv.name}</p>
                      <p className="text-[8px] text-slate-500">{inv.organization || inv.email}</p>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {(inv.industries || []).slice(0, 3).map((ind, i) => <span key={i} className="text-[7px] font-bold px-1 rounded bg-slate-500/10 text-slate-400">{ind}</span>)}
                        {inv.preferred_stage && <span className="text-[7px] font-bold px-1 rounded bg-amber-500/10 text-amber-400 capitalize">{inv.preferred_stage}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {inv.website_url && <a href={inv.website_url} target="_blank" className="p-1.5 text-slate-500 hover:text-[var(--brand-orange)]"><Globe className="w-3.5 h-3.5" /></a>}
                    {inv.linkedin_url && <a href={inv.linkedin_url} target="_blank" className="p-1.5 text-slate-500 hover:text-[var(--brand-orange)]"><Linkedin className="w-3.5 h-3.5" /></a>}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* ── Create Investor Modal ── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-3xl p-8 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-[var(--text-primary)]">{t("vadmin.investors.addInvestor")}</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-white/5 rounded-lg"><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">{t("vadmin.investors.name")}</label>
                  <input value={invForm.name} onChange={(e) => setInvForm((p) => ({ ...p, name: e.target.value }))} className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">{t("vadmin.investors.email")}</label>
                  <input type="email" value={invForm.email} onChange={(e) => setInvForm((p) => ({ ...p, email: e.target.value }))} className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none" />
                </div>
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">{t("vadmin.investors.organization")}</label>
                <input value={invForm.organization} onChange={(e) => setInvForm((p) => ({ ...p, organization: e.target.value }))} className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">{t("vadmin.investors.industriesLabel")}</label>
                  <input value={invForm.industries} onChange={(e) => setInvForm((p) => ({ ...p, industries: e.target.value }))} placeholder={t("vadmin.investors.industriesPlaceholder")} className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">{t("vadmin.investors.preferredStage")}</label>
                  <select value={invForm.preferred_stage} onChange={(e) => setInvForm((p) => ({ ...p, preferred_stage: e.target.value }))} className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none">
                    <option value="">{t("vadmin.investors.stageAny")}</option><option value="idea">{t("vadmin.investors.stageIdea")}</option><option value="validation">{t("vadmin.investors.stageValidation")}</option>
                    <option value="early_traction">{t("vadmin.investors.stageEarlyTraction")}</option><option value="growth">{t("vadmin.investors.stageGrowth")}</option><option value="scaling">{t("vadmin.investors.stageScaling")}</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowCreateModal(false)} className="flex-1 py-3 rounded-xl border border-[var(--border-primary)] text-[9px] font-black uppercase tracking-widest hover:bg-tertiary">{t("vadmin.investors.cancel")}</button>
              <button onClick={handleCreateInvestor} disabled={saving}
                className="flex-1 py-3 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 disabled:opacity-30 flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} {t("vadmin.investors.add")}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

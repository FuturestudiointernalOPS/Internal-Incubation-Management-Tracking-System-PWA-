"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Loader2, CheckCircle2, AlertCircle, X, Plus, Search, RefreshCw,
  Building2, Globe, Linkedin, DollarSign, Target, TrendingUp, Users, Star,
} from "lucide-react";
import { cacheGet, cacheSet } from "@/lib/hooks/useApi";

export default function VentureInvestorsPage() {
  const { id } = useParams();
  const router = useRouter();
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

  const fetchAll = async (bypassCache = false) => {
    const urls = [
      `/api/ventures/${id}`,
      `/api/ventures/${id}/investors?type=matches`,
      `/api/ventures/${id}/investors?type=directory`,
    ];
    const apply = (v, m, i) => {
      if (v.success) setVenture(v.venture);
      if (m.success) setMatches(m.matches || []);
      if (i.success) setAllInvestors(i.investors || []);
    };
    let painted = false;
    setLoading(true);
    try {
      // Cache-first paint: returning to this page renders instantly from
      // fresh snapshots; mutation flows pass bypassCache=true so the
      // investor lists always reflect the last action.
      if (!bypassCache) {
        const cached = urls.map((u) => cacheGet(u));
        if (cached.every((c) => c !== null && c.success)) {
          apply(cached[0], cached[1], cached[2]);
          setLoading(false);
          painted = true;
        }
      }
      const [vRes, mRes, iRes] = await Promise.all([
        fetch(urls[0]),
        fetch(urls[1]),
        fetch(urls[2]),
      ]);
      const v = await vRes.json(); const m = await mRes.json(); const i = await iRes.json();
      if (v.success) cacheSet(urls[0], v);
      if (m.success) cacheSet(urls[1], m);
      if (i.success) cacheSet(urls[2], i);
      apply(v, m, i);
    } catch (e) {
      if (!painted) console.error("Failed to load investors data:", e);
    } finally {
      setLoading(false);
    }
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
    fetchAll(true);
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
    fetchAll(true);
  };

  const progressBar = (pct) => (
    <div className="w-full bg-tertiary rounded-full h-2 overflow-hidden">
      <div className={`h-full rounded-full ${pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-[var(--brand-orange)]"}`} style={{ width: `${pct}%` }} />
    </div>
  );

  if (loading) return (
    <><div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-[var(--brand-orange)]" /></div></>
  );

  const filteredMatches = matches.filter((m) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return m.investor_name?.toLowerCase().includes(q) || m.organization?.toLowerCase().includes(q);
  });

  return (
    <>
      <div className="space-y-8 pb-20">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <button onClick={() => router.push(`/admin/ventures/${id}/dashboard`)}
              className="flex items-center gap-2 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest hover:text-[var(--text-primary)] transition-all mb-2">
              <ArrowLeft className="w-3 h-3" /> Back to Dashboard
            </button>
            <h1 className="text-2xl font-black text-[var(--text-primary)] flex items-center gap-3">
              <Target className="w-6 h-6 text-[var(--brand-orange)]" /> Investor Matching
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">{venture?.company_name || ""} · {matches.length} matches</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleGenerate} disabled={generating}
              className="px-3 py-2 rounded-xl border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-wider hover:bg-tertiary transition-all flex items-center gap-1.5">
              {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Generate Matches
            </button>
            <button onClick={() => setShowCreateModal(true)} className="px-3 py-2 bg-[var(--brand-orange)] text-black rounded-xl text-[10px] font-bold uppercase tracking-wider hover:brightness-110 flex items-center gap-1.5">
              <Plus className="w-3 h-3" /> Add Investor
            </button>
          </div>
        </div>

        {/* View Tabs */}
        <div className="flex gap-1 border-b border-[var(--border-primary)]">
          {[
            { id: "matches", label: `Matches (${matches.length})`, icon: Target },
            { id: "directory", label: `Directory (${allInvestors.length})`, icon: Building2 },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveView(tab.id)}
                className={`px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 border-b-2 transition-all ${activeView===tab.id?"border-[var(--brand-orange)] text-[var(--brand-orange)]":"border-transparent text-[var(--text-secondary)]"}`}>
                <Icon className="w-3 h-3" />{tab.label}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search investors..."
            className="w-full pl-12 pr-4 py-3 bg-secondary border border-[var(--border-primary)] rounded-xl text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]" />
        </div>

        {/* Matches View */}
        {activeView === "matches" && (
          <div className="space-y-3">
            {filteredMatches.length === 0 ? (
              <div className="text-center py-16"><Target className="w-12 h-12 text-slate-600 mx-auto mb-3" /><p className="text-sm text-[var(--text-secondary)]">No matches yet. Click "Generate Matches" to find investors.</p></div>
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
                          {m.organization && <span className="text-[10px] text-[var(--text-secondary)]">{m.organization}</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-2xl font-black">{m.match_score}</span>
                          <span className="text-[10px] text-[var(--text-secondary)]">/100 match</span>
                        </div>
                        {progressBar(m.match_score)}
                        {/* Match reasons */}
                        {(m.match_reasons || []).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {m.match_reasons.map((r, i) => <span key={i} className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">{r}</span>)}
                          </div>
                        )}
                        {/* Ticket range */}
                        {m.min_ticket && m.max_ticket && (
                          <p className="text-[10px] text-[var(--text-secondary)] mt-1">Ticket: ${parseInt(m.min_ticket).toLocaleString()} — ${parseInt(m.max_ticket).toLocaleString()}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {m.status === "pending" && (
                        <>
                          <button onClick={() => handleUpdateMatch(m.id, "contacted")} className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg text-[10px] font-bold uppercase hover:brightness-110">Contact</button>
                          <button onClick={() => handleUpdateMatch(m.id, "rejected")} className="px-3 py-1.5 bg-rose-500/10 text-rose-400 rounded-lg text-[10px] font-bold uppercase hover:brightness-110">Pass</button>
                        </>
                      )}
                      {m.status === "contacted" && <span className="text-[10px] font-bold text-amber-400">Contacted</span>}
                      {m.status === "accepted" && <span className="text-[10px] font-bold text-emerald-400">Accepted</span>}
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
              <div className="text-center py-16"><Building2 className="w-12 h-12 text-slate-600 mx-auto mb-3" /><p className="text-sm text-[var(--text-secondary)]">No investors in directory</p></div>
            ) : (
              allInvestors.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between p-4 rounded-xl bg-tertiary border border-[var(--border-primary)]">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-[var(--brand-orange)]/10 flex items-center justify-center text-sm font-black text-[var(--brand-orange)]">{inv.name?.charAt(0)}</div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[var(--text-primary)]">{inv.name}</p>
                      <p className="text-[10px] text-[var(--text-secondary)]">{inv.organization || inv.email}</p>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {(inv.industries || []).slice(0, 3).map((ind, i) => <span key={i} className="text-[10px] font-bold px-1 rounded bg-slate-500/10 text-slate-400">{ind}</span>)}
                        {inv.preferred_stage && <span className="text-[10px] font-bold px-1 rounded bg-amber-500/10 text-amber-400 capitalize">{inv.preferred_stage}</span>}
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
              <h2 className="text-sm font-black text-[var(--text-primary)]">Add Investor</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-white/5 rounded-lg"><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1.5 block">Name *</label>
                  <input value={invForm.name} onChange={(e) => setInvForm((p) => ({ ...p, name: e.target.value }))} className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1.5 block">Email *</label>
                  <input type="email" value={invForm.email} onChange={(e) => setInvForm((p) => ({ ...p, email: e.target.value }))} className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1.5 block">Organization</label>
                <input value={invForm.organization} onChange={(e) => setInvForm((p) => ({ ...p, organization: e.target.value }))} className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1.5 block">Industries (comma-separated)</label>
                  <input value={invForm.industries} onChange={(e) => setInvForm((p) => ({ ...p, industries: e.target.value }))} placeholder="fintech, saas" className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1.5 block">Preferred Stage</label>
                  <select value={invForm.preferred_stage} onChange={(e) => setInvForm((p) => ({ ...p, preferred_stage: e.target.value }))} className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none">
                    <option value="">Any</option><option value="idea">Idea</option><option value="validation">Validation</option>
                    <option value="early_traction">Early Traction</option><option value="growth">Growth</option><option value="scaling">Scaling</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowCreateModal(false)} className="flex-1 py-3 rounded-xl border border-[var(--border-primary)] text-[9px] font-black uppercase tracking-widest hover:bg-tertiary">Cancel</button>
              <button onClick={handleCreateInvestor} disabled={saving}
                className="flex-1 py-3 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 disabled:opacity-30 flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

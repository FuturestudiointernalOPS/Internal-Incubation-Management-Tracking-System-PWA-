"use client";

import { useState, useEffect } from "react";
import {
  Briefcase, TrendingUp, Star, Eye, BarChart3, Users,
  Building2, Clock, ArrowRight, Loader2, Search, Filter,
  Bookmark, BookmarkCheck, Target, DollarSign, SlidersHorizontal,
  X, ChevronLeft, ExternalLink, GitCompare, Check,
} from "lucide-react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import AppCard from "@/components/ui/AppCard";
import AppButton from "@/components/ui/AppButton";
import GlobalToast from "@/components/ui/GlobalToast";

const PIPELINE_STAGES = [
  "interested", "watching", "meeting_requested",
  "due_diligence", "negotiation", "invested", "declined",
];

const STAGE_COLORS = {
  interested: "bg-slate-500/10 text-slate-400",
  watching: "bg-blue-500/10 text-blue-400",
  meeting_requested: "bg-amber-500/10 text-amber-400",
  due_diligence: "bg-purple-500/10 text-purple-400",
  negotiation: "bg-orange-500/10 text-orange-400",
  invested: "bg-emerald-500/10 text-emerald-400",
  declined: "bg-rose-500/10 text-rose-400",
};

const STAGE_LABELS = {
  interested: "Interested",
  watching: "Watching",
  meeting_requested: "Meeting Requested",
  due_diligence: "Due Diligence",
  negotiation: "Negotiation",
  invested: "Invested",
  declined: "Declined",
};

const INDUSTRY_OPTIONS = ["FinTech","HealthTech","AgriTech","EdTech","CleanTech","Logistics","E-Commerce","SaaS","AI/ML","Renewable Energy"];
const COUNTRY_OPTIONS = ["CD","KE","NG","ZA","GH","RW","UG","TZ","EG","MA"];
const STAGE_OPTIONS = ["Pre-Seed","Seed","Series A","Series B","Growth"];

export default function InvestorDashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [pipeline, setPipeline] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [activeTab, setActiveTab] = useState("discover");
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");

  // Advanced filters
  const [showFilters, setShowFilters] = useState(false);
  const [filterIndustry, setFilterIndustry] = useState([]);
  const [filterCountry, setFilterCountry] = useState([]);
  const [filterStage, setFilterStage] = useState([]);
  const [filterFundingMin, setFilterFundingMin] = useState("");
  const [filterFundingMax, setFilterFundingMax] = useState("");
  const [ventures, setVentures] = useState([]);
  const [venturesTotal, setVenturesTotal] = useState(0);

  // Detail modal
  const [detailVenture, setDetailVenture] = useState(null);
  const [detailPipeline, setDetailPipeline] = useState(null);

  // Comparison
  const [compareList, setCompareList] = useState([]);
  const [showCompare, setShowCompare] = useState(false);

  // Introduction request
  const [showIntroModal, setShowIntroModal] = useState(false);
  const [introVenture, setIntroVenture] = useState(null);
  const [introMessage, setIntroMessage] = useState("");
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => { fetchDashboard(); }, []);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/investor/dashboard");
      const data = await res.json();
      if (data.success) {
        setProfile(data.profile);
        setPipeline(data.pipeline || []);
        setWatchlist(data.watchlist || []);
        setRecommendations(data.recommendations || []);
        setStats(data.stats || {});
      }
    } catch (_) {}
    setLoading(false);
  };

  const addToPipeline = async (ventureId, stage) => {
    setProcessingId(ventureId);
    try {
      const res = await fetch("/api/investor/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venture_id: ventureId, stage }),
      });
      const data = await res.json();
      if (data.success) {
        setToast({ type: "success", message: `Venture ${STAGE_LABELS[stage]}` });
        fetchDashboard();
      }
    } catch (_) {} finally {
      setProcessingId(null);
    }
  };

  const toggleWatchlist = async (ventureId) => {
    setProcessingId(ventureId);
    try {
      const res = await fetch("/api/investor/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venture_id: ventureId }),
      });
      const data = await res.json();
      if (data.success) {
        setToast({ type: "success", message: data.action === "added" ? "Added to watchlist" : "Removed from watchlist" });
        fetchDashboard();
      }
    } catch (_) {} finally {
      setProcessingId(null);
    }
  };

  // Advanced venture search with filters
  const searchVentures = async (overrides = {}) => {
    const s = overrides.search !== undefined ? overrides.search : search;
    const ind = overrides.industry !== undefined ? overrides.industry : filterIndustry;
    const cnt = overrides.country !== undefined ? overrides.country : filterCountry;
    const stg = overrides.stage !== undefined ? overrides.stage : filterStage;
    const min = overrides.fundingMin !== undefined ? overrides.fundingMin : filterFundingMin;
    const max = overrides.fundingMax !== undefined ? overrides.fundingMax : filterFundingMax;
    const params = new URLSearchParams();
    if (s) params.set("search", s);
    if (ind.length) params.set("industry", ind.join(","));
    if (cnt.length) params.set("country", cnt.join(","));
    if (stg.length) params.set("stage", stg.join(","));
    if (min) params.set("funding_min", min);
    if (max) params.set("funding_max", max);
    try {
      const res = await fetch(`/api/investor/ventures?${params}`);
      const data = await res.json();
      if (data.success) {
        setVentures(data.ventures || []);
        setVenturesTotal(data.total || 0);
      }
    } catch (_) {}
  };

  // Open venture detail
  const openVentureDetail = async (venture) => {
    setDetailVenture(venture);
    try {
      const res = await fetch(`/api/investor/pipeline?venture_id=${venture.id}`);
      const data = await res.json();
      if (data.success && data.pipeline?.length > 0) {
        setDetailPipeline(data.pipeline[0]);
      } else {
        setDetailPipeline(null);
      }
    } catch (_) { setDetailPipeline(null); }
  };

  // Toggle comparison
  const toggleCompare = (venture) => {
    setCompareList(prev =>
      prev.find(v => v.id === venture.id)
        ? prev.filter(v => v.id !== venture.id)
        : prev.length < 4 ? [...prev, venture] : prev
    );
  };

  if (loading) {
    return (
      <DashboardLayout role="investor">
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--brand-orange)]" />
        </div>
      </DashboardLayout>
    );
  }

  if (!profile || profile.approval_status !== "approved") {
    return (
      <DashboardLayout role="investor">
        <div className="max-w-2xl mx-auto py-20 text-center space-y-6">
          <Building2 className="w-16 h-16 text-[var(--text-tertiary)] mx-auto" />
          <h2 className="text-2xl font-black text-[var(--text-primary)] uppercase">
            {!profile ? "Complete Your Investor Profile" : "Account Pending Approval"}
          </h2>
          <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto">
            {!profile
              ? "Create your investor profile to access venture discovery and investment opportunities."
              : "Your investor account is under review. You'll be notified once approved."}
          </p>
          {!profile && (
            <AppButton variant="primary" onClick={() => router.push("/investor/onboarding")}>
              Set Up Profile
            </AppButton>
          )}
        </div>
      </DashboardLayout>
    );
  }

  const filteredPipeline = stageFilter === "all"
    ? pipeline
    : pipeline.filter(p => p.stage === stageFilter);

  const filteredRecommendations = recommendations.filter(r =>
    !search || r.name?.toLowerCase().includes(search.toLowerCase()) ||
    r.industry?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout role="investor">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
        <GlobalToast toast={toast} onClose={() => setToast(null)} />

        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-[var(--text-primary)] uppercase tracking-tighter">
              Investor Dashboard
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              {profile.organization_name || "Individual Investor"}
            </p>
          </div>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Pipeline", value: stats.total_pipeline || 0, icon: BarChart3, color: "text-[var(--brand-orange)]" },
            { label: "Invested", value: stats.invested_count || 0, icon: Target, color: "text-emerald-400" },
            { label: "Evaluating", value: stats.active_evaluations || 0, icon: Eye, color: "text-purple-400" },
            { label: "Watchlist", value: stats.watchlist_count || 0, icon: Bookmark, color: "text-blue-400" },
          ].map((s, i) => (
            <AppCard key={i} padding="md">
              <div className="flex items-center gap-3">
                <s.icon className={`w-5 h-5 ${s.color}`} />
                <div>
                  <p className="text-2xl font-black text-[var(--text-primary)]">{s.value}</p>
                  <p className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">{s.label}</p>
                </div>
              </div>
            </AppCard>
          ))}
        </div>

        {/* TABS */}
        <div className="flex gap-1 border-b border-[var(--border-primary)]">
          {[
            { id: "discover", label: "Discover", icon: Search },
            { id: "pipeline", label: "Pipeline", icon: BarChart3 },
            { id: "watchlist", label: "Watchlist", icon: Bookmark },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-[10px] font-black uppercase tracking-wider transition-colors relative ${
                activeTab === tab.id
                  ? "text-[var(--brand-orange)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--brand-orange)]" />
              )}
            </button>
          ))}
        </div>

        {/* DISCOVER TAB */}
        {activeTab === "discover" && (
          <div className="space-y-4">
            {/* Search + Filter bar */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && searchVentures()}
                  placeholder="Search ventures by name, industry, or description..."
                  className="w-full pl-11 pr-4 py-3 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--brand-orange)]/60"
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2 transition-all ${
                  showFilters ? "bg-[var(--brand-orange)] text-white" : "bg-[var(--surface-3)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                <SlidersHorizontal className="w-4 h-4" /> Filters
              </button>
              <AppButton variant="primary" size="sm" icon={Search} onClick={searchVentures}>Search</AppButton>
            </div>

            {/* Advanced filters */}
            {showFilters && (
              <div className="p-4 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl space-y-3">
                <div>
                  <label className="text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Industry</label>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {INDUSTRY_OPTIONS.map(ind => (
                      <button key={ind} onClick={() => { const next = filterIndustry.includes(ind) ? filterIndustry.filter(i => i !== ind) : [...filterIndustry, ind]; setFilterIndustry(next); searchVentures({industry: next}); }}
                        className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase transition-all ${
                          filterIndustry.includes(ind) ? "bg-[var(--brand-orange)] text-white" : "bg-[var(--surface-3)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        }`}>{ind}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Country</label>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {COUNTRY_OPTIONS.map(c => (
                      <button key={c} onClick={() => { const next = filterCountry.includes(c) ? filterCountry.filter(x => x !== c) : [...filterCountry, c]; setFilterCountry(next); searchVentures({country: next}); }}
                        className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase transition-all ${
                          filterCountry.includes(c) ? "bg-[var(--brand-orange)] text-white" : "bg-[var(--surface-3)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        }`}>{c}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Stage</label>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {STAGE_OPTIONS.map(s => (
                      <button key={s} onClick={() => { const next = filterStage.includes(s) ? filterStage.filter(x => x !== s) : [...filterStage, s]; setFilterStage(next); searchVentures({stage: next}); }}
                        className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase transition-all ${
                          filterStage.includes(s) ? "bg-[var(--brand-orange)] text-white" : "bg-[var(--surface-3)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        }`}>{s}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Funding (USD)</label>
                  <div className="flex gap-1 mt-1.5">
                    <input value={filterFundingMin} onChange={e => setFilterFundingMin(e.target.value)}
                      type="number" placeholder="Min"
                      className="w-full px-2 py-2 bg-[var(--surface-3)] border border-[var(--border-primary)] rounded-lg text-xs font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none" />
                    <input value={filterFundingMax} onChange={e => setFilterFundingMax(e.target.value)}
                      type="number" placeholder="Max"
                      className="w-full px-2 py-2 bg-[var(--surface-3)] border border-[var(--border-primary)] rounded-lg text-xs font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none" />
                  </div>
                </div>
                {(filterIndustry.length > 0 || filterCountry.length > 0 || filterStage.length > 0 || filterFundingMin || filterFundingMax) && (
                  <button onClick={() => { setFilterIndustry([]); setFilterCountry([]); setFilterStage([]); setFilterFundingMin(""); setFilterFundingMax(""); searchVentures({industry: [], country: [], stage: [], fundingMin: "", fundingMax: ""}); }}
                    className="text-[10px] font-bold text-[var(--brand-orange)] hover:underline">
                    Clear all filters
                  </button>
                )}
              </div>
            )}

            {/* Results */}
            {(ventures.length > 0 ? ventures : recommendations).length === 0 ? (
              <div className="text-center py-16">
                <Building2 className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-4" />
                <p className="text-sm font-bold text-[var(--text-secondary)]">No ventures found</p>
                <p className="text-xs text-[var(--text-tertiary)] mt-1">Try adjusting your filters or search terms.</p>
              </div>
            ) : (
              <>
                {venturesTotal > 0 && <p className="text-[10px] text-[var(--text-tertiary)]">{venturesTotal} ventures found</p>}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(ventures.length > 0 ? ventures : recommendations).map(v => {
                    const isWatching = watchlist.some(w => w.venture_id === v.id);
                    const isCompared = compareList.some(c => c.id === v.id);
                    return (
                      <AppCard key={v.id} padding="md" hover>
                        <div className="space-y-3">
                          <div className="flex items-start justify-between">
                            <button onClick={() => openVentureDetail(v)} className="text-left flex-1">
                              <h4 className="text-sm font-black text-[var(--text-primary)] hover:text-[var(--brand-orange)] transition-colors">{v.name}</h4>
                              <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">{v.industry || "—"}{v.country ? ` · ${v.country}` : ""}</p>
                              {v.match_score > 0 && (
                                <span className="inline-block mt-1 px-2 py-0.5 rounded text-[8px] font-black uppercase bg-emerald-500/10 text-emerald-400">
                                  {v.match_score}% match
                                </span>
                              )}
                            </button>
                            <div className="flex items-center gap-1">
                              <button onClick={() => toggleCompare(v)}
                                className={`p-1 rounded transition-colors ${isCompared ? "text-[var(--brand-orange)]" : "text-[var(--text-tertiary)] hover:text-[var(--brand-orange)]"}`}
                                title={isCompared ? "Remove from compare" : "Add to compare"}>
                                <GitCompare className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => toggleWatchlist(v.id)}
                                disabled={processingId !== null}
                                className={`p-1 rounded transition-colors ${isWatching ? "text-[var(--brand-orange)]" : "text-[var(--text-tertiary)] hover:text-[var(--brand-orange)]"} disabled:opacity-40 disabled:cursor-wait`}>
                                {processingId === v.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : isWatching ? <BookmarkCheck className="w-4 h-4 fill-current" /> : <Bookmark className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>
                          {v.description && (
                            <p className="text-xs text-[var(--text-secondary)] line-clamp-2">{v.description}</p>
                          )}
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-[var(--text-tertiary)]">{v.country || ""}{v.completion_index ? ` · ${Number(v.completion_index).toFixed(0)}%` : ""}</span>
                            <button
                              onClick={() => { setIntroVenture(v); setIntroMessage(""); setShowIntroModal(true); }}
                              disabled={processingId !== null}
                              className="flex items-center gap-1 text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-wider hover:underline disabled:opacity-40 disabled:cursor-wait disabled:no-underline"
                            >
                              Request Introduction <ArrowRight className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </AppCard>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* PIPELINE TAB */}
        {activeTab === "pipeline" && (
          <div className="space-y-4">
            <div className="flex gap-2 overflow-x-auto pb-2">
              <button
                onClick={() => setStageFilter("all")}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider whitespace-nowrap transition-colors ${
                  stageFilter === "all" ? "bg-[var(--brand-orange)] text-white" : "bg-[var(--surface-3)] text-[var(--text-secondary)]"
                }`}
              >
                All ({pipeline.length})
              </button>
              {PIPELINE_STAGES.map(stage => {
                const count = pipeline.filter(p => p.stage === stage).length;
                if (count === 0 && stageFilter !== stage) return null;
                return (
                  <button
                    key={stage}
                    onClick={() => setStageFilter(stage)}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider whitespace-nowrap transition-colors ${
                      stageFilter === stage ? "bg-[var(--brand-orange)] text-white" : STAGE_COLORS[stage]
                    }`}
                  >
                    {STAGE_LABELS[stage]} ({count})
                  </button>
                );
              })}
            </div>

            {filteredPipeline.length === 0 ? (
              <div className="text-center py-16">
                <BarChart3 className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-4" />
                <p className="text-sm font-bold text-[var(--text-secondary)]">Pipeline empty</p>
                <p className="text-xs text-[var(--text-tertiary)] mt-1">Discover ventures and add them to your pipeline.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredPipeline.map(p => (
                  <AppCard key={p.id} padding="md">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Building2 className="w-8 h-8 text-[var(--brand-orange)]/60" />
                        <div>
                          <p className="text-sm font-bold text-[var(--text-primary)]">{p.venture_name || p.venture_id}</p>
                          <p className="text-[10px] text-[var(--text-tertiary)]">
                            {new Date(p.stage_changed_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${STAGE_COLORS[p.stage]}`}>
                          {STAGE_LABELS[p.stage]}
                        </span>
                        {p.stage === "due_diligence" && (
                          <button onClick={() => router.push(`/investor/diligence?pipeline_id=${p.id}`)}
                            className="px-3 py-1 rounded-lg bg-purple-500/10 text-purple-400 text-[9px] font-black uppercase tracking-wider hover:bg-purple-500/20">
                            Open Workspace
                          </button>
                        )}
                        <select
                          value={p.stage}
                          onChange={e => addToPipeline(p.venture_id, e.target.value)}
                          disabled={processingId !== null}
                          className="bg-[var(--surface-3)] border border-[var(--border-primary)] rounded-lg px-2 py-1 text-[10px] font-bold text-[var(--text-primary)] outline-none disabled:opacity-40 disabled:cursor-wait"
                        >
                          {PIPELINE_STAGES.map(s => (
                            <option key={s} value={s}>{STAGE_LABELS[s]}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </AppCard>
                ))}
              </div>
            )}
          </div>
        )}

        {/* WATCHLIST TAB */}
        {activeTab === "watchlist" && (
          <div className="space-y-4">
            {watchlist.length === 0 ? (
              <div className="text-center py-16">
                <Bookmark className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-4" />
                <p className="text-sm font-bold text-[var(--text-secondary)]">No saved ventures</p>
                <p className="text-xs text-[var(--text-tertiary)] mt-1">Bookmark ventures from the Discover tab.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {watchlist.map(w => (
                  <AppCard key={w.id} padding="md">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-[var(--text-primary)]">{w.venture_name || w.venture_id}</p>
                        {w.personal_notes && (
                          <p className="text-xs text-[var(--text-secondary)] mt-1">{w.personal_notes}</p>
                        )}
                      </div>
                      <AppButton variant="secondary" size="sm" loading={processingId === w.venture_id} disabled={processingId !== null} onClick={() => addToPipeline(w.venture_id, "interested")}>
                        Add to Pipeline
                      </AppButton>
                    </div>
                  </AppCard>
                ))}
              </div>
            )}
          </div>
        )}

        {/* INTRODUCTION REQUEST MODAL */}
        {showIntroModal && introVenture && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowIntroModal(false)} />
            <div className="relative w-full max-w-md bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-2xl shadow-2xl">
              <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-primary)]">
                <h3 className="text-sm font-black text-[var(--text-primary)] uppercase">Request Introduction</h3>
                <button onClick={() => setShowIntroModal(false)} className="p-1.5 rounded-lg hover:bg-[var(--surface-3)]"><X className="w-4 h-4"/></button>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-xs text-[var(--text-secondary)]">
                  You are requesting an introduction to <b className="text-[var(--text-primary)]">{introVenture.name}</b>.
                  Future Studio will review your request and coordinate the introduction.
                </p>
                <div>
                  <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Investment Interest Statement</label>
                  <textarea value={introMessage} onChange={e => setIntroMessage(e.target.value)}
                    rows={3} placeholder="Briefly describe why you are interested in this opportunity..."
                    className="w-full mt-1.5 px-4 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none resize-none"/>
                </div>
              </div>
              <div className="flex justify-end gap-3 px-6 pb-5">
                <button onClick={() => setShowIntroModal(false)} className="px-4 py-2 text-[10px] font-black text-[var(--text-secondary)] uppercase rounded-xl hover:bg-[var(--surface-3)]">Cancel</button>
                <AppButton variant="primary" icon={Send} loading={processingId !== null} disabled={processingId !== null}
                  onClick={async () => {
                    setProcessingId(introVenture.id);
                    await addToPipeline(introVenture.id, "meeting_requested");
                    setShowIntroModal(false);
                    setIntroVenture(null);
                  }}>
                  Submit Request
                </AppButton>
              </div>
            </div>
          </div>
        )}

        {/* VENTURE DETAIL MODAL */}
        {detailVenture && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setDetailVenture(null); setDetailPipeline(null); }} />
            <div className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-2xl shadow-2xl">
              <div className="sticky top-0 z-10 bg-[var(--surface-1)] flex items-center justify-between px-6 py-4 border-b border-[var(--border-primary)]">
                <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider">{detailVenture.name}</h3>
                <div className="flex items-center gap-2">
                  <AppButton variant="secondary" size="sm" icon={GitCompare}
                    onClick={() => { toggleCompare(detailVenture); }}>
                    Compare
                  </AppButton>
                  <button onClick={() => { setDetailVenture(null); setDetailPipeline(null); }}
                    className="p-1.5 rounded-lg hover:bg-[var(--surface-3)] text-[var(--text-secondary)]">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="p-6 space-y-6">
                <div>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{detailVenture.description || "No description available."}</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Industry", value: detailVenture.industry || "—" },
                    { label: "Country", value: detailVenture.country || "—" },
                    { label: "Status", value: detailVenture.status || "—" },
                    { label: "Interest", value: `${detailVenture.investor_interest_count || 0} investors` },
                  ].map((m, i) => (
                    <div key={i} className="p-3 rounded-xl bg-[var(--surface-3)]">
                      <p className="text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest">{m.label}</p>
                      <p className="text-xs font-bold text-[var(--text-primary)] mt-1">{m.value}</p>
                    </div>
                  ))}
                </div>
                {detailPipeline ? (
                  <div className="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border-primary)]">
                    <p className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-2">Your Pipeline Status</p>
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${STAGE_COLORS[detailPipeline.stage]}`}>
                        {STAGE_LABELS[detailPipeline.stage]}
                      </span>
                      <select value={detailPipeline.stage}
                        onChange={e => { addToPipeline(detailVenture.id, e.target.value); setDetailPipeline({...detailPipeline, stage: e.target.value}); }}
                        disabled={processingId !== null}
                        className="bg-[var(--surface-3)] border border-[var(--border-primary)] rounded-lg px-2 py-1 text-[10px] font-bold text-[var(--text-primary)] outline-none disabled:opacity-40 disabled:cursor-wait">
                        {PIPELINE_STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
                      </select>
                    </div>
                  </div>
                ) : (
                  <AppButton variant="primary" size="sm" icon={ArrowRight}
                    loading={processingId !== null}
                    onClick={() => { addToPipeline(detailVenture.id, "interested"); setDetailPipeline({ stage: "interested" }); }}>
                    Add to Pipeline
                  </AppButton>
                )}
                <div className="flex gap-3 pt-2 border-t border-[var(--border-primary)]">
                  <AppButton variant="secondary" size="sm" loading={processingId !== null} onClick={() => toggleWatchlist(detailVenture.id)}>
                    {watchlist.some(w => w.venture_id === detailVenture.id) ? "Remove from Watchlist" : "Add to Watchlist"}
                  </AppButton>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* COMPARISON BAR + MODAL */}
        {compareList.length > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
            <div className="flex items-center gap-3 px-5 py-3 bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-2xl shadow-2xl">
              <GitCompare className="w-4 h-4 text-[var(--brand-orange)]" />
              <span className="text-xs font-bold text-[var(--text-primary)]">{compareList.length} selected</span>
              <div className="flex gap-2">
                {compareList.map(v => (
                  <span key={v.id} className="px-2 py-0.5 rounded-lg bg-[var(--surface-3)] text-[10px] font-bold truncate max-w-[100px]">{v.name}</span>
                ))}
              </div>
              {compareList.length >= 2 && (
                <button onClick={() => setShowCompare(true)}
                  className="px-3 py-1.5 bg-[var(--brand-orange)] text-white text-[10px] font-black uppercase tracking-wider rounded-lg">
                  Compare
                </button>
              )}
              <button onClick={() => setCompareList([])} className="p-1 text-[var(--text-secondary)] hover:text-rose-400"><X className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        )}

        {showCompare && compareList.length >= 2 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowCompare(false)} />
            <div className="relative w-full max-w-5xl max-h-[85vh] overflow-y-auto bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-2xl shadow-2xl">
              <div className="sticky top-0 bg-[var(--surface-1)] flex items-center justify-between px-6 py-4 border-b border-[var(--border-primary)]">
                <h3 className="text-sm font-black text-[var(--text-primary)] uppercase flex items-center gap-2"><GitCompare className="w-4 h-4 text-[var(--brand-orange)]" />Compare</h3>
                <button onClick={() => setShowCompare(false)} className="p-1.5 rounded-lg hover:bg-[var(--surface-3)]"><X className="w-4 h-4" /></button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="border-b border-[var(--border-primary)]">
                    <th className="text-left px-6 py-3 text-[9px] font-black text-[var(--text-secondary)] uppercase w-32">Metric</th>
                    {compareList.map(v => <th key={v.id} className="text-left px-6 py-3 text-[9px] font-black text-[var(--brand-orange)] uppercase">{v.name}</th>)}
                  </tr></thead>
                  <tbody className="divide-y divide-[var(--border-primary)]">
                    {[
                      { label: "Industry", key: "industry" },
                      { label: "Country", key: "country" },
                      { label: "Status", key: "status" },
                      { label: "Progress", key: "completion_index", fmt: v => v ? Number(v).toFixed(0)+'%' : "—" },
                      { label: "Interest", key: "investor_interest_count", fmt: v => (v||0)+' investors' },
                      { label: "Description", key: "description", fmt: v => v ? v.substring(0,100)+(v.length>100?'...':'') : "—" },
                    ].map((row, i) => (
                      <tr key={i}>
                        <td className="px-6 py-3 text-[10px] font-bold text-[var(--text-secondary)] uppercase">{row.label}</td>
                        {compareList.map(v => <td key={v.id} className="px-6 py-3 text-xs font-bold text-[var(--text-primary)]">{row.fmt ? row.fmt(v[row.key]) : (v[row.key]||"—")}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

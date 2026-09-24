"use client";

import { useState } from "react";
import {
  Eye, BarChart3, Users,
  Building2, ArrowRight, Loader2, Search,
  Bookmark, BookmarkCheck, Target, SlidersHorizontal,
  X, GitCompare, Send,
  Megaphone, Calendar,
} from "lucide-react";
import { useRouter } from "next/navigation";
import AppCard from "@/components/ui/AppCard";
import AppButton from "@/components/ui/AppButton";
import GlobalToast from "@/components/ui/GlobalToast";
import { useI18n } from "@/lib/i18n";
import { useApi, cacheGet, cacheSet } from "@/lib/hooks/useApi";

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
  interested: "interested",
  watching: "watching",
  meeting_requested: "meetingRequested",
  due_diligence: "dueDiligence",
  negotiation: "negotiation",
  invested: "invested",
  declined: "declined",
};

const INDUSTRY_OPTIONS = ["FinTech","HealthTech","AgriTech","EdTech","CleanTech","Logistics","E-Commerce","SaaS","AI/ML","Renewable Energy"];
const COUNTRY_OPTIONS = ["CD","KE","NG","ZA","GH","RW","UG","TZ","EG","MA"];
const STAGE_OPTIONS = ["Pre-Seed","Seed","Series A","Series B","Growth"];

// The shape the screen renders from, so a failed or malformed payload never
// reaches a `.map` / `.total_*` read. Module scope keeps both values stable for
// the hook (an inline literal would refetch on every render).
const EMPTY_INVESTOR_DASHBOARD = {
  profile: null,
  pipeline: [],
  watchlist: [],
  recommendations: [],
  campaigns: [],
  relationships: [],
  stats: {},
};
const pickInvestorDashboard = (response) =>
  response?.success
    ? {
        profile: response.profile ?? null,
        pipeline: response.pipeline || [],
        watchlist: response.watchlist || [],
        recommendations: response.recommendations || [],
        campaigns: response.campaigns || [],
        relationships: response.relationships || [],
        stats: response.stats || {},
      }
    : EMPTY_INVESTOR_DASHBOARD;

export default function InvestorDashboard() {
  const router = useRouter();
  const { t } = useI18n();

  // The loader's work — painting from the cache first, discarding a stale
  // response, the background refresh — belongs to the hook, so the screen keeps
  // no data state of its own and never sets state from an effect. Both mutation
  // flows below call refresh(), which bypasses the cache like bypassCache did.
  const { data, loading, refresh } = useApi("/api/investor/dashboard", {
    defaultValue: EMPTY_INVESTOR_DASHBOARD,
    transform: pickInvestorDashboard,
  });
  const {
    profile,
    pipeline,
    watchlist,
    recommendations,
    campaigns,
    relationships,
    stats,
  } = data;
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

  const addToPipeline = async (ventureId, stage) => {
    setProcessingId(ventureId);
    try {
      const response = await fetch("/api/investor/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venture_id: ventureId, stage }),
      });
      const data = await response.json();
      if (data.success) {
        setToast({ type: "success", message: `${t("venture")} ${t(STAGE_LABELS[stage] || "")}` });
        refresh();
      }
    } catch (_) {} finally {
      setProcessingId(null);
    }
  };

  const toggleWatchlist = async (ventureId) => {
    setProcessingId(ventureId);
    try {
      const response = await fetch("/api/investor/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venture_id: ventureId }),
      });
      const data = await response.json();
      if (data.success) {
        setToast({ type: "success", message: data.action === "added" ? "Added to watchlist" : "Removed from watchlist" });
        refresh();
      }
    } catch (_) {} finally {
      setProcessingId(null);
    }
  };

  // Advanced venture search with filters
  const searchVentures = async (overrides = {}) => {
    const searchTerm = overrides.search !== undefined ? overrides.search : search;
    const industry = overrides.industry !== undefined ? overrides.industry : filterIndustry;
    const country = overrides.country !== undefined ? overrides.country : filterCountry;
    const stage = overrides.stage !== undefined ? overrides.stage : filterStage;
    const fundingMin = overrides.fundingMin !== undefined ? overrides.fundingMin : filterFundingMin;
    const fundingMax = overrides.fundingMax !== undefined ? overrides.fundingMax : filterFundingMax;
    const params = new URLSearchParams();
    if (searchTerm) params.set("search", searchTerm);
    if (industry.length) params.set("industry", industry.join(","));
    if (country.length) params.set("country", country.join(","));
    if (stage.length) params.set("stage", stage.join(","));
    if (fundingMin) params.set("funding_min", fundingMin);
    if (fundingMax) params.set("funding_max", fundingMax);
    try {
      const response = await fetch(`/api/investor/ventures?${params}`);
      const data = await response.json();
      if (data.success) {
        setVentures(data.ventures || []);
        setVenturesTotal(data.total || 0);
      }
    } catch (_) {}
  };

  // Open venture detail
  const openVentureDetail = async (venture, bypassCache = false) => {
    setDetailVenture(venture);
    const url = `/api/investor/pipeline?venture_id=${venture.id}`;
    let painted = false;
    const applyPipeline = (data) => {
      if (data.success && data.pipeline?.length > 0) {
        setDetailPipeline(data.pipeline[0]);
      } else {
        setDetailPipeline(null);
      }
      painted = true;
    };
    try {
      // Cache-first paint: reopening a previously viewed venture renders
      // instantly from a fresh snapshot of its pipeline status.
      if (!bypassCache) {
        const cached = cacheGet(url);
        if (cached !== null && cached.success) applyPipeline(cached);
      }
      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        cacheSet(url, data);
        applyPipeline(data);
      }
    } catch (_) {
      // Only fall back to the empty state when nothing was painted.
      if (!painted) setDetailPipeline(null);
    }
  };

  // Toggle comparison
  const toggleCompare = (venture) => {
    setCompareList(previousList =>
      previousList.find(item => item.id === venture.id)
        ? previousList.filter(item => item.id !== venture.id)
        : previousList.length < 4 ? [...previousList, venture] : previousList
    );
  };

  if (loading) {
    return (
      <>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--brand-orange)]" />
        </div>
      </>
    );
  }

  if (!profile || profile.approval_status !== "approved") {
    return (
      <>
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
      </>
    );
  }

  const filteredPipeline = stageFilter === "all"
    ? pipeline
    : pipeline.filter(item => item.stage === stageFilter);

  const _filteredRecommendations = recommendations.filter(recommendation =>
    !search || recommendation.name?.toLowerCase().includes(search.toLowerCase()) ||
    recommendation.industry?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
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
            { label: t("pipeline"), value: stats.total_pipeline || 0, icon: BarChart3, color: "text-[var(--brand-orange)]" },
            { label: t("invested"), value: stats.invested_count || 0, icon: Target, color: "text-emerald-400" },
            { label: t("evaluating"), value: stats.active_evaluations || 0, icon: Eye, color: "text-purple-400" },
            { label: t("watchlist"), value: stats.watchlist_count || 0, icon: Bookmark, color: "text-blue-400" },
          ].map((stat, index) => (
            <AppCard key={index} padding="md">
              <div className="flex items-center gap-3">
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
                <div>
                  <p className="text-2xl font-black text-[var(--text-primary)]">{stat.value}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{stat.label}</p>
                </div>
              </div>
            </AppCard>
          ))}
        </div>

        {/* TABS */}
        <div className="flex gap-1 border-b border-[var(--border-primary)]">
          {[
            { id: "discover", label: t("discover"), icon: Search },
            { id: "pipeline", label: t("pipeline"), icon: BarChart3 },
            { id: "watchlist", label: t("watchlist"), icon: Bookmark },
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
                  onChange={event => setSearch(event.target.value)}
                  onKeyDown={event => event.key === "Enter" && searchVentures()}
                  placeholder={t("searchVentures")}
                  className="w-full pl-11 pr-4 py-3 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-brand-orange/60"
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2 transition-all ${
                  showFilters ? "bg-[var(--brand-orange)] text-white" : "bg-[var(--surface-3)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                <SlidersHorizontal className="w-4 h-4" /> {t("filters")}
              </button>
              <AppButton variant="primary" size="sm" icon={Search} onClick={searchVentures}>{t("search")}</AppButton>
            </div>

            {/* Active Fundraising Campaigns */}
            {campaigns.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-[var(--brand-orange)]" />
                  <h3 className="text-[11px] font-black text-[var(--text-primary)] uppercase tracking-wider">{t("activeCampaigns")}</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {campaigns.map(campaign => {
                    const progressPercent = campaign.target_raise > 0 ? Math.min(100, Math.round((parseFloat(campaign.current_raised || 0) / parseFloat(campaign.target_raise)) * 100)) : 0;
                    return (
                      <AppCard key={campaign.id} padding="md" hover onClick={() => openVentureDetail({ id: campaign.venture_id, name: campaign.venture_name, industry: campaign.industry, country: campaign.country, business_stage: campaign.business_stage, funding_requirement: campaign.funding_requirement, completion_index: campaign.completion_index })}>
                        <div className="space-y-2 cursor-pointer">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="text-xs font-black text-[var(--text-primary)]">{campaign.venture_name || campaign.name}</h4>
                              <p className="text-[10px] font-medium text-[var(--text-secondary)]">{campaign.name}{campaign.industry ? ` · ${campaign.industry}` : ""}</p>
                            </div>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400">Active</span>
                          </div>
                          {campaign.target_raise > 0 && (
                            <div className="space-y-1">
                              <div className="flex justify-between text-[10px]">
                                <span className="font-bold text-[var(--text-secondary)]">${Number(campaign.current_raised || 0).toLocaleString()}</span>
                                <span className="font-black text-[var(--text-primary)]">{progressPercent}% of ${Number(campaign.target_raise).toLocaleString()}</span>
                              </div>
                              <div className="w-full h-1.5 bg-[var(--surface-3)] rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${progressPercent}%` }} />
                              </div>
                            </div>
                          )}
                          <div className="flex items-center gap-3 text-[10px] text-[var(--text-tertiary)]">
                            {campaign.investor_count > 0 && <span className="flex items-center gap-1"><Users className="w-2.5 h-2.5"/>{campaign.investor_count} interested</span>}
                            {campaign.opening_date && <span className="flex items-center gap-1"><Calendar className="w-2.5 h-2.5"/>{new Date(campaign.opening_date).toLocaleDateString()}</span>}
                          </div>
                        </div>
                      </AppCard>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Upcoming Meetings */}
            {relationships.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[var(--brand-orange)]" />
                  <h3 className="text-[11px] font-black text-[var(--text-primary)] uppercase tracking-wider">{t("upcomingMeetings")}</h3>
                </div>
                <div className="space-y-2">
                  {relationships.map(relationship => (
                    <div key={relationship.id}>
                      {relationship.next_meetings && Array.isArray(relationship.next_meetings) && relationship.next_meetings.length > 0 && relationship.next_meetings.map(meeting => (
                            <AppCard key={meeting.id} padding="md" className="mb-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="p-2 rounded-xl bg-brand-orange/10">
                                    <Calendar className="w-4 h-4 text-[var(--brand-orange)]" />
                                  </div>
                                  <div>
                                    <p className="text-xs font-black text-[var(--text-primary)]">{relationship.venture_name} — {meeting.meeting_type?.replace(/_/g, " ") || "Meeting"}</p>
                                    <p className="text-[10px] text-[var(--text-secondary)]">
                                      {meeting.scheduled_date ? new Date(meeting.scheduled_date).toLocaleDateString() : "TBD"}
                                      {meeting.scheduled_time ? ` at ${meeting.scheduled_time}` : ""}
                                      {relationship.relationship_manager_name ? ` · ${relationship.relationship_manager_name}` : ""}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </AppCard>
                          ))}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Advanced filters */}
            {showFilters && (
              <div className="p-4 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl space-y-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("industry")}</label>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {INDUSTRY_OPTIONS.map(industryOption => (
                      <button key={industryOption} onClick={() => { const nextIndustries = filterIndustry.includes(industryOption) ? filterIndustry.filter(value => value !== industryOption) : [...filterIndustry, industryOption]; setFilterIndustry(nextIndustries); searchVentures({industry: nextIndustries}); }}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all ${
                          filterIndustry.includes(industryOption) ? "bg-[var(--brand-orange)] text-white" : "bg-[var(--surface-3)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        }`}>{industryOption}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("country")}</label>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {COUNTRY_OPTIONS.map(countryOption => (
                      <button key={countryOption} onClick={() => { const nextCountries = filterCountry.includes(countryOption) ? filterCountry.filter(value => value !== countryOption) : [...filterCountry, countryOption]; setFilterCountry(nextCountries); searchVentures({country: nextCountries}); }}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all ${
                          filterCountry.includes(countryOption) ? "bg-[var(--brand-orange)] text-white" : "bg-[var(--surface-3)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        }`}>{countryOption}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("stage")}</label>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {STAGE_OPTIONS.map(stageOption => (
                      <button key={stageOption} onClick={() => { const nextStages = filterStage.includes(stageOption) ? filterStage.filter(value => value !== stageOption) : [...filterStage, stageOption]; setFilterStage(nextStages); searchVentures({stage: nextStages}); }}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all ${
                          filterStage.includes(stageOption) ? "bg-[var(--brand-orange)] text-white" : "bg-[var(--surface-3)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        }`}>{stageOption}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("fundingRange")}</label>
                  <div className="flex gap-1 mt-1.5">
                    <input value={filterFundingMin} onChange={event => setFilterFundingMin(event.target.value)}
                      type="number" placeholder="Min"
                      className="w-full px-2 py-2 bg-[var(--surface-3)] border border-[var(--border-primary)] rounded-lg text-xs font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none" />
                    <input value={filterFundingMax} onChange={event => setFilterFundingMax(event.target.value)}
                      type="number" placeholder="Max"
                      className="w-full px-2 py-2 bg-[var(--surface-3)] border border-[var(--border-primary)] rounded-lg text-xs font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none" />
                  </div>
                </div>
                {(filterIndustry.length > 0 || filterCountry.length > 0 || filterStage.length > 0 || filterFundingMin || filterFundingMax) && (
                  <button onClick={() => { setFilterIndustry([]); setFilterCountry([]); setFilterStage([]); setFilterFundingMin(""); setFilterFundingMax(""); searchVentures({industry: [], country: [], stage: [], fundingMin: "", fundingMax: ""}); }}
                    className="text-[10px] font-bold text-[var(--brand-orange)] hover:underline">
                    {t("clearFilters")}
                  </button>
                )}
              </div>
            )}

            {/* Results */}
            {(ventures.length > 0 ? ventures : recommendations).length === 0 ? (
              <div className="text-center py-16">
                <Building2 className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-4" />
                <p className="text-sm font-bold text-[var(--text-secondary)]">{t("noVentures")}</p>
                <p className="text-xs text-[var(--text-tertiary)] mt-1">{t("noVentureDesc")}</p>
              </div>
            ) : (
              <>
                {venturesTotal > 0 && <p className="text-[10px] text-[var(--text-tertiary)]">{venturesTotal} ventures found</p>}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(ventures.length > 0 ? ventures : recommendations).map(venture => {
                    const isWatching = watchlist.some(entry => entry.venture_id === venture.id);
                    const isCompared = compareList.some(item => item.id === venture.id);
                    const activeCampaign = campaigns.find(candidate => candidate.venture_id === venture.id);
                    return (
                      <AppCard key={venture.id} padding="md" hover>
                        <div className="space-y-3">
                          <div className="flex items-start justify-between">
                            <button onClick={() => openVentureDetail(venture)} className="text-left flex-1">
                              <h4 className="text-sm font-black text-[var(--text-primary)] hover:text-[var(--brand-orange)] transition-colors">{venture.name}</h4>
                              <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">{venture.industry || "—"}{venture.country ? ` · ${venture.country}` : ""}</p>
                              {activeCampaign && (
                                <span className="inline-block mt-1 mr-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/10 text-amber-400">
                                  Campaign Active
                                </span>
                              )}
                              {venture.match_score > 0 && (
                                <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400">
                                  {venture.match_score}% match
                                </span>
                              )}
                            </button>
                            <div className="flex items-center gap-1">
                              <button onClick={() => toggleCompare(venture)}
                                className={`p-1 rounded transition-colors ${isCompared ? "text-[var(--brand-orange)]" : "text-[var(--text-tertiary)] hover:text-[var(--brand-orange)]"}`}
                                title={isCompared ? "Remove from compare" : "Add to compare"}>
                                <GitCompare className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => toggleWatchlist(venture.id)}
                                disabled={processingId !== null}
                                className={`p-1 rounded transition-colors ${isWatching ? "text-[var(--brand-orange)]" : "text-[var(--text-tertiary)] hover:text-[var(--brand-orange)]"} disabled:opacity-40 disabled:cursor-wait`}>
                                {processingId === venture.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : isWatching ? <BookmarkCheck className="w-4 h-4 fill-current" /> : <Bookmark className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>
                          {venture.description && (
                            <p className="text-xs text-[var(--text-secondary)] line-clamp-2">{venture.description}</p>
                          )}
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-[var(--text-tertiary)]">{venture.country || ""}{venture.completion_index ? ` · ${Number(venture.completion_index).toFixed(0)}%` : ""}</span>
                            {!pipeline.some(item => item.venture_id === venture.id) && (
                              <button
                                onClick={() => { setIntroVenture(venture); setIntroMessage(""); setShowIntroModal(true); }}
                                disabled={processingId !== null}
                                className="flex items-center gap-1 text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-wider hover:underline disabled:opacity-40 disabled:cursor-wait disabled:no-underline"
                              >
                                Request Introduction <ArrowRight className="w-3 h-3" />
                              </button>
                            )}
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
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide whitespace-nowrap transition-colors ${
                  stageFilter === "all" ? "bg-[var(--brand-orange)] text-white" : "bg-[var(--surface-3)] text-[var(--text-secondary)]"
                }`}
              >
                All ({pipeline.length})
              </button>
              {PIPELINE_STAGES.map(stage => {
                const count = pipeline.filter(item => item.stage === stage).length;
                if (count === 0 && stageFilter !== stage) return null;
                return (
                  <button
                    key={stage}
                    onClick={() => setStageFilter(stage)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide whitespace-nowrap transition-colors ${
                      stageFilter === stage ? "bg-[var(--brand-orange)] text-white" : STAGE_COLORS[stage]
                    }`}
                  >
                    {t(STAGE_LABELS[stage] || "")} ({count})
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
                {filteredPipeline.map(item => (
                  <AppCard key={item.id} padding="md">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Building2 className="w-8 h-8 text-brand-orange/60" />
                        <div>
                          <p className="text-sm font-bold text-[var(--text-primary)]">{item.venture_name || item.venture_id}</p>
                          <p className="text-[10px] text-[var(--text-tertiary)]">
                            {new Date(item.stage_changed_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${STAGE_COLORS[item.stage]}`}>
                          {t(STAGE_LABELS[item.stage] || "") || item.stage}
                        </span>
                        {item.stage === "due_diligence" && (
                          <button onClick={() => router.push(`/investor/diligence?pipeline_id=${item.id}`)}
                            className="px-3 py-1 rounded-lg bg-purple-500/10 text-purple-400 text-[10px] font-bold uppercase tracking-wide hover:bg-purple-500/20">
                            Open Workspace
                          </button>
                        )}
                        <select
                          value={item.stage}
                          onChange={event => addToPipeline(item.venture_id, event.target.value)}
                          disabled={processingId !== null}
                          className="bg-[var(--surface-3)] border border-[var(--border-primary)] rounded-lg px-2 py-1 text-[10px] font-bold text-[var(--text-primary)] outline-none disabled:opacity-40 disabled:cursor-wait"
                        >
                          {PIPELINE_STAGES.map(stageOption => (
                            <option key={stageOption} value={stageOption}>{t(STAGE_LABELS[stageOption] || "")}</option>
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
                <p className="text-xs text-[var(--text-tertiary)] mt-1">Bookmark ventures from the Discover tab to track their progress.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-[10px] text-[var(--text-tertiary)]">{watchlist.length} venture{watchlist.length > 1 ? "s" : ""} tracked</p>
                {watchlist.map(item => {
                  const campaignPct = item.target_raise > 0 ? Math.min(100, Math.round((parseFloat(item.current_raised || 0) / parseFloat(item.target_raise)) * 100)) : 0;
                  const readinessPct = Math.round(parseFloat(item.completion_index || 0));
                  return (
                    <AppCard key={item.id} padding="md" hover>
                      <div className="space-y-3">
                        {/* Header row */}
                        <div className="flex items-start justify-between">
                          <div className="flex-1 cursor-pointer" onClick={() => openVentureDetail({ id: item.venture_id, name: item.venture_name, industry: item.industry, country: item.country, business_stage: item.business_stage, description: item.description, funding_requirement: item.funding_requirement, completion_index: item.completion_index, investor_interest_count: item.investor_count })}>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-black text-[var(--text-primary)] hover:text-[var(--brand-orange)] transition-colors">{item.venture_name || item.venture_id}</h4>
                              {item.campaign_status === "active" && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/10 text-amber-400">Active</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              {item.industry && <span className="text-[10px] text-[var(--text-secondary)]">{item.industry}</span>}
                              {item.country && <span className="text-[10px] text-[var(--text-tertiary)]">{item.country}</span>}
                              {item.business_stage && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-[var(--surface-3)] text-[var(--text-secondary)]">{item.business_stage}</span>}
                            </div>
                          </div>
                          <button onClick={() => toggleWatchlist(item.venture_id)} disabled={processingId !== null}
                            className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-40 shrink-0"
                            title="Remove from watchlist">
                            {processingId === item.venture_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                          </button>
                        </div>

                        {/* Stats row */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          {/* Readiness */}
                          <div className="p-2 rounded-lg bg-[var(--surface-2)]">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Readiness</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <div className="flex-1 h-1.5 bg-[var(--surface-3)] rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all ${readinessPct >= 80 ? "bg-emerald-500" : readinessPct >= 50 ? "bg-amber-500" : "bg-slate-400"}`} style={{ width: `${readinessPct}%` }} />
                              </div>
                              <span className="text-[10px] font-bold text-[var(--text-primary)]">{readinessPct}%</span>
                            </div>
                          </div>
                          {/* Campaign funding */}
                          <div className="p-2 rounded-lg bg-[var(--surface-2)]">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Funding</p>
                            {item.campaign_id ? (
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <div className="flex-1 h-1.5 bg-[var(--surface-3)] rounded-full overflow-hidden">
                                  <div className="h-full bg-[var(--brand-orange)] rounded-full transition-all" style={{ width: `${campaignPct}%` }} />
                                </div>
                                <span className="text-[10px] font-bold text-[var(--text-primary)]">{campaignPct}%</span>
                              </div>
                            ) : (
                              <p className="text-[10px] font-medium text-[var(--text-tertiary)] mt-0.5">—</p>
                            )}
                          </div>
                          {/* Investor interest */}
                          <div className="p-2 rounded-lg bg-[var(--surface-2)]">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Interest</p>
                            <p className="text-xs font-bold text-[var(--text-primary)] mt-0.5">{item.investor_count || 0} investors</p>
                          </div>
                        </div>

                        {/* Campaign detail if active */}
                        {item.campaign_id && item.target_raise > 0 && (
                          <div className="flex items-center justify-between text-[10px] px-2 py-1.5 rounded-lg bg-[var(--surface-2)]">
                            <span className="text-[var(--text-secondary)]">{item.campaign_name}: <b className="text-[var(--text-primary)]">${Number(item.current_raised || 0).toLocaleString()}</b> / ${Number(item.target_raise).toLocaleString()}</span>
                            {item.closing_date && <span className="text-[var(--text-tertiary)]">Closes {new Date(item.closing_date).toLocaleDateString()}</span>}
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-2 pt-1 border-t border-[var(--border-primary)]">
                          <button onClick={() => openVentureDetail({ id: item.venture_id, name: item.venture_name, industry: item.industry, country: item.country, business_stage: item.business_stage, description: item.description, funding_requirement: item.funding_requirement, completion_index: item.completion_index, investor_interest_count: item.investor_count })}
                            className="flex items-center gap-1 text-[10px] font-bold text-[var(--brand-orange)] uppercase tracking-wide hover:underline">
                            <Eye className="w-3 h-3" /> View
                          </button>
                          <button onClick={() => { setIntroVenture({ id: item.venture_id, name: item.venture_name }); setIntroMessage(""); setShowIntroModal(true); }}
                            className="flex items-center gap-1 text-[10px] font-bold text-[var(--text-primary)] uppercase tracking-wide hover:text-[var(--brand-orange)] transition-colors">
                            <Send className="w-3 h-3" /> Request Intro
                          </button>
                          <AppButton variant="secondary" size="sm" disabled={processingId !== null}
                            onClick={() => addToPipeline(item.venture_id, "interested")}>
                            Add to Pipeline
                          </AppButton>
                        </div>
                      </div>
                    </AppCard>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* INTRODUCTION REQUEST MODAL */}
        {showIntroModal && introVenture && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowIntroModal(false)} />
            <div className="relative w-full max-w-md bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-2xl shadow-2xl max-h-[85vh] overflow-y-auto">
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
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Investment Interest Statement</label>
                  <textarea value={introMessage} onChange={event => setIntroMessage(event.target.value)}
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
                {/* Campaign detail (if active) */}
                {(() => {
                  const campaign = campaigns.find(candidate => candidate.venture_id === detailVenture.id);
                  if (!campaign) return null;
                  const progressPercent = campaign.target_raise > 0 ? Math.min(100, Math.round((parseFloat(campaign.current_raised || 0) / parseFloat(campaign.target_raise)) * 100)) : 0;
                  return (
                    <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/15 space-y-3">
                      <div className="flex items-center gap-2">
                        <Megaphone className="w-4 h-4 text-emerald-400" />
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Active Campaign: {campaign.name}</span>
                      </div>
                      {campaign.target_raise > 0 && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px]">
                            <span className="font-bold text-[var(--text-secondary)]">${Number(campaign.current_raised || 0).toLocaleString()} raised</span>
                            <span className="font-black text-[var(--text-primary)]">{progressPercent}% of ${Number(campaign.target_raise).toLocaleString()}</span>
                          </div>
                          <div className="w-full h-2.5 bg-[var(--surface-3)] rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${progressPercent}%` }} />
                          </div>
                        </div>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {[
                          { label: "Min Investment", value: campaign.min_investment ? `$${Number(campaign.min_investment).toLocaleString()}` : "—" },
                          { label: "Investors", value: `${campaign.investor_count || 0} interested` },
                          { label: "Active DD", value: campaign.active_dd_count || 0 },
                        ].map((metric, index) => (
                          <div key={index} className="p-2 rounded-lg bg-[var(--surface-2)] text-center">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{metric.label}</p>
                            <p className="text-[10px] font-bold text-[var(--text-primary)] mt-0.5">{metric.value}</p>
                          </div>
                        ))}
                      </div>
                      {campaign.closing_date && (
                        <p className="text-[10px] font-medium text-[var(--text-tertiary)]">Closing: {new Date(campaign.closing_date).toLocaleDateString()}</p>
                      )}
                    </div>
                  );
                })()}
                <div>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{detailVenture.description || "No description available."}</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Industry", value: detailVenture.industry || "—" },
                    { label: "Country", value: detailVenture.country || "—" },
                    { label: "Status", value: detailVenture.status || "—" },
                    { label: "Interest", value: `${detailVenture.investor_interest_count || 0} investors` },
                  ].map((metric, index) => (
                    <div key={index} className="p-3 rounded-xl bg-[var(--surface-3)]">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{metric.label}</p>
                      <p className="text-xs font-bold text-[var(--text-primary)] mt-1">{metric.value}</p>
                    </div>
                  ))}
                </div>
                {detailPipeline ? (
                  <div className="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border-primary)]">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2">Your Pipeline Status</p>
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${STAGE_COLORS[detailPipeline.stage]}`}>
                        {t(STAGE_LABELS[detailPipeline.stage] || "")}
                      </span>
                      <select value={detailPipeline.stage}
                        onChange={event => { addToPipeline(detailVenture.id, event.target.value); setDetailPipeline({...detailPipeline, stage: event.target.value}); }}
                        disabled={processingId !== null}
                        className="bg-[var(--surface-3)] border border-[var(--border-primary)] rounded-lg px-2 py-1 text-[10px] font-bold text-[var(--text-primary)] outline-none disabled:opacity-40 disabled:cursor-wait">
                        {PIPELINE_STAGES.map(stageOption => <option key={stageOption} value={stageOption}>{t(STAGE_LABELS[stageOption] || "")}</option>)}
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
                    {watchlist.some(entry => entry.venture_id === detailVenture.id) ? "Remove from Watchlist" : "Add to Watchlist"}
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
                {compareList.map(item => (
                  <span key={item.id} className="px-2 py-0.5 rounded-lg bg-[var(--surface-3)] text-[10px] font-bold truncate max-w-[100px]">{item.name}</span>
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
                    <th className="text-left px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] w-32">Metric</th>
                    {compareList.map(item => <th key={item.id} className="text-left px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-[var(--brand-orange)] uppercase">{item.name}</th>)}
                  </tr></thead>
                  <tbody className="divide-y divide-[var(--border-primary)]">
                    {[
                      { label: "Industry", key: "industry" },
                      { label: "Country", key: "country" },
                      { label: "Status", key: "status" },
                      { label: "Progress", key: "completion_index", fmt: value => value ? Number(value).toFixed(0)+'%' : "—" },
                      { label: "Interest", key: "investor_interest_count", fmt: value => (value||0)+' investors' },
                      { label: "Description", key: "description", fmt: value => value ? value.substring(0,100)+(value.length>100?'...':'') : "—" },
                    ].map((row, index) => (
                      <tr key={index}>
                        <td className="px-6 py-3 text-[10px] font-bold text-[var(--text-secondary)] uppercase">{row.label}</td>
                        {compareList.map(item => <td key={item.id} className="px-6 py-3 text-xs font-bold text-[var(--text-primary)]">{row.fmt ? row.fmt(item[row.key]) : (item[row.key]||"—")}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

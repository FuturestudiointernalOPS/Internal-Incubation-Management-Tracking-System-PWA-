"use client";

import { useState } from "react";
import { Loader2, Search, SlidersHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import AppButton from "@/components/ui/AppButton";
import GlobalToast from "@/components/ui/GlobalToast";
import { useI18n } from "@/lib/i18n";
import { useApi, cacheGet, cacheSet } from "@/lib/hooks/useApi";
import ParticipantDashboardHome from "@/components/dashboard/ParticipantDashboardHome";
import DashboardStats from "@/components/investor/dashboard-page/DashboardStats";
import DashboardTabs from "@/components/investor/dashboard-page/DashboardTabs";
import CampaignsSection from "@/components/investor/dashboard-page/CampaignsSection";
import UpcomingMeetingsSection from "@/components/investor/dashboard-page/UpcomingMeetingsSection";
import VentureFilters from "@/components/investor/dashboard-page/VentureFilters";
import VentureGrid from "@/components/investor/dashboard-page/VentureGrid";
import PipelineTab from "@/components/investor/dashboard-page/PipelineTab";
import WatchlistTab from "@/components/investor/dashboard-page/WatchlistTab";
import IntroRequestModal from "@/components/investor/dashboard-page/IntroRequestModal";
import VentureDetailModal from "@/components/investor/dashboard-page/VentureDetailModal";
import ComparisonBar from "@/components/investor/dashboard-page/ComparisonBar";
import ComparisonModal from "@/components/investor/dashboard-page/ComparisonModal";
import ProfileGate from "@/components/investor/dashboard-page/ProfileGate";
import { STAGE_LABELS } from "@/components/investor/dashboard-page/constants";

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
        <ProfileGate profile={profile} onSetupProfile={() => router.push("/investor/onboarding")} />
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

        <ParticipantDashboardHome />

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
        <DashboardStats stats={stats} />

        {/* TABS */}
        <DashboardTabs activeTab={activeTab} onTabChange={setActiveTab} />

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
            <CampaignsSection campaigns={campaigns} onOpenVenture={openVentureDetail} />

            {/* Upcoming Meetings */}
            <UpcomingMeetingsSection relationships={relationships} />

            {/* Advanced filters */}
            {showFilters && (
              <VentureFilters
                filterIndustry={filterIndustry}
                filterCountry={filterCountry}
                filterStage={filterStage}
                filterFundingMin={filterFundingMin}
                filterFundingMax={filterFundingMax}
                onToggleIndustry={(value) => { const nextIndustries = filterIndustry.includes(value) ? filterIndustry.filter(item => item !== value) : [...filterIndustry, value]; setFilterIndustry(nextIndustries); searchVentures({industry: nextIndustries}); }}
                onToggleCountry={(value) => { const nextCountries = filterCountry.includes(value) ? filterCountry.filter(item => item !== value) : [...filterCountry, value]; setFilterCountry(nextCountries); searchVentures({country: nextCountries}); }}
                onToggleStage={(value) => { const nextStages = filterStage.includes(value) ? filterStage.filter(item => item !== value) : [...filterStage, value]; setFilterStage(nextStages); searchVentures({stage: nextStages}); }}
                onFundingMinChange={setFilterFundingMin}
                onFundingMaxChange={setFilterFundingMax}
                onClear={() => { setFilterIndustry([]); setFilterCountry([]); setFilterStage([]); setFilterFundingMin(""); setFilterFundingMax(""); searchVentures({industry: [], country: [], stage: [], fundingMin: "", fundingMax: ""}); }}
              />
            )}

            {/* Results */}
            <VentureGrid
              items={ventures.length > 0 ? ventures : recommendations}
              venturesTotal={venturesTotal}
              campaigns={campaigns}
              watchlist={watchlist}
              compareList={compareList}
              processingId={processingId}
              pipeline={pipeline}
              onOpenDetail={openVentureDetail}
              onToggleCompare={toggleCompare}
              onToggleWatchlist={toggleWatchlist}
              onRequestIntro={(venture) => { setIntroVenture(venture); setIntroMessage(""); setShowIntroModal(true); }}
            />
          </div>
        )}

        {/* PIPELINE TAB */}
        {activeTab === "pipeline" && (
          <PipelineTab
            pipeline={pipeline}
            filteredPipeline={filteredPipeline}
            stageFilter={stageFilter}
            onStageFilterChange={setStageFilter}
            processingId={processingId}
            onAddToPipeline={addToPipeline}
            onOpenWorkspace={(pipelineId) => router.push(`/investor/diligence?pipeline_id=${pipelineId}`)}
          />
        )}

        {/* WATCHLIST TAB */}
        {activeTab === "watchlist" && (
          <WatchlistTab
            watchlist={watchlist}
            processingId={processingId}
            onOpenDetail={openVentureDetail}
            onToggleWatchlist={toggleWatchlist}
            onRequestIntro={(venture) => { setIntroVenture(venture); setIntroMessage(""); setShowIntroModal(true); }}
            onAddToPipeline={addToPipeline}
          />
        )}

        {/* INTRODUCTION REQUEST MODAL */}
        {showIntroModal && introVenture && (
          <IntroRequestModal
            introVenture={introVenture}
            introMessage={introMessage}
            onMessageChange={setIntroMessage}
            processingId={processingId}
            onClose={() => setShowIntroModal(false)}
            onSubmit={async () => {
              setProcessingId(introVenture.id);
              await addToPipeline(introVenture.id, "meeting_requested");
              setShowIntroModal(false);
              setIntroVenture(null);
            }}
          />
        )}

        {/* VENTURE DETAIL MODAL */}
        {detailVenture && (
          <VentureDetailModal
            detailVenture={detailVenture}
            detailPipeline={detailPipeline}
            campaigns={campaigns}
            watchlist={watchlist}
            processingId={processingId}
            onClose={() => { setDetailVenture(null); setDetailPipeline(null); }}
            onToggleCompare={toggleCompare}
            onToggleWatchlist={toggleWatchlist}
            onDetailStageChange={(stage) => { addToPipeline(detailVenture.id, stage); setDetailPipeline(previous => ({ ...previous, stage })); }}
            onAddDetailToPipeline={() => { addToPipeline(detailVenture.id, "interested"); setDetailPipeline({ stage: "interested" }); }}
          />
        )}

        {/* COMPARISON BAR + MODAL */}
        <ComparisonBar
          compareList={compareList}
          onCompare={() => setShowCompare(true)}
          onClear={() => setCompareList([])}
        />

        {showCompare && compareList.length >= 2 && (
          <ComparisonModal compareList={compareList} onClose={() => setShowCompare(false)} />
        )}
      </div>
    </>
  );
}

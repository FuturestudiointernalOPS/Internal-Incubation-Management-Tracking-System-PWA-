"use client";

import { useState } from "react";
import { ArrowRight, BriefcaseBusiness, CalendarClock, Search, SlidersHorizontal, RotateCw, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import AppButton from "@/components/ui/AppButton";
import LinkCard from "@/components/ui/LinkCard";
import PageHero from "@/components/ui/PageHero";
import SectionHead from "@/components/ui/SectionHead";
import GlobalToast from "@/components/ui/GlobalToast";
import { useI18n } from "@/lib/i18n";
import { useApi, cacheGet, cacheSet } from "@/lib/hooks/useApi";
import DashboardStats from "@/components/investor/dashboard-page/DashboardStats";
import DashboardTabs from "@/components/investor/dashboard-page/DashboardTabs";
import InvestorDashboardCharts from "@/components/investor/dashboard-page/InvestorDashboardCharts";
import IntroductionsTab from "@/components/investor/dashboard-page/IntroductionsTab";
import MeetingsTab from "@/components/investor/dashboard-page/MeetingsTab";
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

// The shape the screen renders from, so a failed or malformed payload never
// reaches a `.map` / `.total_*` read. Module scope keeps both values stable for
// the hook (an inline literal would refetch on every render).
const EMPTY_INVESTOR_DASHBOARD = {
  profile: null,
  pipeline: [],
  watchlist: [],
  recommendations: [],
  relationships: [],
  stats: {},
  features: {},
  weeklyActivity: null,
};
const pickInvestorDashboard = (response) =>
  response?.success
    ? {
        profile: response.profile ?? null,
        pipeline: response.pipeline || [],
        watchlist: response.watchlist || [],
        recommendations: response.recommendations || [],
        relationships: response.relationships || [],
        stats: response.stats || {},
        features: response.features || {},
        weeklyActivity: Array.isArray(response.weeklyActivity) ? response.weeklyActivity : null,
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
    relationships,
    stats,
    features,
    weeklyActivity,
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
  const [hasSearched, setHasSearched] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(false);

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
  const { data: introductions, refresh: refreshIntroductions } = useApi(features.introductions ? "/api/investor/introductions" : null, {
    defaultValue: [],
    transform: (response) => response?.success && Array.isArray(response.requests) ? response.requests : [],
  });
  const activeIntroductionCount = introductions.filter((request) =>
    ["submitted", "under_review", "approved"].includes(request.status),
  ).length;

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
        setToast({ type: "success", message: stage === "interested"
          ? t("dashboardV2.interestSaved")
          : t("dashboardV2.pipelineUpdated") });
        refresh();
      } else {
        setToast({ type: "error", message: t(data.error || "errors.somethingWrong") });
      }
    } catch (_) {
      setToast({ type: "error", message: t("errors.somethingWrong") });
    } finally {
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
        setToast({ type: "success", message: t(data.action === "added"
          ? "dashboardV2.watchlistAdded"
          : "dashboardV2.watchlistRemoved") });
        refresh();
      } else {
        setToast({ type: "error", message: t(data.error || "errors.somethingWrong") });
      }
    } catch (_) {
      setToast({ type: "error", message: t("errors.somethingWrong") });
    } finally {
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
    setSearchLoading(true);
    setSearchError(false);
    try {
      const response = await fetch(`/api/investor/ventures?${params}`);
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "errors.somethingWrong");
      }
      setVentures(data.ventures || []);
      setVenturesTotal(data.total || 0);
      setHasSearched(true);
    } catch (_) {
      setSearchError(true);
    } finally {
      setSearchLoading(false);
    }
  };

  const requestIntroduction = async () => {
    if (!introVenture) return;
    setProcessingId(introVenture.id);
    try {
      const response = await fetch("/api/investor/introductions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venture_id: String(introVenture.id),
          deal_flow_entry_id: introVenture.deal_flow_id ?? null,
          message: introMessage,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "errors.somethingWrong");
      }
      setShowIntroModal(false);
      setIntroVenture(null);
      setIntroMessage("");
      setToast({ type: "success", message: t("dashboardV2.requestSentToast") });
      setActiveTab("introductions");
      refreshIntroductions();
      refresh();
    } catch (requestError) {
      setToast({ type: "error", message: t(requestError.message || "errors.somethingWrong") });
    } finally {
      setProcessingId(null);
    }
  };

  // Open venture detail
  const openVentureDetail = async (venture, bypassCache = false) => {
    setDetailVenture(venture);
    void fetch("/api/investor/interactions", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "venture_viewed", venture_ids: [String(venture.id)] }) }).catch(() => {});
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
      <div className="mx-auto max-w-7xl space-y-4 p-4 sm:p-6" aria-busy="true" aria-label={t("common.loading")}>
        <div className="stf-card h-24 animate-pulse" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((item) => <div key={item} className="stf-card h-20 animate-pulse" />)}
        </div>
        <div className="stf-card h-52 animate-pulse" />
      </div>
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

  return (
    <>
      <div className="mx-auto flex max-w-7xl flex-col gap-6 p-4 sm:p-6">
        <GlobalToast toast={toast} onClose={() => setToast(null)} />

        <h1 className="sr-only">{t("dashboardV2.dashboardTitle")}</h1>
        <PageHero
          kicker={t("dashboardV2.kicker")}
          title={t("dashboardV2.welcome", { name: profile.organization_name || t("dashboardV2.investor") })}
          subtitle={t("dashboardV2.welcomeHint")}
          action={
            <AppButton variant="secondary" icon={ArrowRight} onClick={() => router.push("/investor/deal-flow")}>
              {t("dashboardV2.exploreDealFlow")}
            </AppButton>
          }
        />

        <section className="order-2" aria-label={t("dashboardV2.summary")}>
          <DashboardStats
            stats={stats}
            introductionCount={features.introductions ? activeIntroductionCount : 0}
            introductions={features.introductions}
            meetings={features.meetings}
            loading={loading}
            onNavigate={setActiveTab}
          />
        </section>

        <section className="order-3 space-y-3" aria-labelledby="investor-actions-title">
          <SectionHead
            letter="A"
            tone="o"
            icon={Sparkles}
            title={t("dashboardV2.actionNeeded")}
            subtitle={t("dashboardV2.actionHint")}
          />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {features.introductions && activeIntroductionCount > 0 ? (
              <LinkCard
                icon={Sparkles}
                tone="o"
                title={t("dashboardV2.viewRequests")}
                text={t("dashboardV2.introductionAction", { count: activeIntroductionCount })}
                tag={<span className="stf-tag o">{activeIntroductionCount}</span>}
                onClick={() => setActiveTab("introductions")}
              />
            ) : (
              <LinkCard
                icon={BriefcaseBusiness}
                tone="o"
                title={t("dashboardV2.exploreDealFlow")}
                text={t("dashboardV2.dealFlowHint")}
                onClick={() => router.push("/investor/deal-flow")}
              />
            )}
            <LinkCard
              icon={CalendarClock}
              tone="b"
              title={t("dashboardV2.upcomingMeetings")}
              text={t("dashboardV2.meetingsHint")}
              onClick={() => document.getElementById("upcoming-meetings")?.scrollIntoView({ behavior: "smooth" })}
            />
            <LinkCard
              icon={BriefcaseBusiness}
              tone="g"
              title={t("dashboardV2.reviewPipeline")}
              text={t("dashboardV2.pipelineHint")}
              onClick={() => setActiveTab("pipeline")}
            />
          </div>
        </section>

        <section id="upcoming-meetings" className="order-4" aria-label={t("dashboardV2.upcomingMeetings")}>
          <UpcomingMeetingsSection relationships={relationships} />
        </section>

        {recommendations.length > 0 && (
          <section className="order-5 space-y-3" aria-labelledby="recommended-title">
            <h2 id="recommended-title" className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">
              {t("dashboardV2.recommended")}
            </h2>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {recommendations.slice(0, 6).map((venture) => (
                <button
                  type="button"
                  key={venture.id}
                  onClick={() => openVentureDetail(venture)}
                  className="stf-card min-h-11 min-w-64 max-w-80 flex-1 text-left"
                >
                  <span className="block font-bold text-[var(--text-primary)]">{venture.name}</span>
                  <span className="stf-small">{[venture.industry, venture.country].filter(Boolean).join(" · ")}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {features.dashboardV2 && <div className="order-6 space-y-4">
          <InvestorDashboardCharts
            pipeline={pipeline}
            watchlist={watchlist}
            weeklyActivity={weeklyActivity}
          />
        </div>}

        {/* DISCOVER TAB */}
        <div className="order-7">
          <DashboardTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            introductions={features.introductions}
            introductionCount={activeIntroductionCount}
          />
        </div>

        <section id="investor-tabpanel" role="tabpanel" aria-labelledby={`investor-tab-${activeTab}`} className="order-8">
        {activeTab === "discover" && (
          <div className="space-y-4">
            {/* Search + Filter bar */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
                <input
                  type="text"
                  value={search}
                  aria-label={t("dashboardV2.searchLabel")}
                  onChange={event => setSearch(event.target.value)}
                  onKeyDown={event => event.key === "Enter" && searchVentures()}
                  placeholder={t("searchVentures")}
                  className="w-full pl-11 pr-4 py-3 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-brand-orange/60"
                />
              </div>
              <button
                type="button"
                aria-expanded={showFilters}
                onClick={() => setShowFilters(!showFilters)}
                className={`px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2 transition-all ${
                  showFilters ? "bg-[var(--brand-orange)] text-white" : "bg-[var(--surface-3)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                <SlidersHorizontal className="w-4 h-4" /> {t("filters")}
              </button>
              <AppButton variant="primary" size="sm" icon={Search} onClick={searchVentures} loading={searchLoading}>{t("search")}</AppButton>
            </div>

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
            {searchError && (
              <div className="stf-card flex flex-wrap items-center justify-between gap-3" role="alert">
                <p className="stf-small">{t("dashboardV2.loadError")}</p>
                <AppButton variant="secondary" size="sm" icon={RotateCw} onClick={searchVentures}>{t("dashboardV2.retry")}</AppButton>
              </div>
            )}
            <VentureGrid
              items={hasSearched ? ventures : recommendations}
              hasSearched={hasSearched}
              venturesTotal={venturesTotal}
              watchlist={watchlist}
              compareList={compareList}
              processingId={processingId}
              pipeline={pipeline}
              onOpenDetail={openVentureDetail}
              onToggleCompare={toggleCompare}
              onToggleWatchlist={toggleWatchlist}
              onRequestIntro={(venture) => { setIntroVenture(venture); setIntroMessage(""); setShowIntroModal(true); }}
              onAddToPipeline={addToPipeline}
              onClearSearch={() => {
                setSearch("");
                setFilterIndustry([]);
                setFilterCountry([]);
                setFilterStage([]);
                setFilterFundingMin("");
                setFilterFundingMax("");
                setHasSearched(false);
                setVentures([]);
              }}
              onOpenDealFlow={() => router.push("/investor/deal-flow")}
              introductions={features.introductions}
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
            introductions={features.introductions}
          />
        )}

        {activeTab === "introductions" && features.introductions && (
          <IntroductionsTab
            onMessage={(request) => {
              if (request.workspace_id) {
                router.push(`/investor/messages/${encodeURIComponent(request.workspace_id)}`);
              }
            }}
          />
        )}

        {activeTab === "meetings" && features.meetings && (
          <MeetingsTab />
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
              await requestIntroduction();
            }}
          />
        )}

        {/* VENTURE DETAIL MODAL */}
        {detailVenture && (
          <VentureDetailModal
            detailVenture={detailVenture}
            detailPipeline={detailPipeline}
            watchlist={watchlist}
            processingId={processingId}
            privateNotesEnabled={features.dashboardV2}
            onClose={() => { setDetailVenture(null); setDetailPipeline(null); }}
            onToggleCompare={toggleCompare}
            onToggleWatchlist={toggleWatchlist}
            onDetailStageChange={(stage) => { addToPipeline(detailVenture.id, stage); setDetailPipeline(previous => ({ ...previous, stage })); }}
            onAddDetailToPipeline={() => { addToPipeline(detailVenture.id, "interested"); setDetailPipeline({ stage: "interested" }); }}
            introductions={features.introductions}
            onRequestIntro={(venture) => {
              setDetailVenture(null);
              setDetailPipeline(null);
              setIntroVenture(venture);
              setIntroMessage("");
              setShowIntroModal(true);
            }}
          />
        )}

        {/* COMPARISON BAR + MODAL */}
        <ComparisonBar
          compareList={compareList}
          onCompare={() => {
            setShowCompare(true);
            void fetch("/api/investor/interactions", { method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ kind: "compare_used", venture_ids: compareList.map(venture => String(venture.id)) }) }).catch(() => {});
          }}
          onClear={() => setCompareList([])}
        />

        {showCompare && compareList.length >= 2 && (
          <ComparisonModal compareList={compareList} onClose={() => setShowCompare(false)} />
        )}
        </section>
      </div>
    </>
  );
}

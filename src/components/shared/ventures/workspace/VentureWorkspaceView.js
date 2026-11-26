"use client";

import { ArrowLeft } from "lucide-react";
import VenturePageHeader from "@/components/shared/ventures/console/VenturePageHeader";
import { ProfileTab } from "@/components/shared/ventures/console/workspace/tabs/ProfileSettingsTabs";
import VentureBaselineTab from "@/components/shared/ventures/console/workspace/tabs/VentureBaselineTab";
import { TeamTab } from "@/components/shared/ventures/console/workspace/tabs/MembersTabs";
import { DashboardTab } from "@/components/shared/ventures/console/workspace/tabs/DashboardHistoryTabs";
import { JourneyTab } from "@/components/shared/ventures/console/workspace/tabs/JourneyPlaybookTabs";
import VentureDataRoom from "@/components/shared/ventures/console/data-room/VentureDataRoom";
import {
  DataRoomReadinessCard,
  RoadmapReadinessCard,
} from "@/components/shared/ventures/console/workspace/tabs/GrowthTabs";
import VentureReportingScreen from "@/components/shared/ventures/console/reporting/VentureReportingScreen";
import {
  REPORTING_TAB,
  SETUP_SECTIONS,
  SETUP_TAB,
  tabsFor,
} from "@/components/shared/ventures/workspace/ventureScreenModel";

function tabLabelKey(tab) {
  if (tab === "dataRoom") return "dataRoom.title";
  if (tab === REPORTING_TAB) return "venture.reporting.tabLabel";
  return `venture.${tab}`;
}

// The Venture detail screen's markup. The screen owns every piece of state, the
// reads and the handlers; this view only paints them and reports intent back
// through the callbacks it is given. Its root is the same single <div> the
// screen used to render inline, so the DOM is unchanged.
export default function VentureWorkspaceView({
  venture,
  brandColor,
  activeTab,
  setupSection = "profile",
  onSection,
  onBack,
  canReport = false,
  t,
}) {
  // The Reporting door exists only for someone who may write here. The same
  // answer validated `?tab=` in the screen, so a deep link cannot open it.
  const tabs = tabsFor({ canReport });
  // Phase 1/2 shell: identity + status are shared components (see
  // components/ventures). Display name follows the admin rule company_name
  // first.
  const ventureDisplayName = venture.company_name || venture.name || "Venture";
  const openSetupSection = SETUP_SECTIONS.includes(setupSection)
    ? setupSection
    : "profile";

  return (
    <div className="max-w-6xl mx-auto space-y-6" style={{ color: "var(--text-primary)" }}>
      {/* Back */}
      <button onClick={onBack} className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-colors" style={{ color: "var(--text-secondary)" }}>
        <ArrowLeft size={16} /> {t("venture.myVentures")}
      </button>

      {/* Venture identity — shared header component (admin-consistent) */}
      <VenturePageHeader
        displayName={ventureDisplayName}
        brandColor={brandColor}
        ventureId={venture.venture_id}
        status={venture.status}
        logoUrl={venture.logo_url}
        metaItems={[
          t(`venture.stages.${venture.business_stage || "idea"}`),
          venture.industry,
          venture.country,
        ]}
      />

      {/* Tabs — admin-style: scrollable, uppercase, orange active underline */}
      <div className="flex items-center gap-1 border-b border-[var(--border-primary)] overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab} onClick={() => onSection(tab)}
            className={`px-3.5 py-2.5 text-[10px] font-black uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${activeTab === tab ? "text-[var(--brand-orange)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
            style={{ borderColor: activeTab === tab ? "var(--brand-orange)" : "transparent" }}
          >{t(tabLabelKey(tab))}</button>
        ))}
      </div>


      {/* Dashboard is the overview. Journey is the operating workspace. */}
      {activeTab === "dashboard" && <DashboardTab onSection={onSection} />}
      {/* Two indicators, each beside the thing that changes it: roadmap progress
          with the roadmap, Data Room readiness with the documents. */}
      {activeTab === "journey" && (
        <div className="space-y-4">
          <RoadmapReadinessCard />
          <JourneyTab />
        </div>
      )}
      {activeTab === "dataRoom" && (
        <div className="space-y-4">
          <DataRoomReadinessCard />
          <VentureDataRoom ventureId={venture.venture_id || venture.id} />
        </div>
      )}

      {/* SetUp groups Profile / Venture Baseline / Team — same screens as before,
          only the top-level door changed. */}
      {activeTab === SETUP_TAB && (
        <div className="space-y-4">
          <div className="flex items-center gap-1 border-b border-[var(--border-primary)] overflow-x-auto">
            {SETUP_SECTIONS.map((section) => (
              <button
                key={section}
                type="button"
                onClick={() => onSection(section)}
                className={`px-3 py-2 text-[10px] font-black uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${openSetupSection === section ? "text-[var(--brand-orange)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
                style={{ borderColor: openSetupSection === section ? "var(--brand-orange)" : "transparent" }}
              >
                {t(`venture.${section}`)}
              </button>
            ))}
          </div>
          {openSetupSection === "profile" && (
            <ProfileTab ventureId={venture.venture_id || venture.id} />
          )}
          {openSetupSection === "baseline" && (
            <VentureBaselineTab ventureId={venture.venture_id || venture.id} />
          )}
          {openSetupSection === "team" && <TeamTab />}
        </div>
      )}

      {/* The Venture Data Foundation: its own sub-tabs, inside the workspace the
          founder already opens. See docs/HANDOVER_VENTURES.md §1.5.
          `canReport` is checked as well as the tab: the screen already refuses to
          resolve `?tab=reporting` for a reader, and this keeps the two doors
          closed together rather than trusting one of them. */}
      {canReport && activeTab === REPORTING_TAB && (
        <VentureReportingScreen ventureId={venture.venture_id || venture.id} />
      )}

    </div>
  );
}

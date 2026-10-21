"use client";

import { ArrowLeft } from "lucide-react";
import VenturePageHeader from "@/components/ventures/VenturePageHeader";
import { ProfileTab } from "@/components/ventures/workspace/tabs/ProfileSettingsTabs";
import { TeamTab } from "@/components/ventures/workspace/tabs/MembersTabs";
import { DashboardTab } from "@/components/ventures/workspace/tabs/DashboardHistoryTabs";
import { JourneyTab } from "@/components/ventures/workspace/tabs/JourneyPlaybookTabs";
import VentureDataRoom from "@/components/ventures/data-room/VentureDataRoom";
import { InvestmentTab } from "@/components/ventures/workspace/tabs/GrowthTabs";
import { TABS } from "@/components/participant/ventures/ventureScreenModel";

// The Venture detail screen's markup. The screen owns every piece of state, the
// reads and the handlers; this view only paints them and reports intent back
// through the callbacks it is given. Its root is the same single <div> the
// screen used to render inline, so the DOM is unchanged.
export default function VentureWorkspaceView({
  venture,
  brandColor,
  activeTab,
  onSection,
  onBack,
  t,
}) {
  // Phase 1/2 shell: identity + status are shared components (see
  // components/ventures). Display name follows the admin rule company_name
  // first.
  const ventureDisplayName = venture.company_name || venture.name || "Venture";

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
        metaItems={[
          t(`venture.stages.${venture.business_stage || "idea"}`),
          venture.industry,
          venture.country,
        ]}
      />

      {/* Tabs — admin-style: scrollable, uppercase, orange active underline */}
      <div className="flex items-center gap-1 border-b border-[var(--border-primary)] overflow-x-auto">
        {TABS.map(tab => (
          <button key={tab} onClick={() => onSection(tab)}
            className={`px-3.5 py-2.5 text-[10px] font-black uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${activeTab === tab ? "text-[var(--brand-orange)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
            style={{ borderColor: activeTab === tab ? "var(--brand-orange)" : "transparent" }}
          >{t(tab === "dataRoom" ? "dataRoom.title" : `venture.${tab}`)}</button>
        ))}
      </div>


      {/* Dashboard is the overview. Journey is the operating workspace. */}
      {activeTab === "dashboard" && <DashboardTab onSection={onSection} />}
      {activeTab === "journey" && <JourneyTab />}
      {activeTab === "investment" && <InvestmentTab />}
      {activeTab === "dataRoom" && <VentureDataRoom ventureId={venture.venture_id || venture.id} />}
      {activeTab === "profile" && <ProfileTab />}
      {activeTab === "team" && <TeamTab />}

    </div>
  );
}

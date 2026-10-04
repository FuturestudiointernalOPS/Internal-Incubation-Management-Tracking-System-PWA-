"use client";

import { Loader2 } from "lucide-react";
import { VentureWorkspace } from "@/components/ventures/workspace/VentureContext";
import VentureWorkspaceView from "@/components/participant/ventures/VentureWorkspaceView";

// The Venture detail screen's composed shell: the loading and refusal
// fallbacks, then the workspace provider around the view. Rendering only — the
// screen owns every value and passes them down through `workspace` and the
// props below. The provider renders no DOM, so no wrapper node is introduced.
export default function VentureWorkspaceScreen({
  loading,
  venture,
  brandColor,
  activeTab,
  journeySub,
  onSection,
  onJourneySub,
  onBack,
  workspace,
  t,
}) {
  if (loading) return (
    <>
      <div className="flex justify-center py-20"><Loader2 className="animate-spin" style={{ color: "var(--text-secondary)" }} size={32} /></div>
    </>
  );

  if (!venture) return (
    <>
      <div className="p-6 text-center" style={{ color: "var(--text-secondary)" }}>{t("venture.loadError")}</div>
    </>
  );

  return (
    <VentureWorkspace.Provider value={workspace}>
      {/* Edge spacing belongs to the SHELL (DashboardLayout's main already pads
          every page); this page used to add its own p-6 on top, which doubled the
          gap to the edges. The width cap matches the stand-alone Venture
          dashboard so the workspace uses the screen instead of hugging a narrow
          column in the middle. */}
      <VentureWorkspaceView
        venture={venture}
        brandColor={brandColor}
        activeTab={activeTab}
        journeySub={journeySub}
        onSection={onSection}
        onJourneySub={onJourneySub}
        onBack={onBack}
        t={t}
      />
    </VentureWorkspace.Provider>
  );
}

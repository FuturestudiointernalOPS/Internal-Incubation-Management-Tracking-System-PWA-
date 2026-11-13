/**
 * The composed workspace shell: the header, the tab bar, the active tab body and
 * the overlays.
 *
 * Rendering only — the screen owns every value and passes them down; nothing
 * here owns state or reads data.
 */
import ProgramHeader from "@/spaces/staff/program-manager/components/program-workspace/ProgramHeader";
import ProgramTabs from "@/spaces/staff/program-manager/components/program-workspace/ProgramTabs";
import WorkspaceContent from "@/spaces/staff/program-manager/components/program-workspace/WorkspaceContent";
import WorkspaceModals from "@/spaces/staff/program-manager/components/program-workspace/WorkspaceModals";

export default function ProgramWorkspaceView({
  activeTab,
  ctx,
  onSelectTab,
  pendingSubmissionCount,
  program,
  submissionsSeen,
  tabs,
}) {
  return (
    <div className="space-y-8 animate-in">
      {/* HEADER SECTION */}
      <ProgramHeader program={program} />

      {/* TAB NAVIGATION */}
      <ProgramTabs
        activeTab={activeTab}
        onSelectTab={onSelectTab}
        pendingSubmissionCount={pendingSubmissionCount}
        submissionsSeen={submissionsSeen}
        tabs={tabs}
      />

      <WorkspaceContent ctx={ctx} />

      <WorkspaceModals ctx={ctx} />
    </div>
  );
}

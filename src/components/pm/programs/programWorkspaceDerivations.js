/**
 * Pure derived reads for the PM program workspace's chrome.
 *
 * The screen keeps the state and the hooks that call these; each function below
 * is a pure function of its arguments, so the results are unchanged.
 */
import { buildProgramTabs } from "@/components/pm/programs/programTabs";
import { selectVisibleTabs } from "@/components/pm/programs/programWorkspaceSelectors";

// Assigned registration form (public link) - resolved from the Form Run
// assigned directly to this Program (target_type = "program"), or to the
// person's family when the screen has no program id. The ADDRESS says which of
// the two questions is being asked, so "nothing to ask" is simply no address
// and the read's default (null) is what the header shows.
export function buildRegFormUrl(id, regGroupId) {
  return id
    ? `/api/platform/form-runs?program_id=${encodeURIComponent(String(id))}`
    : regGroupId
      ? `/api/platform/form-runs?group_id=${encodeURIComponent(String(regGroupId))}`
      : null;
}

export function countPendingSubmissions(submissions) {
  return submissions.filter((submission) => submission.status === "pending")
    .length;
}

// Tabs: show all tabs to anyone with edit rights, otherwise filter by roles array
export function selectWorkspaceTabs({ t, isAssignedPm, isTeamMember, user }) {
  return selectVisibleTabs({
    allTabs: buildProgramTabs(t),
    isAssignedPm,
    isTeamMember,
    user,
  });
}

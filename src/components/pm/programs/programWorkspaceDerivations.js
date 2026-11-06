/**
 * Pure derived reads for the PM program workspace's chrome.
 *
 * The screen keeps the state and the hooks that call these; each function below
 * is a pure function of its arguments, so the results are unchanged.
 */
import { buildProgramTabs } from "@/components/pm/programs/programTabs";
import { selectVisibleTabs } from "@/components/pm/programs/programWorkspaceSelectors";

// Assigned registration form (public link) — prefer a Form Run assigned to the
// Program (`target_type = "program"`). Callers that also know a family/group id
// should fall back to `buildRegFormGroupUrl` when the programme read is empty.
export function buildRegFormUrl(id, regGroupId) {
  if (id) {
    return `/api/platform/form-runs?program_id=${encodeURIComponent(String(id))}`;
  }
  return regGroupId
    ? `/api/platform/form-runs?group_id=${encodeURIComponent(String(regGroupId))}`
    : null;
}

/** Group/family-targeted registration run (fallback when the programme has none). */
export function buildRegFormGroupUrl(regGroupId) {
  return regGroupId
    ? `/api/platform/form-runs?group_id=${encodeURIComponent(String(regGroupId))}`
    : null;
}

export function countPendingSubmissions(submissions) {
  return submissions.filter((submission) => submission.status === "pending")
    .length;
}

// Tabs: show all tabs to anyone with edit rights, otherwise filter by roles array
export function selectWorkspaceTabs({
  t,
  isAssignedPm,
  isTeamMember,
  user,
  profiles = [],
}) {
  return selectVisibleTabs({
    allTabs: buildProgramTabs(t),
    isAssignedPm,
    isTeamMember,
    user,
    profiles,
  });
}

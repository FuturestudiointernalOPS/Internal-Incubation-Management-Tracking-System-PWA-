/** The program-level facilitator capabilities and their "all on" default. */

// Phase 7 (D7) — six rights granted but never consulted by a decision were
// retired (participants.manage, assignments.review, sessions.record,
// progress.view, groups.view, groups.manage). FULL_FACILITATOR_PERMISSIONS below
// derives from this list, so "full access" grants only consulted rights now.
export const FACILITATOR_CAPS = [
  { key: "participants.view", label: "pmMisc.facilitators.caps.viewParticipants" },
  { key: "attendance.view", label: "pmMisc.facilitators.caps.viewAttendance" },
  { key: "attendance.record", label: "pmMisc.facilitators.caps.recordAttendance" },
  { key: "assignments.view", label: "pmMisc.facilitators.caps.viewAssignments" },
  { key: "assignments.grade", label: "pmMisc.facilitators.caps.gradeAssignments" },
  { key: "sessions.conduct", label: "pmMisc.facilitators.caps.conductSessions" },
];

export const FULL_FACILITATOR_PERMISSIONS = FACILITATOR_CAPS.reduce((permissions, cap) => {
  permissions[cap.key] = cap.key.startsWith("view") ? 1 : 2;
  return permissions;
}, {});

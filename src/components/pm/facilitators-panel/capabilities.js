/** The program-level facilitator capabilities and their "all on" default. */

export const FACILITATOR_CAPS = [
  { key: "participants.view", label: "pmMisc.facilitators.caps.viewParticipants" },
  { key: "participants.manage", label: "pmMisc.facilitators.caps.manageParticipants" },
  { key: "attendance.view", label: "pmMisc.facilitators.caps.viewAttendance" },
  { key: "attendance.record", label: "pmMisc.facilitators.caps.recordAttendance" },
  { key: "assignments.view", label: "pmMisc.facilitators.caps.viewAssignments" },
  { key: "assignments.review", label: "pmMisc.facilitators.caps.reviewAssignments" },
  { key: "assignments.grade", label: "pmMisc.facilitators.caps.gradeAssignments" },
  { key: "sessions.conduct", label: "pmMisc.facilitators.caps.conductSessions" },
  { key: "sessions.record", label: "pmMisc.facilitators.caps.recordSessions" },
  { key: "progress.view", label: "pmMisc.facilitators.caps.viewProgress" },
  { key: "groups.view", label: "pmMisc.facilitators.caps.viewGroups" },
  { key: "groups.manage", label: "pmMisc.facilitators.caps.manageGroups" },
];

export const FULL_FACILITATOR_PERMISSIONS = FACILITATOR_CAPS.reduce((permissions, cap) => {
  permissions[cap.key] = cap.key.startsWith("view") ? 1 : 2;
  return permissions;
}, {});

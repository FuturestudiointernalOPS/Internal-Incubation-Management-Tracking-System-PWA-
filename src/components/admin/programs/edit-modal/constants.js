// Phase 7 (D7) — the six rights that were granted but never consulted by any
// decision (participants.manage, assignments.review, sessions.record,
// progress.view, groups.view, groups.manage) were retired. The tick list only
// offers rights a decision actually enforces.
export const FACILITATOR_CAPS = [
  { key: "participants.view", labelKey: "capParticipantsView" },
  { key: "attendance.view", labelKey: "capAttendanceView" },
  { key: "attendance.record", labelKey: "capAttendanceRecord" },
  { key: "assignments.view", labelKey: "capAssignmentsView" },
  { key: "assignments.grade", labelKey: "capAssignmentsGrade" },
  { key: "sessions.conduct", labelKey: "capSessionsConduct" },
];

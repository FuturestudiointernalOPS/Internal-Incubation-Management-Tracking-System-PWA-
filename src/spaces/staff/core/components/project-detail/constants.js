/**
 * Shared status colour and label maps for the staff project detail page.
 * Extracted verbatim from StaffProjectDetail.
 */
export const STATUS_COLORS = {
  Active: "text-emerald-500",
  Completed: "text-purple-500",
  Paused: "text-amber-500",
  Archived: "text-slate-500",
};

export const STATUS_BG = {
  Active: "bg-emerald-500/10",
  Completed: "bg-purple-500/10",
  Paused: "bg-amber-500/10",
  Archived: "bg-slate-500/10",
};

export const PROJECT_STATUS_LABELS = {
  Active: "staffMisc.projectDetail.statusActive",
  Completed: "staffMisc.projectDetail.statusCompleted",
  Paused: "staffMisc.projectDetail.statusPaused",
  Archived: "staffMisc.projectDetail.statusArchived",
};

export const BLOCKER_STATUS_LABELS = {
  active: "staffMisc.projectDetail.blockerStatusActive",
  resolved: "staffMisc.projectDetail.blockerStatusResolved",
};

export const MEMBER_ROLE_LABELS = {
  lead: "staffMisc.projectDetail.roleLead",
  member: "staffMisc.projectDetail.roleMember",
};

export const UPDATE_STATUS_LABELS = {
  on_track: "staffMisc.projectDetail.updateStatusOnTrack",
  at_risk: "staffMisc.projectDetail.updateStatusAtRisk",
  blocked: "staffMisc.projectDetail.updateStatusBlocked",
  completed: "staffMisc.projectDetail.updateStatusCompleted",
};

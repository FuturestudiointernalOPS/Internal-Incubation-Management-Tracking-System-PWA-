// ─── Module-scope readers ────────────────────────────────────────────────────
// The reading hook keys its internal work on these, so they are made once here
// rather than rebuilt on every render.

export const EMPTY_LIST = [];

export const pickProjects = (payload) => (payload?.success ? payload.projects || [] : []);

/** The analytics summary is optional: a refusal is an absent summary. */
export const pickAnalytics = (payload) => (payload?.success ? payload.analytics || null : null);

/** The people a project lead can be chosen from. */
export const pickActiveStaff = (payload) =>
  payload?.success
    ? (payload.contacts || []).filter(
        (contact) => contact.status === "active" && contact.role !== "participant",
      )
    : [];


export const STATUS_COLORS = {
  Active: "text-emerald-500",
  Completed: "text-purple-500",
  Paused: "text-amber-500",
};

export const STATUS_BG = {
  Active: "bg-emerald-500/10",
  Completed: "bg-purple-500/10",
  Paused: "bg-amber-500/10",
};

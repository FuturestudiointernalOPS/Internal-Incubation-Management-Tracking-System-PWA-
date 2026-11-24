/**
 * Shared vocabulary and pure helpers of the team workspace.
 *
 * Extracted from app/team/[id]/page.js without change: the default values the
 * reading hook keys its work on, the payload readers, the status and priority
 * colour tables and the date formatter. Pure module — no React, no fetch.
 */

export const EMPTY_MAP = {};
export const NO_DELIVERABLES = { list: [], upcoming: [] };

/** Every team the endpoint returns; the one on screen is picked from them. */
export const pickTeams = (payload) => (payload?.success && payload.teams ? payload.teams : []);
export const pickFirstProgram = (payload) =>
  payload?.success && payload.programs ? payload.programs[0] || null : null;

/**
 * The programme's deliverables, and the ones still ahead of us as a calendar.
 * The clock is read here rather than during the render because a transform runs
 * outside it; the loader this replaced read it in the same place.
 */
export const pickDeliverables = (payload) => {
  const list = payload?.success && payload.deliverables ? payload.deliverables : [];
  const now = new Date();
  const upcoming = list
    .filter((deliverable) => deliverable.due_date || deliverable.created_at)
    .map((deliverable) => ({
      ...deliverable,
      _date: deliverable.due_date ? new Date(deliverable.due_date) : new Date(deliverable.created_at),
    }))
    .filter((deliverable) => deliverable._date >= now)
    .sort((first, second) => first._date - second._date);
  return { list, upcoming };
};

/** This team's submissions, gathered under the deliverable they answer. */
export const pickSubmissionsByDeliverable = (payload) => {
  const byDeliverable = {};
  if (!payload?.success || !payload.submissions) return byDeliverable;
  for (const submission of payload.submissions) {
    const key = submission.deliverable_id || submission.requirement_id;
    if (!key) continue;
    if (!byDeliverable[key]) byDeliverable[key] = [];
    byDeliverable[key].push(submission);
  }
  return byDeliverable;
};

export const pickTasks = (payload) => (payload?.success ? payload.tasks || [] : []);

export const STATUS_COLORS = {
  approved: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-500",
    border: "border-emerald-500/20",
  },
  completed: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-500",
    border: "border-emerald-500/20",
  },
  pending: {
    bg: "bg-amber-500/10",
    text: "text-amber-500",
    border: "border-amber-500/20",
  },
  rejected: {
    bg: "bg-rose-500/10",
    text: "text-rose-500",
    border: "border-rose-500/20",
  },
  draft: {
    bg: "bg-indigo-500/10",
    text: "text-indigo-500",
    border: "border-indigo-500/20",
  },
};

export const PRIORITY_COLORS = {
  critical: {
    bg: "bg-red-500/10",
    text: "text-red-500",
  },
  high: {
    bg: "bg-amber-500/10",
    text: "text-amber-500",
  },
  medium: {
    bg: "bg-blue-500/10",
    text: "text-blue-500",
  },
  low: {
    bg: "bg-slate-500/10",
    text: "text-slate-500",
  },
};

export const fmtDate = (value) => {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};
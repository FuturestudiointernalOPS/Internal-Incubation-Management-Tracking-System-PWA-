/**
 * Venture OS canonical status vocabulary (Vinance 3 — Phase 1).
 *
 * Single source of truth for the statuses stored by the canonical
 * Journey → Milestone → Task → Submission spine. Progress calculations,
 * completion guards and read layers should derive from these helpers
 * instead of hardcoding literals.
 *
 * IMPORTANT: stored values are NEVER renamed or rewritten here. These
 * constants simply centralize the vocabulary that read layers rely on,
 * so "what counts as complete" is decided in exactly one place.
 */

// ─── Journey stages (venture_journey_stages.status) ───────────────────────
// date-driven: a Journey is `upcoming` until its own start_date arrives, then
// `active`, then `completed` once all its milestones are done. Journeys never
// wait for one another, so several can be `active` at the same time.
export const JOURNEY_STAGE_STATUSES = ["upcoming", "active", "completed"];
export const JOURNEY_STAGE_UPCOMING = "upcoming";
export const JOURNEY_STAGE_COMPLETED = "completed";

/** A Journey whose start date has not arrived yet (planning, not yet released). */
export function isJourneyStageUpcoming(status) {
  return status === JOURNEY_STAGE_UPCOMING;
}

export function isJourneyStageComplete(status) {
  return status === JOURNEY_STAGE_COMPLETED;
}

// ─── Milestones (venture_milestones.status) ────────────────────────────────
// Two HELD states sit before real work, and they mean different things:
//   `upcoming` — its Journey has not started yet (unreleased planning);
//   `blocked`  — its Journey is under way, but an explicit dependency it
//                declares is not completed yet. Position never holds work back:
//                only a dependency does.
export const MILESTONE_STATUSES = [
  "upcoming",
  "blocked",
  "not_started",
  "in_progress",
  "under_review",
  "changes_requested",
  "completed",
];
export const MILESTONE_UPCOMING = "upcoming";
export const MILESTONE_BLOCKED = "blocked";
export const MILESTONE_COMPLETED = "completed";

export function isMilestoneComplete(status) {
  return status === MILESTONE_COMPLETED;
}

/** A milestone the Venture cannot work on yet — unreleased, or dependency-held. */
export function isMilestoneHeld(status) {
  return status === MILESTONE_UPCOMING || status === MILESTONE_BLOCKED;
}

// The stored value `locked` predates the split above (it meant both "not
// started" and "dependency-held"). It is no longer written anywhere; these two
// constants exist so the read/release layers tolerate rows written before the
// vocabulary migration ran.
export const LEGACY_MILESTONE_LOCKED = "locked";
/** Every value a release sweep may still hold back (new + legacy). */
export const HELD_MILESTONE_STATUSES = [MILESTONE_UPCOMING, MILESTONE_BLOCKED, LEGACY_MILESTONE_LOCKED];

// ─── Tasks (venture_tasks.status) ──────────────────────────────────────────
// Board columns: the statuses the Kanban groups by (order = column order).
export const TASK_BOARD_COLUMNS = [
  "backlog",
  "todo",
  "in_progress",
  "review",
  "done",
  "blocked",
  "cancelled",
];

// Statuses written by the staff review flows (task reviews + submissions).
export const TASK_REVIEW_OUTCOME_STATUSES = [
  "accepted",
  "rejected",
  "revision_requested",
];

// Terminal-success statuses — what progress calculations count as complete.
// "done" is the board status; "accepted" is a task completed through review;
// "completed" is the legacy alias some older tools wrote.
export const TASK_COMPLETED_STATUSES = ["done", "accepted", "completed"];

// Completion statuses that are gated on an approved submission when the task
// is configured review_required = TRUE (completion authority, D5).
export const TASK_REVIEW_GATED_COMPLETION_STATUSES = TASK_COMPLETED_STATUSES;

export function isTaskComplete(status) {
  return TASK_COMPLETED_STATUSES.includes(status);
}

// ─── Task submissions (venture_task_submissions) ──────────────────────────
export const SUBMISSION_STATUSES = ["submitted"];
export const SUBMISSION_REVIEW_DECISIONS = ["approved", "changes_requested"];

export function isSubmissionApproved(submission) {
  return Boolean(submission && submission.review_decision === "approved");
}

// ═════════════════════════════════════════════════════════════════════════════
// DISPLAY VOCABULARY — ONE WORD PER STATE, EVERY SURFACE
//
// The stored values above are internal. This is the vocabulary a person READS.
// Super Admin (admin timeline/reports), the Venture Manager panel and the
// Founder journey tab all resolve their labels here, so the same state can
// never be called two different things again:
//
//   milestone not_started  → "Not Started"   (was "Not started" for the VM)
//   deliverable pending    → "Not Started"   (was "Pending")
//   deliverable submitted  → "Awaiting Review" (was "Submitted")
//   stage active           → "In Progress"    (was "Active")
//
// Rules:
//   • a word means ONE thing — "Not Started" never doubles as "Pending";
//   • colours are part of the word (one tone map, three surfaces);
//   • an unknown stored value NEVER gets a guessed word — the resolver returns
//     it raw so the caller can surface it instead of lying about the state.
//
// Words live under the shared `status.*` namespace (not per-feature copies).
// ═════════════════════════════════════════════════════════════════════════════

/** Display word ids — the vocabulary itself. */
export const STATUS_WORD_IDS = [
  "upcoming",
  "blocked",
  "not_started",
  "in_progress",
  "awaiting_review",
  "changes_requested",
  "completed",
  "approved",
];

/** word id → i18n key + tone (tone drives the colour, identical everywhere). */
export const STATUS_WORDS = {
  upcoming: { key: "status.upcoming", tone: "upcoming" },
  blocked: { key: "status.blocked", tone: "blocked" },
  not_started: { key: "status.notStarted", tone: "not_started" },
  in_progress: { key: "status.inProgress", tone: "in_progress" },
  awaiting_review: { key: "status.awaitingReview", tone: "awaiting_review" },
  changes_requested: { key: "status.changesRequested", tone: "changes_requested" },
  completed: { key: "status.completed", tone: "completed" },
  approved: { key: "status.approved", tone: "approved" },
};

/** tone → the ONE set of classes used by every surface (chip + dot). */
export const STATUS_TONE_CLASSES = {
  upcoming: { chip: "bg-slate-500/10 text-slate-400", dot: "bg-slate-600" },
  blocked: { chip: "bg-rose-500/10 text-rose-400", dot: "bg-rose-400" },
  not_started: { chip: "bg-slate-500/10 text-slate-400", dot: "bg-slate-500" },
  in_progress: { chip: "bg-sky-500/10 text-sky-400", dot: "bg-sky-400" },
  awaiting_review: { chip: "bg-amber-500/10 text-amber-400", dot: "bg-amber-400" },
  changes_requested: { chip: "bg-rose-500/10 text-rose-400", dot: "bg-rose-400" },
  completed: { chip: "bg-emerald-500/10 text-emerald-400", dot: "bg-emerald-400" },
  approved: { chip: "bg-emerald-500/10 text-emerald-400", dot: "bg-emerald-400" },
};

/** Known stored value → word id. Anything absent is UNKNOWN (never guessed). */
const STORED_TO_WORD = {
  // journey stages
  upcoming: "upcoming",
  active: "in_progress",
  completed: "completed",
  // legacy "locked" (retired stored value): a Journey that had not started.
  locked: "upcoming",
  // milestones
  blocked: "blocked",
  not_started: "not_started",
  in_progress: "in_progress",
  under_review: "awaiting_review",
  changes_requested: "changes_requested",
  // deliverables
  pending: "not_started",
  submitted: "awaiting_review",
  rejected: "changes_requested",
  approved: "approved",
};

/** word id (or unknown raw) → { id, key, tone, raw }. */
export function statusWord(id) {
  const word = STATUS_WORDS[id];
  if (!word) return { id: "unknown", key: null, tone: "not_started", raw: id ?? null };
  return { id, key: word.key, tone: word.tone, raw: null };
}

/** Any known stored value → its word; unknown values stay visible, not renamed. */
export function storedStatusWord(stored) {
  const normalized = String(stored || "").trim().toLowerCase();
  const id = STORED_TO_WORD[normalized];
  if (!id) return { id: "unknown", key: null, tone: "not_started", raw: normalized };
  return statusWord(id);
}

/** Journey stage (upcoming | active | completed) → word. */
export function stageStatusWord(status) {
  return storedStatusWord(status);
}

/** Milestone (upcoming | blocked | not_started | in_progress | under_review | changes_requested | completed) → word. */
export function milestoneStatusWord(status) {
  return storedStatusWord(status);
}

/**
 * Deliverable → word. Precedence is explicit and total, so a deliverable can
 * never fall through to the wrong word the way it did before (an in-progress
 * deliverable used to read "Pending" in the founder view because the branch
 * was missing there):
 *
 *   approved → changes requested → awaiting review → in progress → not started
 */
export function deliverableStatusWord(deliverable = {}) {
  const approval = String(deliverable.approval_status || "").trim().toLowerCase();
  const status = String(deliverable.status || "").trim().toLowerCase();

  if (approval === "approved" || status === "completed" || status === "accepted") {
    return statusWord("approved");
  }
  if (approval === "rejected" || status === "changes_requested" || status === "revision_requested") {
    return statusWord("changes_requested");
  }
  if (status === "submitted" || status === "under_review" || status === "review") {
    return statusWord("awaiting_review");
  }
  if (status === "in_progress") return statusWord("in_progress");
  return statusWord("not_started");
}

/**
 * The ONE label helper. Returns the translated word, or — when a state has no
 * word yet — the raw stored value, so a gap shows up in the UI as itself
 * instead of as a confidently wrong word (or a bare i18n key).
 */
export function statusLabel(word, t) {
  if (!word) return "—";
  if (word.key && typeof t === "function") {
    const translated = t(word.key);
    if (translated && translated !== word.key) return translated;
  }
  return word.raw || (word.id || "").replace(/_/g, " ") || "—";
}

/** Chip classes for a word (falls back to the not-started tone). */
export function statusChipClass(word) {
  return (STATUS_TONE_CLASSES[word?.tone] || STATUS_TONE_CLASSES.not_started).chip;
}

/** Dot classes for a word (falls back to the not-started tone). */
export function statusDotClass(word) {
  return (STATUS_TONE_CLASSES[word?.tone] || STATUS_TONE_CLASSES.not_started).dot;
}

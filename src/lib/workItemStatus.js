/**
 * WORK ITEM STATUS — one catalogue, three readers.
 *
 * The Project lens shows milestones, activities and deliverables in one table.
 * Each kind stores its own status vocabulary (a task has `backlog`, a milestone
 * has `not_started`, a deliverable has `pending`), which is honest: they are
 * different objects with different workflows.
 *
 * What must NOT differ is the MEANING. Every status rolls up to one of four
 * canonical categories — the same idea Jira calls status categories and ClickUp
 * calls status groups. Colour, filtering and every count read the category, so
 * "Backlog" and "Not started" can sit side by side and still be understood as
 * the same stage of work.
 *
 * Adding a status to a vocabulary is therefore a two-line change: the word, and
 * its category here. A word with no category falls back to `to_do` rather than
 * vanishing from the counts.
 */

/** The four categories, in workflow order. */
export const STATUS_CATEGORIES = ["to_do", "in_progress", "blocked", "done"];

/** Every status word the platform stores or displays, mapped to its category. */
const CATEGORY_BY_STATUS = {
  // to do
  backlog: "to_do",
  todo: "to_do",
  not_started: "to_do",
  pending: "to_do",
  planned: "to_do",
  upcoming: "to_do",
  draft: "to_do",

  // in progress
  in_progress: "in_progress",
  review: "in_progress",
  under_review: "in_progress",
  awaiting_review: "in_progress",
  submitted: "in_progress",
  changes_requested: "in_progress",
  revision_requested: "in_progress",

  // blocked
  blocked: "blocked",
  on_hold: "blocked",

  // done
  done: "done",
  completed: "done",
  approved: "done",
  accepted: "done",
  cancelled: "done",
  archived: "done",
};

/** The category a stored or displayed status belongs to. Unknown → `to_do`. */
export function statusCategory(status) {
  return CATEGORY_BY_STATUS[String(status || "").trim().toLowerCase()] || "to_do";
}

/**
 * Colour classes per category. The same stage of work must look the same
 * whichever kind of row carries it — that is the whole point of the category.
 */
export const CATEGORY_COLOR = {
  to_do: "bg-slate-500/10 text-slate-400",
  in_progress: "bg-amber-500/10 text-amber-400",
  blocked: "bg-rose-500/10 text-rose-400",
  done: "bg-emerald-500/10 text-emerald-400",
};

/** The i18n key suffix for a category chip (`to_do` → `toDo`). */
export function categoryKey(category) {
  return String(category || "").replace(/_([a-z])/g, (_match, letter) => letter.toUpperCase());
}

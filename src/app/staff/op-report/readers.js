/**
 * The screen's module-scope readers.
 *
 * What a stored report looks like when the form reads it, and the small
 * selectors the reading hooks key their internal work on. Pure: no React, no
 * state, no fetch of its own. Moved out of page.js as-is — both the page and
 * the actions import it.
 */


/** The tabs, as the address may name them. Anything else means the first one. */
export const REPORT_TABS = ["standup", "retro", "summary"];

// ─── Module-scope readers ────────────────────────────────────────────────────
// The reading hook keys its internal work on these, so they are made once here
// rather than rebuilt on every render.

export const EMPTY_LIST = [];
export const pickList = (field) => (payload) =>
  payload?.success ? payload[field] || [] : [];

// ─── The op-report read, and the form it fills ───────────────────────────

export const TASK_STATUSES = [
  "pending",
  "in_progress",
  "blocked",
  "carried_over",
  "completed",
];

// Before the report read has answered, the form is exactly the shape this screen
// has always started from — which is NOT the shape an empty report produces, so
// the two are kept apart rather than merged into one "empty".
export const INITIAL_FORM = {
  top_priorities: [],
  expected_deliverables: [],
  projects_tasks: "",
  has_dependencies: null,
  dependency_note: "",
  has_blockers: null,
  blocker_description: "",
  needs_support: null,
  support_note: "",
  additional_notes: "",
  completed_work: [],
  unfinished_tasks: [],
  challenges: "",
  week_status: "",
  had_blockers: null,
  blocker_type: "",
  blocker_desc: "",
  wins: [],
  major_achievement: "",
  carryover_items: [],
  retro_notes: "",
};

// What a week with no report yet produces, matching the loader's empty branch.
export const EMPTY_REPORT_FORM = {
  top_priorities: [],
  expected_deliverables: [],
  projects_tasks: "",
  has_dependencies: null,
  dependency_note: "",
  has_blockers: null,
  blocker_description: "",
  needs_support: null,
  support_note: "",
  additional_notes: "",
  completed_work: "",
  unfinished_tasks: "",
  challenges: "",
  wins: [],
  carryover_items: [],
  retro_notes: "",
};

export const EMPTY_REPORT = { report: null, answered: false };

/** A stored report as the form reads it: its JSON-encoded lists decoded. */
export function shapeReport(report) {
  if (!report) return null;
  const asList = (value) => {
    try {
      const parsed = typeof value === "string" ? JSON.parse(value) : value;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };
  const asListOrText = (value) => {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : value || "";
    } catch {
      return value || "";
    }
  };
  return {
    ...report,
    top_priorities: asList(report.top_priorities),
    expected_deliverables: asList(report.expected_deliverables),
    wins: asList(report.wins),
    carryover_items: asListOrText(report.carryover_items),
  };
}

// A refusal is reported as "not answered" rather than as an empty week: the form
// then keeps the shape it has always had while the read is outstanding.
export const pickReport = (payload) =>
  payload?.success
    ? { report: shapeReport(payload.reports?.[0] || null), answered: true }
    : EMPTY_REPORT;

/** The form values a stored report — or no report at all — produces. */
export const reportToForm = (report) =>
  report
    ? {
        top_priorities: report.top_priorities || [],
        expected_deliverables: report.expected_deliverables || [],
        projects_tasks: report.projects_tasks || "",
        has_dependencies:
          report.has_dependencies != null
            ? Boolean(report.has_dependencies)
            : null,
        dependency_note: report.dependency_note || "",
        has_blockers:
          report.has_blockers != null ? Boolean(report.has_blockers) : null,
        blocker_description: report.blocker_description || "",
        needs_support:
          report.needs_support != null ? Boolean(report.needs_support) : null,
        support_note: report.support_note || "",
        additional_notes: report.additional_notes || "",
        completed_work: report.completed_work || "",
        unfinished_tasks: report.unfinished_tasks || "",
        challenges: report.challenges || "",
        wins: report.wins || [],
        carryover_items: report.carryover_items || [],
        retro_notes: report.retro_notes || "",
      }
    : EMPTY_REPORT_FORM;

/** Every project this person is on, deduplicated: the flat list the picker uses. */
export const pickAssignments = (payload) => {
  if (!payload?.success) return EMPTY_LIST;
  const all = [
    ...(payload.owned || []),
    ...(payload.collab || []),
    ...(payload.all_active || []),
  ];
  const seen = new Set();
  return all.filter((project) => {
    if (seen.has(String(project.id))) return false;
    seen.add(String(project.id));
    return true;
  });
};

/** The Future Studio staff the collaborator picker offers. */
export const pickStudioStaff = (payload) =>
  (payload?.success ? payload.contacts || [] : [])
    .filter(
      (contact) =>
        contact.status === "active" &&
        contact.role !== "super_admin" &&
        contact.group_name?.toUpperCase() === "FUTURE STUDIO",
    )
    .map((contact) => ({
      id: contact.cid || contact.id,
      name: contact.name,
      email: contact.email,
    }))
    .sort((first, second) => first.name.localeCompare(second.name));

// Returns true when a stand-up draft actually contains something the user
// typed/added (a non-empty field or at least one task row). Empty drafts are
// not worth showing or keeping.
export function hasDraftContent(form, taskRows) {
  if (Array.isArray(taskRows) && taskRows.length > 0) return true;
  if (!form) return false;

  const arrayFields = [
    "top_priorities",
    "expected_deliverables",
    "completed_work",
    "unfinished_tasks",
    "wins",
    "carryover_items",
  ];
  for (const field of arrayFields) {
    if (Array.isArray(form[field]) && form[field].length > 0) return true;
  }

  const stringFields = [
    "projects_tasks",
    "dependency_note",
    "blocker_description",
    "support_note",
    "additional_notes",
    "challenges",
    "week_status",
    "blocker_type",
    "blocker_desc",
    "major_achievement",
    "retro_notes",
  ];
  for (const field of stringFields) {
    if (typeof form[field] === "string" && form[field].trim() !== "")
      return true;
  }

  return false;
}


/**
 * Venture-facing ROADMAP VISIBILITY (Vinance 3).
 *
 * A Venture sees the whole MAP and walks only the part it has reached.
 *
 * A member's read therefore lists EVERY Journey and EVERY Milestone with its
 * real status — nothing silently disappears from the roadmap — while the work
 * inside a not-yet-released (`locked`) item is WITHHELD:
 *
 *   sealed milestone  →  id, title, status, order, target date   (the map)
 *   open milestone    →  the above + description, objective, tasks, deliverables
 *
 * A sealed row carries `sealed: true` so a surface can render it AS locked
 * rather than pretending it does not exist, and its `deliverables` is an empty
 * array rather than absent, so a reader never has to tell "hidden" apart from
 * "none".
 *
 * `milestone_counts` is recomputed over EVERY milestone, so a member's "3 of 8"
 * is the real figure. A progress number computed over a filtered list is a lie,
 * which is exactly the confusion this projection exists to remove.
 *
 * This is a READ PROJECTION, never an authorization decision: it grants and
 * denies nothing. The caller decides who is entitled to the unsealed view (a
 * staff actor — see `roleIsPrivileged` in `ventureAuth`) and passes `unsealed`.
 *
 * It lives in one file because two readers must agree: `/journey` and
 * `/milestones` both feed the member's view, and two copies of this rule would
 * drift — one surface would seal what the other still handed over.
 */

/** The one status that means "defined by staff, not yet released to the Venture". */
export const SEALED_MILESTONE_STATUS = "locked";

/** A sealed milestone keeps its place on the map — and nothing about the work. */
const MILESTONE_MAP_FIELDS = [
  "id",
  "title",
  "status",
  "display_order",
  "target_date",
  "journey_stage_id",
];

/** A sealed stage keeps its name and place; these are internal planning. */
const STAGE_HELD_FIELDS = ["description", "objective"];

function sealMilestone(milestone) {
  const sealed = { sealed: true, deliverables: [] };
  for (const field of MILESTONE_MAP_FIELDS) {
    if (milestone[field] !== undefined) sealed[field] = milestone[field];
  }
  return sealed;
}

function openMilestone(milestone) {
  return { ...milestone, sealed: false, deliverables: milestone.deliverables || [] };
}

/**
 * Project ONE milestone for a Venture reader.
 *
 * @param {object} milestone
 * @param {{unsealed?: boolean}} [options] the caller's verdict that this reader
 *        may see unreleased work (staff actor / lead manager).
 */
export function projectMilestoneForVenture(milestone, { unsealed = false } = {}) {
  if (!milestone) return milestone;
  const sealed = !unsealed && milestone.status === SEALED_MILESTONE_STATUS;
  return sealed ? sealMilestone(milestone) : openMilestone(milestone);
}

/** Project a flat milestone list (the `/milestones` read). */
export function projectMilestonesForVenture(milestones, { unsealed = false } = {}) {
  return (milestones || []).map((m) => projectMilestoneForVenture(m, { unsealed }));
}

/**
 * Project a Journey stage — and the milestones bound to it — for a Venture
 * reader. A stage that is still `locked` is the future roadmap: its NAME and
 * status belong to the map the Venture is working towards, while its
 * description and objective are internal planning and are withheld.
 */
export function projectJourneyStageForVenture(stage, { unsealed = false } = {}) {
  if (!stage) return stage;
  const all = stage.milestones || [];
  const projected = {
    ...stage,
    milestones: projectMilestonesForVenture(all, { unsealed }),
    milestone_counts: {
      total: all.length,
      completed: all.filter((m) => m.status === "completed").length,
    },
    sealed: !unsealed && stage.status === "locked",
  };
  if (projected.sealed) {
    for (const field of STAGE_HELD_FIELDS) delete projected[field];
  }
  return projected;
}

/** Project a full journey read (the `/journey` stages array). */
export function projectJourneyStagesForVenture(stages, { unsealed = false } = {}) {
  return (stages || []).map((s) => projectJourneyStageForVenture(s, { unsealed }));
}

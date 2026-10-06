/**
 * Work items — the reusable management layer over Venture work (SERVICE).
 *
 * This module is the ONE place that knows how to turn a milestone, an activity
 * (task) or a deliverable into the same operational shape, so a management
 * screen — today the Projects view, later reminders and anything else — can ask
 * "what work is there, who owns it, when does it start and finish, what proves
 * it?" without re-deriving any of it.
 *
 * It reads through `@/models/workItems`, runs no SQL and speaks no HTTP. The
 * controller owns transport; this owns meaning.
 *
 * THREE RULES WORTH KNOWING BEFORE CHANGING ANYTHING HERE
 *
 * 1. ONE AUTHORITATIVE OWNER. A tracker says who owns a piece of work once. The
 *    milestone above an activity therefore DISPLAYS its first activity's owner
 *    rather than "not provided" — it never stores a second copy. Support is a
 *    separate list and is never promoted to owner.
 *
 * 2. EXTERNAL IS A NAME, NOT A MISSING ACCOUNT. An owner with no platform
 *    contact id is still an owner; it is flagged `external` so a human can
 *    resolve it later. Nothing here invents an identity.
 *
 * 3. BUCKETS COME FROM DATES, COMPLETION FROM STATUS. Today / Upcoming /
 *    Overdue are calendar facts about the finish date; an item is only
 *    "Completed" when its own status says so.
 */

import {
  selectWorkJourneyStages,
  selectWorkMilestones,
  selectWorkTasks,
  selectWorkDeliverables,
  selectWorkDependencyEdges,
} from "@/models/workItems";
import {
  TASK_COMPLETED_STATUSES,
  isMilestoneComplete,
  storedStatusWord,
  deliverableStatusWord,
} from "@/lib/ventureStatuses";

/** Work item kinds. A Journey is context, never an item. */
export const WORK_ITEM_KINDS = ["milestone", "activity", "deliverable"];

/** Edge type as the dependency table stores it → work item kind. */
const EDGE_TYPE_TO_KIND = { task: "activity", milestone: "milestone", deliverable: "deliverable" };

/** The buckets the management view filters by. */
export const WORK_ITEM_BUCKETS = ["today", "upcoming", "overdue", "completed"];

// ── small helpers ────────────────────────────────────────────────────────────

/** The calendar day of a value, as YYYY-MM-DD, or null. */
export function dayOf(value) {
  if (!value) return null;
  const text = value instanceof Date ? value.toISOString() : String(value);
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

/** Today, as the runtime derives it everywhere else (UTC day). */
export function todayIso(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

/** An assignment: a name, plus whether a platform account backs it. */
function assignment(cid, name) {
  const clean = String(name || "").trim();
  if (!clean) return null;
  return { name: clean, cid: cid ? String(cid) : null, external: !cid };
}

/** Split "David, Grace" into ["David", "Grace"] — display only, never identities. */
function supportingNames(value) {
  const clean = String(value || "").trim();
  if (!clean) return [];
  return clean
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Append to a Map<string, array>, creating the list on first use. */
function pushTo(map, key, value) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

/** A failed read is reported and degrades to "no rows", never to a blank page. */
function readFailure(label) {
  return (error) => {
    console.error(`[work-items] ${label} read failed:`, error?.message || error);
    return { rows: [] };
  };
}

/** The first item of a list, or null. */
function first(list) {
  return list && list.length > 0 ? list[0] : null;
}

// ── the shared shape ─────────────────────────────────────────────────────────

/**
 * The common operational shape every work item is returned in.
 *
 * `activity`, `deliverable` and `definition_of_done` are carried on EVERY kind,
 * not only on the one that owns them, so the detail view can always show the
 * chain Milestone -> Activity -> Deliverable -> Definition of Done.
 */
function shapeWorkItem({
  kind,
  row,
  ref = null,
  title,
  activity = null,
  deliverable = null,
  definitionOfDone = null,
  owner = null,
  supporting = null,
  start = null,
  finish = null,
  status,
  isComplete = false,
  journey = null,
  milestone = null,
  parent = null,
  dependsOn = [],
  blocks = [],
}) {
  return {
    id: `${kind}:${row.id}`,
    kind,
    ref: ref ? String(ref) : null,
    title: title || null,
    activity,
    deliverable,
    definition_of_done: definitionOfDone,
    owner,
    supporting,
    // Pre-split so no consumer re-implements the separator: the UI filters on
    // the names, and prints the raw string exactly as the tracker wrote it.
    supporting_names: supportingNames(supporting),
    start,
    finish,
    status: { id: status.id, key: status.key, tone: status.tone, raw: status.raw },
    is_complete: isComplete,
    journey: journey ? { id: journey.id, name: journey.name } : null,
    milestone: milestone ? { id: milestone.id, title: milestone.title } : null,
    parent,
    depends_on: dependsOn,
    blocks,
  };
}

// ── the read ─────────────────────────────────────────────────────────────────

/**
 * Everything the Projects view needs for ONE Venture: its work items in a
 * common shape, the filter options they imply, and the bucket counts.
 *
 * @returns {Promise<{ items: object[], options: object, summary: object, today: string }>}
 */
export async function buildWorkItems({ dbId, ventureCode, now = new Date() }) {
  const today = todayIso(now);

  const [stagesResult, milestonesResult, tasksResult, deliverablesResult, edgesResult] = await Promise.all([
    selectWorkJourneyStages(dbId, ventureCode).catch(readFailure("journey stages")),
    selectWorkMilestones(dbId, ventureCode).catch(readFailure("milestones")),
    selectWorkTasks(dbId, ventureCode).catch(readFailure("tasks")),
    selectWorkDeliverables(dbId, ventureCode).catch(readFailure("deliverables")),
    selectWorkDependencyEdges(dbId, ventureCode).catch(readFailure("dependencies")),
  ]);

  const stages = stagesResult.rows || [];
  const milestones = milestonesResult.rows || [];
  const tasks = tasksResult.rows || [];
  const deliverables = deliverablesResult.rows || [];

  // ── indexes ────────────────────────────────────────────────────────────────
  const stageById = new Map(stages.map((stage) => [String(stage.id), stage]));
  const milestoneById = new Map(milestones.map((milestone) => [String(milestone.id), milestone]));
  const taskById = new Map(tasks.map((task) => [String(task.id), task]));

  const tasksByMilestone = new Map();
  for (const task of tasks) {
    const key = String(task.milestone_id ?? "");
    if (key) pushTo(tasksByMilestone, key, task);
  }

  const deliverablesByTask = new Map();
  const deliverablesByMilestone = new Map();
  for (const deliverable of deliverables) {
    const taskKey = deliverable.task_id === null || deliverable.task_id === undefined ? null : String(deliverable.task_id);
    if (taskKey) pushTo(deliverablesByTask, taskKey, deliverable);
    const milestoneKey = String(deliverable.milestone_id ?? "");
    if (milestoneKey) pushTo(deliverablesByMilestone, milestoneKey, deliverable);
  }

  const journeyOf = (milestoneRow) =>
    milestoneRow ? stageById.get(String(milestoneRow.journey_stage_id ?? "")) || null : null;

  // ── dependency edges, in the words of the work items ──────────────────────
  // An edge reads "target depends on source" (that is how the ONE dependency
  // writer stores it), so an item's depends_on are the edges pointing AT it.
  const dependsOnByItem = new Map();
  const blocksByItem = new Map();

  for (const edge of edgesResult.rows || []) {
    const sourceKind = EDGE_TYPE_TO_KIND[String(edge.source_type || "").toLowerCase()];
    const targetKind = EDGE_TYPE_TO_KIND[String(edge.target_type || "").toLowerCase()];
    if (!sourceKind || !targetKind) continue;
    const sourceKey = `${sourceKind}:${edge.source_id}`;
    const targetKey = `${targetKind}:${edge.target_id}`;
    pushTo(dependsOnByItem, targetKey, sourceKey);
    pushTo(blocksByItem, sourceKey, targetKey);
  }

  // Resolve a raw edge key back to something a human reads.
  const labelByItemKey = new Map();
  const rememberLabel = (key, label) => {
    if (label && !labelByItemKey.has(key)) labelByItemKey.set(key, label);
  };
  for (const milestone of milestones) rememberLabel(`milestone:${milestone.id}`, milestone.title);
  for (const task of tasks) rememberLabel(`activity:${task.id}`, task.source_ref || task.title);
  for (const deliverable of deliverables) rememberLabel(`deliverable:${deliverable.id}`, deliverable.title);

  const labelsFor = (map, key) =>
    (map.get(key) || []).map((edgeKey) => ({
      id: edgeKey,
      label: labelByItemKey.get(edgeKey) || edgeKey,
    }));

  // ── the items ──────────────────────────────────────────────────────────────
  const items = [];
  const bucketOf = (item) => {
    if (item.is_complete) return "completed";
    if (item.finish && item.finish < today) return "overdue";
    if (item.start === today || item.finish === today) return "today";
    return "upcoming";
  };

  // Milestones — the milestone owns its people/timing where the source stated
  // them, and otherwise DISPLAYS its first activity's. That is the one-owner
  // rule: the value lives in one place and is shown at both levels.
  for (const milestone of milestones) {
    const activities = tasksByMilestone.get(String(milestone.id)) || [];
    const primary = first(activities);
    const primaryDeliverable = primary ? first(deliverablesByTask.get(String(primary.id)) || []) : null;
    const stage = journeyOf(milestone);
    const complete = isMilestoneComplete(milestone.status);

    items.push(
      shapeWorkItem({
        kind: "milestone",
        row: milestone,
        ref: primary?.source_ref || null,
        title: milestone.title,
        activity: primary ? primary.title : null,
        deliverable: primaryDeliverable ? primaryDeliverable.title : null,
        definitionOfDone: primary ? primary.definition_of_done : null,
        owner: assignment(milestone.owner_cid, milestone.owner_name) || assignment(primary?.assigned_cid, primary?.assigned_name),
        supporting: milestone.support_name || primary?.support_name || null,
        start: dayOf(milestone.start_date),
        finish: dayOf(milestone.finish_date),
        status: storedStatusWord(milestone.status),
        isComplete: complete,
        journey: stage,
        milestone,
        parent: stage ? { id: `journey:${stage.id}`, kind: "journey", title: stage.name } : null,
      }),
    );
  }

  // Activities (tasks) — the level that carries the tracker's own reference,
  // the support list and the Definition of Done.
  for (const task of tasks) {
    const milestone = milestoneById.get(String(task.milestone_id ?? "")) || null;
    const deliverable = first(deliverablesByTask.get(String(task.id)) || []);
    const status = storedStatusWord(task.status);

    items.push(
      shapeWorkItem({
        kind: "activity",
        row: task,
        ref: task.source_ref,
        title: task.title,
        activity: task.title,
        deliverable: deliverable ? deliverable.title : null,
        definitionOfDone: task.definition_of_done,
        owner: assignment(task.assigned_cid, task.assigned_name),
        supporting: task.support_name,
        start: dayOf(task.start_date),
        finish: dayOf(task.finish_date),
        status,
        isComplete: TASK_COMPLETED_STATUSES.includes(String(task.status || "").trim().toLowerCase()),
        journey: journeyOf(milestone),
        milestone,
        parent: milestone ? { id: `milestone:${milestone.id}`, kind: "milestone", title: milestone.title } : null,
      }),
    );
  }

  // Deliverables — the output. Its Activity supplies the work, the support and
  // the Definition of Done; the deliverable keeps its own owner and due date.
  for (const deliverable of deliverables) {
    const milestone = milestoneById.get(String(deliverable.milestone_id ?? "")) || null;
    const task = deliverable.task_id === null || deliverable.task_id === undefined
      ? null
      : taskById.get(String(deliverable.task_id)) || null;
    const status = deliverableStatusWord(deliverable);

    items.push(
      shapeWorkItem({
        kind: "deliverable",
        row: deliverable,
        ref: task?.source_ref || null,
        title: deliverable.title,
        activity: task ? task.title : null,
        deliverable: deliverable.title,
        definitionOfDone: task ? task.definition_of_done : null,
        owner: assignment(deliverable.assigned_cid, deliverable.assigned_name) || assignment(task?.assigned_cid, task?.assigned_name),
        supporting: task?.support_name || null,
        start: task ? dayOf(task.start_date) : null,
        finish: dayOf(deliverable.finish_date),
        status,
        isComplete: status.id === "approved",
        journey: journeyOf(milestone),
        milestone,
        parent: task
          ? { id: `activity:${task.id}`, kind: "activity", title: task.title }
          : milestone
            ? { id: `milestone:${milestone.id}`, kind: "milestone", title: milestone.title }
            : null,
      }),
    );
  }

  // Dependencies + buckets, once every item exists.
  for (const item of items) {
    item.depends_on = labelsFor(dependsOnByItem, item.id);
    item.blocks = labelsFor(blocksByItem, item.id);
    item.bucket = bucketOf(item);
  }

  items.sort(compareWorkItems);

  return {
    items,
    options: buildOptions(items, stages, milestones),
    summary: summarize(items),
    today,
  };
}

/** Finish date first (soonest, undated last), then start, then title. */
export function compareWorkItems(a, b) {
  if (a.finish !== b.finish) {
    if (!a.finish) return 1;
    if (!b.finish) return -1;
    return a.finish < b.finish ? -1 : 1;
  }
  if (a.start !== b.start) {
    if (!a.start) return 1;
    if (!b.start) return -1;
    return a.start < b.start ? -1 : 1;
  }
  return String(a.title || "").localeCompare(String(b.title || ""));
}

/** How many items sit in each bucket (plus the total). */
export function summarize(items = []) {
  const summary = { total: items.length, today: 0, upcoming: 0, overdue: 0, completed: 0 };
  for (const item of items) {
    if (summary[item.bucket] !== undefined) summary[item.bucket] += 1;
  }
  return summary;
}

/** The filter choices the loaded work implies — never a hardcoded list. */
function buildOptions(items, stages, milestones) {
  const owners = new Set();
  const supporting = new Set();
  const statuses = new Map();

  for (const item of items) {
    if (item.owner?.name) owners.add(item.owner.name);
    for (const name of item.supporting_names || []) supporting.add(name);
    if (item.status.key) statuses.set(item.status.id, item.status.key);
  }

  const sorted = (set) => [...set].sort((a, b) => a.localeCompare(b));

  return {
    journeys: stages.map((stage) => ({ id: String(stage.id), name: stage.name })),
    milestones: milestones.map((milestone) => ({
      id: String(milestone.id),
      title: milestone.title,
      journey_id: milestone.journey_stage_id ? String(milestone.journey_stage_id) : null,
    })),
    owners: sorted(owners),
    supporting: sorted(supporting),
    statuses: [...statuses.entries()].map(([id, key]) => ({ id, key })),
    kinds: WORK_ITEM_KINDS,
  };
}

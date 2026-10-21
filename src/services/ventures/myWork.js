/**
 * services/ventures/myWork — "what needs ME, and what needs the VENTURE".
 *
 * The founder's work queue, derived on read from the same spine every other
 * Venture surface reads (journey stages → milestones → tasks → submissions,
 * plus deliverables and venture-facing sessions). Nothing here is stored, so a
 * queue can never drift from the work it describes.
 *
 * ── FOUR RULES THIS FILE EXISTS TO KEEP ──────────────────────────────────────
 *
 * 1. PERSONAL IS AN IDENTITY, NEVER A NAME. A record is the caller's only when
 *    `assigned_cid` / `owner_cid` equals their contact id. An assignment that
 *    carries a name and no cid is an EXTERNAL person with no account: it stays
 *    venture-wide work and is never claimed on their behalf. The record says so
 *    with `owner.external` instead of guessing.
 *
 * 2. THE VENTURE DOES NOT SEE SEALED WORK. A milestone whose Journey has not
 *    started is unreleased planning (`lib/ventureVisibility`): its records are
 *    withheld from a member's queue exactly as they are withheld on the
 *    Journey. A staff actor (`unsealed`) keeps the full view.
 *
 * 3. DATES BUCKET, STATUS DECIDES. `overdue` and `due_soon` are calendar facts
 *    about an item that is still open; an item with no deadline is never given
 *    one. `awaiting_review` and `returned_for_changes` are STORED outcomes, so
 *    work that is with a reviewer is never dressed up as work the founder still
 *    owes, and returned work is never counted as awaiting review.
 *
 * 4. A COUNT IS THE LENGTH OF ITS OWN LIST. The buckets overlap on purpose (a
 *    returned item may also be past due), so every count is taken from the
 *    records returned beside it — never from a separate aggregate — and
 *    `total_open` is the one de-duplicated figure.
 *
 * Reads through `@/models/workItems` and the calendar model; no SQL here, no HTTP.
 */

import {
  selectWorkJourneyStages,
  selectWorkMilestones,
  selectWorkTasks,
  selectWorkDeliverables,
  selectWorkSubmissions,
} from "@/models/workItems";
import { listUpcomingVentureFacingSessions } from "@/models/ventureWorkspace/journeyAndReports/calendar";
import {
  TASK_COMPLETED_STATUSES,
  isMilestoneComplete,
  storedStatusWord,
  deliverableStatusWord,
} from "@/lib/ventureStatuses";
import { dayOf, todayIso } from "@/services/workItems";

/** The ONE due-soon window: seven days ahead, today included. */
export const DUE_SOON_DAYS = 7;

/**
 * Milestones the Venture cannot work on yet — its Journey has not started.
 * `locked` is the retired stored value; it is tolerated, never written.
 */
const SEALED_MILESTONE_STATUSES = ["upcoming", "locked"];

const CANCELLED = "cancelled";

/** Upcoming sessions carried on the queue (it is a nudge, not a calendar). */
const UPCOMING_SESSION_LIMIT = 5;

const statusOf = (row) => String(row?.status || "").trim().toLowerCase();

/** `YYYY-MM-DD` + N days, computed in UTC so a date never shifts by timezone. */
function addDays(dayIso, days) {
  const date = new Date(`${dayIso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** The identity half and the name half of an assignment — never one of them. */
function assignment(cid, name) {
  const clean = String(name || "").trim();
  if (!cid && !clean) return null;
  return { cid: cid ? String(cid) : null, name: clean || null, external: !cid };
}

/** A task still needs work unless it reached a terminal-success status. */
function isTaskOpen(task) {
  const status = statusOf(task);
  return !TASK_COMPLETED_STATUSES.includes(status) && status !== CANCELLED;
}

/** A deliverable is open until its evidence is approved (the one terminal state). */
function isDeliverableOpen(deliverable) {
  return deliverableStatusWord(deliverable).id !== "approved";
}

/**
 * The latest submission, reduced to what a founder may see: the state, the
 * date and the reviewer's written feedback. `reviewed_by` is deliberately not
 * carried — the founder needs to know WHAT to change, not who to chase.
 */
function submissionOf(row) {
  if (!row) return null;
  const state =
    row.review_decision === "approved"
      ? "approved"
      : row.review_decision === "changes_requested"
        ? "changes_requested"
        : "awaiting_review";
  return {
    id: row.id,
    version: row.version ?? null,
    state,
    submitted_at: row.created_at || null,
    reviewed_at: row.reviewed_at || null,
    feedback: row.review_comment || null,
  };
}

/** Append to a Map<string, value>, creating the entry on first use. */
function setOnce(map, key, value) {
  if (!map.has(key)) map.set(key, value);
}

/** Due date first (soonest, undated last), then title — one order everywhere. */
function compare(a, b) {
  if (a.record.due_date !== b.record.due_date) {
    if (!a.record.due_date) return 1;
    if (!b.record.due_date) return -1;
    return a.record.due_date < b.record.due_date ? -1 : 1;
  }
  return String(a.record.title || "").localeCompare(String(b.record.title || ""));
}

/**
 * The common shape of one piece of work, whatever level it came from.
 *
 * `open` and `needs_action` are internal to this module — they decide the
 * buckets and are never published: the published record carries the STORED
 * status and the STORED submission outcome instead, so a client cannot mistake
 * a derived flag for a fact.
 */
function shape({ kind, row, title, reference, milestone, journey, status, dueDate, owner, submission, href }) {
  return {
    id: `${kind}:${row.id}`,
    kind,
    record_id: row.id,
    title: title || null,
    reference: reference || null,
    milestone: milestone || null,
    journey: journey || null,
    status,
    due_date: dueDate || null,
    owner: owner || null,
    submission: submission || null,
    href: href || null,
  };
}

/**
 * Fold one list of entries into the five published categories.
 *
 * @param {Array<{record:object, open:boolean, needsAction:boolean}>} entries
 */
function classify(entries, { today, dueSoonEnd, mine }) {
  const buckets = {
    overdue: [],
    due_soon: [],
    awaiting_my_action: [],
    returned_for_changes: [],
    awaiting_review: [],
  };
  const openIds = new Set();

  const inScope = entries.filter((entry) => (mine ? entry.mine : !entry.mine));

  for (const entry of inScope) {
    const { record, open, needsAction } = entry;
    if (open) openIds.add(record.id);

    if (open && record.due_date) {
      if (record.due_date < today) buckets.overdue.push(entry);
      else if (record.due_date <= dueSoonEnd) buckets.due_soon.push(entry);
    }
    if (record.submission?.state === "awaiting_review") buckets.awaiting_review.push(entry);
    if (record.submission?.state === "changes_requested") buckets.returned_for_changes.push(entry);

    // Work already with a reviewer is not the founder's to submit again.
    const withReviewer = record.submission?.state === "awaiting_review";
    if (open && needsAction && !withReviewer) buckets.awaiting_my_action.push(entry);
  }

  const published = { counts: {} };
  for (const [key, list] of Object.entries(buckets)) {
    list.sort(compare);
    published[key] = list.map((entry) => entry.record);
    published.counts[key] = published[key].length;
  }
  published.counts.total_open = openIds.size;

  return published;
}

/**
 * Build the caller's work view for ONE Venture.
 *
 * @param {object} options
 * @param {string} options.dbId        the Venture's internal id
 * @param {string} options.ventureCode the Venture's human code (VNT-…)
 * @param {string|null} options.viewerCid the caller's contact id
 * @param {boolean} options.unsealed   staff verdict: may see unreleased planning
 * @param {string} options.workspaceHref where this caller opens work
 * @param {Date} [options.now]
 */
export async function buildMyWork({
  dbId,
  ventureCode,
  viewerCid,
  unsealed = false,
  workspaceHref,
  now = new Date(),
}) {
  const today = todayIso(now);
  const dueSoonEnd = addDays(today, DUE_SOON_DAYS);

  // A failed read is REPORTED, never rendered as "no work": an empty queue and
  // a broken query look identical to a founder unless the failure travels with
  // the answer. Each failure degrades only its own source.
  const failedReads = [];
  const failed = (label) => (error) => {
    failedReads.push(label);
    console.error(`[my-work] ${label} read failed:`, error?.message || error);
    return { rows: [] };
  };

  const [stagesResult, milestonesResult, tasksResult, deliverablesResult, submissionsResult, sessionsResult] =
    await Promise.all([
      selectWorkJourneyStages(dbId, ventureCode).catch(failed("journey_stages")),
      selectWorkMilestones(dbId, ventureCode).catch(failed("milestones")),
      selectWorkTasks(dbId, ventureCode).catch(failed("tasks")),
      selectWorkDeliverables(dbId, ventureCode).catch(failed("deliverables")),
      selectWorkSubmissions(dbId, ventureCode).catch(failed("submissions")),
      listUpcomingVentureFacingSessions(ventureCode, dbId, now.toISOString(), UPCOMING_SESSION_LIMIT).catch(
        failed("sessions"),
      ),
    ]);

  const stages = stagesResult.rows || [];
  const stageById = new Map(stages.map((stage) => [String(stage.id), stage]));
  const milestones = milestonesResult.rows || [];
  const milestoneById = new Map(milestones.map((milestone) => [String(milestone.id), milestone]));
  const tasks = tasksResult.rows || [];
  const deliverables = deliverablesResult.rows || [];
  const taskById = new Map(tasks.map((task) => [String(task.id), task]));

  const submissionsByTask = new Map();
  for (const row of submissionsResult.rows || []) {
    setOnce(submissionsByTask, String(row.task_id), row);
  }

  // ── sealed work (rule 2) ────────────────────────────────────────────────────
  const sealedMilestoneIds = new Set(
    milestones
      .filter((milestone) => !unsealed && SEALED_MILESTONE_STATUSES.includes(statusOf(milestone)))
      .map((milestone) => String(milestone.id)),
  );

  const isSealed = (milestoneId) =>
    milestoneId !== null && milestoneId !== undefined && sealedMilestoneIds.has(String(milestoneId));

  const journeyOf = (milestone) =>
    milestone
      ? stageById.get(String(milestone.journey_stage_id ?? "")) || null
      : null;

  const journeyRef = (stage) => (stage ? { id: String(stage.id), name: stage.name } : null);
  const milestoneRef = (milestone) =>
    milestone ? { id: String(milestone.id), title: milestone.title } : null;

  const entries = [];

  // ── milestones ──────────────────────────────────────────────────────────────
  // Their completion is a staff decision (the Lead Manager signs off), so a
  // milestone never lands in `awaiting_my_action`: the actionable work lives in
  // the tasks and deliverables beneath it.
  for (const milestone of milestones) {
    if (isSealed(milestone.id)) continue;
    const open = !isMilestoneComplete(statusOf(milestone));
    const dueDate = dayOf(milestone.finish_date);
    const owner = assignment(milestone.owner_cid, milestone.owner_name);
    entries.push({
      open,
      needsAction: false,
      mine: Boolean(viewerCid && owner?.cid && owner.cid === String(viewerCid)),
      record: shape({
        kind: "milestone",
        row: milestone,
        title: milestone.title,
        status: storedStatusWord(milestone.status),
        dueDate,
        owner,
        journey: journeyRef(journeyOf(milestone)),
        href: workspaceHref,
      }),
    });
  }

  // ── tasks (activities) ──────────────────────────────────────────────────────
  for (const task of tasks) {
    if (isSealed(task.milestone_id)) continue;
    const milestone = milestoneById.get(String(task.milestone_id ?? "")) || null;
    const submission = submissionOf(submissionsByTask.get(String(task.id)));
    const open = isTaskOpen(task);
    const owner = assignment(task.assigned_cid, task.assigned_name);
    entries.push({
      open,
      // Nothing submitted yet, or the reviewer sent it back: either way the
      // founder still has something to do. An approved submission is closed.
      needsAction: !submission || submission.state === "changes_requested",
      mine: Boolean(viewerCid && owner?.cid && owner.cid === String(viewerCid)),
      record: shape({
        kind: "task",
        row: task,
        title: task.title,
        reference: task.source_ref,
        milestone: milestoneRef(milestone),
        journey: journeyRef(journeyOf(milestone)),
        status: storedStatusWord(task.status),
        dueDate: dayOf(task.finish_date),
        owner,
        submission,
        href: workspaceHref,
      }),
    });
  }

  // ── deliverables (the evidence) ─────────────────────────────────────────────
  for (const deliverable of deliverables) {
    if (isSealed(deliverable.milestone_id)) continue;
    const milestone = milestoneById.get(String(deliverable.milestone_id ?? "")) || null;
    const task =
      deliverable.task_id === null || deliverable.task_id === undefined
        ? null
        : taskById.get(String(deliverable.task_id)) || null;
    const word = deliverableStatusWord(deliverable);

    // The stored review outcome, in the same vocabulary as a task submission:
    // `approval_status` is the authoritative review field (a review writes
    // approved | rejected; a fresh submission clears it back to NULL).
    const approval = String(deliverable.approval_status || "").trim().toLowerCase();
    const submission =
      word.id === "approved"
        ? { id: null, version: null, state: "approved", submitted_at: null, reviewed_at: null, feedback: null }
        : approval === "rejected"
          ? {
              id: null,
              version: null,
              state: "changes_requested",
              submitted_at: null,
              reviewed_at: null,
              feedback: deliverable.rejection_reason || null,
            }
          : word.id === "awaiting_review"
            ? { id: null, version: null, state: "awaiting_review", submitted_at: null, reviewed_at: null, feedback: null }
            : null;

    // The deliverable's own owner wins; otherwise it displays the owner of the
    // Activity that produces it (the one-owner rule of services/workItems).
    const owner =
      assignment(deliverable.assigned_cid, deliverable.assigned_name) ||
      assignment(task?.assigned_cid, task?.assigned_name);

    const open = isDeliverableOpen(deliverable);
    entries.push({
      open,
      needsAction: open && word.id !== "awaiting_review",
      mine: Boolean(viewerCid && owner?.cid && owner.cid === String(viewerCid)),
      record: shape({
        kind: "deliverable",
        row: deliverable,
        title: deliverable.title,
        reference: task?.source_ref || null,
        milestone: milestoneRef(milestone),
        journey: journeyRef(journeyOf(milestone)),
        status: word,
        dueDate: dayOf(deliverable.finish_date),
        owner,
        submission,
        href: workspaceHref,
      }),
    });
  }

  const personal = classify(entries, { today, dueSoonEnd, mine: true });
  const venture = classify(entries, { today, dueSoonEnd, mine: false });

  // ── the next milestone and the next session ─────────────────────────────────
  const openMilestones = milestones
    .filter((milestone) => !isSealed(milestone.id) && !isMilestoneComplete(statusOf(milestone)))
    .map((milestone) => ({ milestone, dueDate: dayOf(milestone.finish_date) }))
    .filter((row) => row.dueDate);

  const nextMilestoneRow =
    openMilestones
      .filter((row) => row.dueDate >= today)
      .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)))[0] ||
    openMilestones.sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)))[0] ||
    null;

  const nextMilestone = nextMilestoneRow
    ? {
        id: String(nextMilestoneRow.milestone.id),
        title: nextMilestoneRow.milestone.title,
        status: storedStatusWord(nextMilestoneRow.milestone.status),
        target_date: nextMilestoneRow.dueDate,
        journey: journeyRef(journeyOf(nextMilestoneRow.milestone)),
        href: workspaceHref,
      }
    : null;

  const sessions = (sessionsResult.rows || []).map((session) => ({
    id: session.id,
    title: session.title,
    session_type: session.session_type || null,
    status: session.status || null,
    start_time: session.start_time || null,
    end_time: session.end_time || null,
    location: session.location || null,
    meeting_link: session.meeting_link || null,
    journey: journeyRef(stageById.get(String(session.journey_stage_id ?? "")) || null),
    href: workspaceHref,
  }));

  return {
    venture_id: ventureCode,
    viewer: { cid: viewerCid ? String(viewerCid) : null },
    generated_at: now.toISOString(),
    rules: { due_soon_days: DUE_SOON_DAYS, today },
    // Whether every source loaded. `complete: false` means the numbers are real
    // but partial — an empty queue must never be mistaken for a clean one.
    source: { complete: failedReads.length === 0, failed_reads: failedReads },
    personal,
    venture: {
      ...venture,
      next_milestone: nextMilestone,
      next_session: sessions[0] || null,
      upcoming_sessions: sessions,
    },
  };
}

/**
 * Plan import — Shaping and validating a proposal: journeys, dates, dependency refs, owners, stats.
 *
 * Part of `services/ventures/planImport` (split out of the former single
 * 1 178-line module, lane L2; code moved verbatim). The public surface is
 * re-exported unchanged by `src/services/ventures/planImport.js`.
 */
import { selectOwnerByEmail, selectOwnerByName } from "@/models/venturePlanImportStore";

/** A fresh uuid without depending on the runtime exposing `crypto`. */
export function newUuid() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
        const random = (Math.random() * 16) | 0;
        const value = char === "x" ? random : (random & 0x3) | 0x8;
        return value.toString(16);
      });
}

/**
 * Dates the sheet never stated, SUGGESTED from the work it did state: a
 * milestone spans its own tasks, a journey spans its milestones.
 *
 * Only NULLS are filled — a date the document gave is never overwritten — and
 * anything filled this way is FLAGGED (`dates_derived`), so the screen can call
 * it a suggestion and the reviewer can change it. A suggestion a person can see
 * beats an empty field they must work out for themselves.
 */
export function deriveProposalDates(journeys, warnings = []) {
  let derivedMilestones = 0;
  const earliest = (values) => values.slice().sort()[0] || null;
  const latest = (values) => values.slice().sort().pop() || null;

  for (const journey of journeys) {
    for (const milestone of journey.milestones || []) {
      const starts = [];
      const ends = [];
      for (const task of milestone.tasks || []) {
        const start = task.start_date || task.due_date;
        const end = task.due_date || task.start_date;
        if (start) starts.push(start);
        if (end) ends.push(end);
      }
      let touched = false;
      if (!milestone.start_date && starts.length) {
        milestone.start_date = earliest(starts);
        touched = true;
      }
      if (!milestone.target_date && ends.length) {
        milestone.target_date = latest(ends);
        touched = true;
      }
      if (touched) {
        milestone.dates_derived = true;
        derivedMilestones += 1;
      }
    }

    // The journey spans the milestones as they now stand — including the ones
    // just derived, so the two levels cannot contradict each other.
    const milestoneStarts = (journey.milestones || []).map((item) => item.start_date).filter(Boolean);
    const milestoneEnds = (journey.milestones || []).map((item) => item.target_date).filter(Boolean);
    let journeyTouched = false;
    if (!journey.start_date && milestoneStarts.length) {
      journey.start_date = earliest(milestoneStarts);
      journeyTouched = true;
    }
    if (!journey.target_date && milestoneEnds.length) {
      journey.target_date = latest(milestoneEnds);
      journeyTouched = true;
    }
    if (journeyTouched) journey.dates_derived = true;
  }

  if (derivedMilestones > 0) {
    warnings.push(
      "Journey and milestone dates were not stated in the tracker — they are SUGGESTED from the task dates (earliest start to latest due). Check them before applying.",
    );
  }
  return journeys;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const toText = (value) => {
  const text = value === null || value === undefined ? "" : String(value).trim();
  return text || null;
};
const toDate = (value) => {
  const text = toText(value);
  return text && ISO_DATE.test(text) ? text : null;
};
const PRIORITIES = new Set(["high", "medium", "low"]);
const toPriority = (value) => {
  const text = String(value || "").trim().toLowerCase();
  return PRIORITIES.has(text) ? text : null;
};

/** How much structure a proposal carries. One definition: the interpreter
 *  reports it, the review surface recomputes it after an edit, and Phase 3 will
 *  confirm it against what actually got created. */
export function computeProposalStats(proposal) {
  const journeys = Array.isArray(proposal?.journeys) ? proposal.journeys : [];
  const stats = { journeys: journeys.length, milestones: 0, tasks: 0, deliverables: 0 };
  for (const journey of journeys) {
    const milestones = Array.isArray(journey?.milestones) ? journey.milestones : [];
    stats.milestones += milestones.length;
    for (const milestone of milestones) {
      const tasks = Array.isArray(milestone?.tasks) ? milestone.tasks : [];
      stats.tasks += tasks.length;
      for (const task of tasks) {
        stats.deliverables += Array.isArray(task?.deliverables) ? task.deliverables.length : 0;
      }
    }
  }
  return stats;
}

/** Which people in a proposal are still unresolved, so a review can say so
 *  after every edit rather than only on the first reading. */
export function collectUnmatchedOwners(proposal) {
  const names = new Set();
  for (const journey of proposal?.journeys || []) {
    for (const milestone of journey?.milestones || []) {
      for (const task of milestone?.tasks || []) {
        const name = toText(task?.owner_name);
        if (name && !toText(task?.owner_cid)) names.add(name);
      }
    }
  }
  return [...names];
}

/** Resolve one owner cell against the platform's contacts. Email first,
 *  then exact (case-insensitive) name. Anything else — including two contacts
 *  sharing a name — is UNRESOLVED and reported, never guessed. */
async function resolveOwner(cell) {
  const clean = String(cell || "").trim();
  if (!clean) return { cid: null, ambiguous: false };
  try {
    if (clean.includes("@")) {
      const byEmail = await selectOwnerByEmail(clean);
      const rows = byEmail.rows || [];
      if (rows.length === 1) return { cid: rows[0].cid, ambiguous: false };
      return { cid: null, ambiguous: rows.length > 1 };
    }
    const byName = await selectOwnerByName(clean);
    const rows = byName.rows || [];
    if (rows.length === 1) return { cid: rows[0].cid, ambiguous: false };
    return { cid: null, ambiguous: rows.length > 1 };
  } catch (_) {
    return { cid: null, ambiguous: false };
  }
}

/** Shape a raw journey list into what the platform can hold: known fields only,
 *  readable dates, normalized priorities, capped depth. Shared by the first
 *  reading and by every correction, so a revised plan is validated the same way
 *  the original was — one definition of "a proposal". */
export function normalizeJourneys(rawJourneys = []) {
  return (Array.isArray(rawJourneys) ? rawJourneys : []).slice(0, 10).map((journey) => ({
    name: toText(journey?.name) || "Proposed programme",
    objective: toText(journey?.objective),
    start_date: toDate(journey?.start_date),
    target_date: toDate(journey?.target_date),
    dates_derived: journey?.dates_derived === true || journey?.dates_derived === "true" ? true : null,
    milestones: (Array.isArray(journey?.milestones) ? journey.milestones : []).map((milestone) => ({
      ref: toText(milestone?.ref),
      name: toText(milestone?.name) || "Untitled milestone",
      description: toText(milestone?.description),
      objective: toText(milestone?.objective),
      priority: toPriority(milestone?.priority),
      start_date: toDate(milestone?.start_date),
      target_date: toDate(milestone?.target_date),
      dates_derived: milestone?.dates_derived === true || milestone?.dates_derived === "true" ? true : null,
      tasks: (Array.isArray(milestone?.tasks) ? milestone.tasks : []).map((task) => ({
        ref: toText(task?.ref),
        title: toText(task?.title) || "Untitled task",
        description: toText(task?.description),
        owner_name: toText(task?.owner_name),
        support: toText(task?.support),
        phase: toText(task?.phase),
        start_date: toDate(task?.start_date),
        due_date: toDate(task?.due_date),
        priority: toPriority(task?.priority),
        definition_of_done: toText(task?.definition_of_done),
        depends_on: (Array.isArray(task?.depends_on) ? task.depends_on : [])
          .map((reference) => String(reference).trim())
          .filter(Boolean),
        deliverables: (Array.isArray(task?.deliverables) ? task.deliverables : [])
          .map((deliverable) => ({ title: toText(deliverable?.title) }))
          .filter((deliverable) => deliverable.title),
      })),
    })),
  }));
}

/** Every task ref in the proposal — what a dependency is allowed to point at. */
export function collectTaskRefs(journeys = []) {
  const refs = new Set();
  for (const journey of journeys) {
    for (const milestone of journey.milestones || []) {
      for (const task of milestone.tasks || []) {
        if (task.ref) refs.add(task.ref);
      }
    }
  }
  return refs;
}

/** A dependency must point at a task that exists in THIS proposal; anything
 *  else is a human question, not a silent edge. Mutates and reports. */
export function validateDependencyRefs(journeys, warnings = []) {
  const refs = collectTaskRefs(journeys);
  for (const journey of journeys) {
    for (const milestone of journey.milestones || []) {
      for (const task of milestone.tasks || []) {
        const kept = [];
        for (const reference of task.depends_on || []) {
          if (refs.has(reference)) kept.push(reference);
          else warnings.push(`Dependency "${reference}" on "${task.title}" matches no task here — dropped.`);
        }
        task.depends_on = kept;
      }
    }
  }
  return journeys;
}

/**
 * Resolve every task owner against the platform's contacts.
 *
 * `keepCids` is `name(lowercased) → cid` for people a HUMAN already placed
 * (the stored proposal the reviewer corrected). Those are honoured as-is — a
 * person's deliberate choice is never re-litigated — while everyone else is
 * looked up by name, and an unresolved or ambiguous name is reported rather
 * than guessed at.
 */
export async function resolveProposalOwners(journeys, warnings = [], keepCids = new Map()) {
  const unmatched = new Set();
  const cache = new Map();
  for (const journey of journeys) {
    for (const milestone of journey.milestones || []) {
      for (const task of milestone.tasks || []) {
        const name = toText(task.owner_name);
        if (!name) {
          task.owner_cid = null;
          continue;
        }
        const key = name.toLowerCase();
        if (keepCids.has(key)) {
          task.owner_cid = keepCids.get(key);
          continue;
        }
        if (!cache.has(key)) cache.set(key, await resolveOwner(name));
        const resolved = cache.get(key);
        task.owner_cid = resolved?.cid || null;
        if (!task.owner_cid) {
          unmatched.add(name);
          if (resolved?.ambiguous) {
            warnings.push(`Owner "${name}" matches more than one contact — a human must choose.`);
          }
        }
      }
    }
  }
  return [...unmatched];
}

/** The people a stored proposal has already placed, so a correction keeps them. */
export function knownOwnerCids(proposal) {
  const known = new Map();
  for (const journey of proposal?.journeys || []) {
    for (const milestone of journey.milestones || []) {
      for (const task of milestone.tasks || []) {
        const name = toText(task.owner_name);
        const cid = toText(task.owner_cid);
        if (name && cid) known.set(name.toLowerCase(), cid);
      }
    }
  }
  return known;
}

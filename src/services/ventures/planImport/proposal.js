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

/**
 * Excel keeps a date as "days since 1899-12-30", so a tracker exported from a
 * spreadsheet carries 46331 rather than 2026-11-05.
 *
 * THE CONVERSION BELONGS HERE, IN CODE, never to the model. It is arithmetic,
 * and a model asked to do calendar arithmetic gets it wrong: 46331 came back as
 * 2026-11-01 (it is 2026-11-05) and 46366 as 2026-12-09 (it is 2026-12-10), and
 * one reading of a sheet abandoned the attempt altogether and returned every
 * date as null. Five lines of code are exact and repeatable; a language model
 * counting days is neither.
 */
const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);
export const excelSerialToIso = (value) => {
  const days = Number(value);
  // A day count for a plausible plan window (1982-2119). Anything else is not
  // a serial and must not be guessed at.
  if (!Number.isFinite(days) || days < 30000 || days > 80000) return null;
  return new Date(EXCEL_EPOCH_UTC + Math.round(days) * 86400000).toISOString().slice(0, 10);
};

export const toText = (value) => {
  const text = value === null || value === undefined ? "" : String(value).trim();
  return text || null;
};
const toDate = (value) => {
  const text = toText(value);
  if (!text) return null;
  if (ISO_DATE.test(text)) return text;
  // A bare five-digit day count is a spreadsheet serial, not a date shape.
  if (/^\d{5}$/.test(text)) return excelSerialToIso(text);
  return null;
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
 *  the original was — one definition of "a proposal".
 *
 *  A date the sheet STATED but that could not be read is reported by row name in
 *  `warnings`. It used to vanish in silence — twelve lost dates sat behind one
 *  generic line among twenty others, and the only way to find them was to compare
 *  the plan against the original document by hand. */
export function normalizeJourneys(rawJourneys = [], warnings = []) {
  /** A date that was stated but unreadable is a finding, not a blank. */
  const dateOf = (raw, where, field) => {
    const text = toText(raw);
    const iso = toDate(raw);
    if (text && !iso) {
      warnings.push(
        `${where}: the ${field} the sheet stated ("${text}") could not be read as a date, so it is missing — check it against the tracker.`,
      );
    }
    return iso;
  };

  return (Array.isArray(rawJourneys) ? rawJourneys : []).slice(0, 10).map((journey) => {
    const journeyName = toText(journey?.name) || "Proposed programme";
    return {
      name: journeyName,
      objective: toText(journey?.objective),
      start_date: dateOf(journey?.start_date, `Journey "${journeyName}"`, "Start"),
      target_date: dateOf(journey?.target_date, `Journey "${journeyName}"`, "Target"),
      dates_derived: journey?.dates_derived === true || journey?.dates_derived === "true" ? true : null,
      milestones: (Array.isArray(journey?.milestones) ? journey.milestones : []).map((milestone) => {
        const milestoneName = toText(milestone?.name) || "Untitled milestone";
        return {
          ref: toText(milestone?.ref),
          name: milestoneName,
          description: toText(milestone?.description),
          objective: toText(milestone?.objective),
          priority: toPriority(milestone?.priority),
          // The journey the EXPLICIT milestone list places this milestone under. The
          // list is the authority for structure, so the home is data too — a part that
          // named the wrong journey cannot scatter the plan, because the placement is
          // applied once, on the merged proposal.
          journey_name: toText(milestone?.journey_name),
          // The activity ids an EXPLICIT milestone list says belong here. Kept as
          // data so the placement can be applied across the parts of a sheet that
          // was read in several passes — the list states the membership, so it must
          // not depend on which pass happened to carry the row.
          task_refs: (Array.isArray(milestone?.task_refs) ? milestone.task_refs : [])
            .map((reference) => String(reference).trim())
            .filter(Boolean),
          // A milestone the analyst could not group honestly says so, and says why.
          // Stored rather than dropped: "this needs a human" is a finding the review
          // screen must be able to show, not a warning that scrolls away.
          requires_review: milestone?.requires_review === true || milestone?.requires_review === "true" ? true : null,
          reason: toText(milestone?.reason),
          start_date: dateOf(milestone?.start_date, `Milestone "${milestoneName}"`, "Start"),
          target_date: dateOf(milestone?.target_date, `Milestone "${milestoneName}"`, "Target"),
          dates_derived: milestone?.dates_derived === true || milestone?.dates_derived === "true" ? true : null,
          tasks: (Array.isArray(milestone?.tasks) ? milestone.tasks : []).map((task) => {
            const ref = toText(task?.ref);
            const where = ref ? `Task ${ref}` : `Task "${toText(task?.title) || "untitled"}"`;
            return {
              ref,
              title: toText(task?.title) || "Untitled task",
              description: toText(task?.description),
              owner_name: toText(task?.owner_name),
              support: toText(task?.support),
              phase: toText(task?.phase),
              start_date: dateOf(task?.start_date, where, "Start"),
              due_date: dateOf(task?.due_date, where, "Due"),
              priority: toPriority(task?.priority),
              definition_of_done: toText(task?.definition_of_done),
              depends_on: (Array.isArray(task?.depends_on) ? task.depends_on : [])
                .map((reference) => String(reference).trim())
                .filter(Boolean),
              deliverables: (Array.isArray(task?.deliverables) ? task.deliverables : [])
                .map((deliverable) => ({ title: toText(deliverable?.title) }))
                .filter((deliverable) => deliverable.title),
            };
          }),
        };
      }),
    };
  });
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

/** A name as a match key: case, "&"/"and" and punctuation are not meaning. */
const nameKey = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Fold one copy of a stated milestone into the copy already standing in its
 *  journey: tasks and stated refs are the union, and the first value of everything
 *  else wins — the same rule the parts themselves were merged under. */
function keepMilestone(journey, milestone) {
  const key = nameKey(milestone?.name);
  const existing = (journey.milestones || []).find((item) => nameKey(item?.name) === key);
  if (!existing) {
    journey.milestones = [...(journey.milestones || []), milestone];
    return;
  }

  const seen = new Set((existing.tasks || []).map((task) => nameKey(task?.ref) || `t:${nameKey(task?.title)}`));
  for (const task of milestone.tasks || []) {
    const identity = nameKey(task?.ref) || `t:${nameKey(task?.title)}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    existing.tasks = [...(existing.tasks || []), task];
  }

  existing.task_refs = existing.task_refs || [];
  const stated = new Set(existing.task_refs.map((reference) => nameKey(reference)));
  for (const reference of milestone.task_refs || []) {
    if (stated.has(nameKey(reference))) continue;
    stated.add(nameKey(reference));
    existing.task_refs.push(reference);
  }

  for (const field of ["ref", "description", "objective", "priority", "start_date", "target_date", "reason"]) {
    if (!existing[field] && milestone[field]) existing[field] = milestone[field];
  }
  if (existing.requires_review !== true && milestone.requires_review === true) existing.requires_review = true;
  if (existing.dates_derived !== true && milestone.dates_derived === true) existing.dates_derived = true;
}

/**
 * Put every stated milestone under the journey ITS OWN LIST places it in.
 *
 * THE JOURNEY LAYER NEEDED THE SAME TREATMENT AS THE TASK LAYER. A sheet read in
 * parts is interpreted one part at a time, and the parts disagreed about where the
 * plan lives: the parts carrying rows described the workbook by its TITLE, while the
 * parts carrying the milestone list described the programmes the workbook actually
 * names. Merging kept both, so the plan arrived as one journey holding every
 * milestone and every activity, PLUS six journeys holding the same nineteen
 * milestones, empty — and the reviewer had to work out which half was real.
 *
 * The list states the home, so the home is DATA (`journey_name`), applied here on the
 * merged proposal BY THE STATED JOURNEY'S NAME — never by milestone name alone,
 * because "Regulatory & Corridor Intelligence" legitimately stands under two
 * different journeys, and name-matching would move real work between them.
 *
 * A journey the list names but no part emitted is CREATED: the list is the authority
 * for structure, and omitting it would drop stated structure rather than a duplicate.
 * A journey the list does NOT name and that is left holding nothing is REMOVED — it is
 * a heading invented from the workbook's own title, and an invented heading is not
 * something a reviewer should have to notice and delete by hand. A journey the list
 * DOES name is kept even when empty: there, the emptiness is a finding.
 */
export function placeMilestonesByStatedJourneys(journeys = [], warnings = []) {
  const statedNames = new Map();
  for (const journey of journeys) {
    for (const milestone of journey.milestones || []) {
      const name = toText(milestone?.journey_name);
      if (name && !statedNames.has(nameKey(name))) statedNames.set(nameKey(name), name);
    }
  }
  // No stated journey anywhere: the workbook's structure is the analyst's own, and
  // this pass must not touch it.
  if (statedNames.size === 0) return { moved: 0, created: 0, dropped: 0 };

  const byName = new Map();
  for (const journey of journeys) {
    const key = nameKey(journey?.name);
    if (key && !byName.has(key)) byName.set(key, journey);
  }

  let created = 0;
  for (const [key, name] of statedNames) {
    if (byName.has(key)) continue;
    const journey = { name, objective: null, start_date: null, target_date: null, dates_derived: null, milestones: [] };
    journeys.push(journey);
    byName.set(key, journey);
    created += 1;
  }

  let moved = 0;
  for (const journey of journeys) {
    const kept = [];
    for (const milestone of journey.milestones || []) {
      const stated = toText(milestone?.journey_name);
      const home = stated ? byName.get(nameKey(stated)) : null;
      if (!home || home === journey) {
        kept.push(milestone);
        continue;
      }
      keepMilestone(home, milestone);
      moved += 1;
    }
    journey.milestones = kept;
  }

  const dropped = [];
  const survivors = [];
  for (const journey of journeys) {
    if ((journey.milestones || []).length === 0 && !statedNames.has(nameKey(journey?.name))) {
      dropped.push(journey.name);
      continue;
    }
    survivors.push(journey);
  }
  journeys.splice(0, journeys.length, ...survivors);

  if (moved > 0 || created > 0 || dropped.length > 0) {
    warnings.push(
      `The workbook's own milestone list states which journey each milestone belongs to: ${moved} milestone(s) were placed in the journey that states them` +
        (created > 0 ? `, ${created} journey(s) it names were added` : "") +
        (dropped.length > 0
          ? `, and ${dropped.length} journey(s) it does not name, left holding nothing, were removed (${dropped.slice(0, 5).join(", ")}${dropped.length > 5 ? ", and more" : ""})`
          : "") +
        ".",
    );
  }
  return { moved, created, dropped: dropped.length };
}

/**
 * Give every explicit milestone the activities IT names — once the parts are one.
 *
 * A sheet read in several passes is interpreted one pass at a time, so a milestone
 * whose list states "MS-01, MS-02, MS-04" is described in a pass that may not
 * CONTAIN those rows. The analyst could then only report "none of those activities
 * appear in the portion of the Tracker provided", and milestones arrived empty with
 * a "Needs review — assign the activities" banner — for a mapping the workbook had
 * already stated.
 *
 * The membership is DATA (`task_refs`), so it is applied here: once, on the merged
 * proposal, BY REFERENCE. References are unique, which is what makes this safe in a
 * workbook where a milestone NAME is not — "Regulatory & Corridor Intelligence"
 * legitimately appears under two different pillars, so matching by name would move
 * real work into the wrong journey.
 */
export function placeTasksByStatedRefs(journeys = [], warnings = []) {
  const byRef = new Map();
  for (const journey of journeys) {
    for (const milestone of journey.milestones || []) {
      for (const ref of milestone.task_refs || []) {
        const key = String(ref).trim().toLowerCase();
        if (key && !byRef.has(key)) byRef.set(key, milestone);
      }
    }
  }
  if (byRef.size === 0) return { moved: 0, cleared: 0 };

  const moves = [];
  for (const journey of journeys) {
    for (const milestone of journey.milestones || []) {
      for (const task of milestone.tasks || []) {
        const target = byRef.get(String(task?.ref || "").trim().toLowerCase());
        if (target && target !== milestone) moves.push({ task, from: milestone, to: target });
      }
    }
  }

  let moved = 0;
  for (const { task, from, to } of moves) {
    const ref = String(task?.ref || "").trim().toLowerCase();
    const alreadyThere = (to.tasks || []).some(
      (existing) => String(existing?.ref || "").trim().toLowerCase() === ref,
    );
    from.tasks = (from.tasks || []).filter((item) => item !== task);
    if (alreadyThere) continue;
    to.tasks = [...(to.tasks || []), task];
    moved += 1;
  }

  // A milestone that now holds the activities its own list named no longer needs a
  // human: the doubt was "those rows were not in this part", and they are here now.
  let cleared = 0;
  for (const journey of journeys) {
    for (const milestone of journey.milestones || []) {
      if (milestone.requires_review !== true) continue;
      const stated = (milestone.task_refs || []).map((ref) => String(ref).trim().toLowerCase()).filter(Boolean);
      if (stated.length === 0) continue;
      const held = new Set(
        (milestone.tasks || []).map((task) => String(task?.ref || "").trim().toLowerCase()).filter(Boolean),
      );
      if (stated.every((ref) => held.has(ref))) {
        milestone.requires_review = null;
        milestone.reason = null;
        cleared += 1;
      }
    }
  }

  if (moved > 0 || cleared > 0) {
    warnings.push(
      `The tracker's milestone list states which activities belong to each milestone: ${moved} activity(ies) were placed by that stated membership, and ${cleared} milestone(s) no longer need review.`,
    );
  }
  return { moved, cleared };
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

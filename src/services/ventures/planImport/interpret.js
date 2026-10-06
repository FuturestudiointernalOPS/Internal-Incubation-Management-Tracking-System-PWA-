/**
 * Plan import — Reading a tracker with the model into a proposal (knowing the existing programme).
 *
 * Part of `services/ventures/planImport` (split out of the former single
 * 1 178-line module, lane L2; code moved verbatim). The public surface is
 * re-exported unchanged by `src/services/ventures/planImport.js`.
 */
import { deepseekIntelligence } from "@/lib/deepseek";
import { selectExistingJourneyStages, selectExistingMilestones } from "@/models/venturePlanImportStore";
import { buildPlanPrompt, renderPlanSheets } from "./prompt";
import {
  computeProposalStats,
  deriveProposalDates,
  normalizeJourneys,
  resolveProposalOwners,
  toText,
  validateDependencyRefs,
} from "./proposal";

/**
 * WHAT THE VENTURE ALREADY HAS, as prompt lines.
 *
 * This is what makes a reassessment different from a first import: the analyst is
 * TOLD what exists, so it proposes the next chapter instead of the same one
 * again. It is data (the system message says so), and deliberately compact —
 * names, statuses and task counts: enough to recognise work by, not enough to
 * drown the sheet.
 */
export async function buildExistingProgramme({ dbId } = {}) {
  const empty = { text: "", counts: { journeys: 0, milestones: 0, tasks: 0 } };
  if (!dbId) return empty;

  const journeysResult = await selectExistingJourneyStages(dbId).catch(() => ({ rows: [] }));
  const journeys = journeysResult.rows || [];
  if (journeys.length === 0) return empty;

  const milestonesResult = await selectExistingMilestones(dbId).catch(() => ({ rows: [] }));
  const milestones = milestonesResult.rows || [];

  const lines = [];
  let tasks = 0;
  for (const journey of journeys) {
    lines.push(`JOURNEY: ${journey.name} [${journey.status}]`);
    for (const milestone of milestones) {
      if (String(milestone.journey_stage_id) !== String(journey.id)) continue;
      const count = Number(milestone.task_count || 0);
      tasks += count;
      lines.push(`  MILESTONE: ${milestone.title} [${milestone.status}]${count ? ` — ${count} tasks` : ""}`);
    }
  }

  return {
    text: lines.join("\n"),
    counts: { journeys: journeys.length, milestones: milestones.length, tasks },
  };
}

/** The answer budget one plan pass may use. Quoted back in the message when an
 *  answer stops at the ceiling, so the limit and the words cannot drift apart. */
export const PLAN_ANSWER_TOKENS = 8192;

/**
 * Ask the analyst, keeping the facts that explain a bad answer.
 *
 * `finish_reason` is the whole point: a reply that stopped at the length ceiling
 * is UNFINISHED, not malformed, and the two need opposite answers from whoever
 * uploaded the tracker — split the file, versus simply try again. Without it the
 * platform can only say "invalid JSON", which blames the wrong thing.
 */
async function askPlanModel(messages, label) {
  try {
    const answer = await deepseekIntelligence.chatDetailed(messages, undefined, PLAN_ANSWER_TOKENS);
    return { raw: answer.content, finishReason: answer.finishReason, truncated: answer.truncated };
  } catch (error) {
    console.error(`[plan-import:${label}] the model call failed:`, error?.message || error);
    return {
      ok: false,
      error: `The model could not be reached (${error.message || "unknown error"}).`,
      error_key: "venture.planImport.failed",
    };
  }
}

/**
 * HOW MUCH ONE CALL MAY CARRY.
 *
 * The model's output ceiling is a hard 8192 tokens, and a plan answers in FULL
 * objects — every task repeats a dozen key names plus its own text. A tracker
 * with ~50 rows overflows that and the answer is cut off mid-object, which used
 * to surface as "invalid JSON".
 *
 * So the work is SPLIT: the plan sheet is handed over in parts, and each part's
 * answer stays comfortably inside the ceiling. The parts are merged back into
 * one proposal, so a tracker of any length is read.
 */
export const PLAN_CHUNK_ROWS = 17;
/** Rows repeated at the head of the next part, so a group split across the
 *  boundary is still recognisable as one group. Merging drops the repeats. */
const PLAN_CHUNK_OVERLAP = 3;

/**
 * Slice a sheet's rows into overlapping parts.
 *
 * Returns the whole list as one part when it already fits, which is the common
 * case — a small tracker still costs exactly one call, as it always did.
 */
export function chunkPlanRows(rows = [], { size = PLAN_CHUNK_ROWS, overlap = PLAN_CHUNK_OVERLAP } = {}) {
  const list = Array.isArray(rows) ? rows : [];
  if (list.length <= size) return [{ start: 0, rows: list }];
  const parts = [];
  const step = Math.max(1, size - overlap);
  for (let start = 0; start < list.length; start += step) {
    parts.push({ start, rows: list.slice(start, start + size) });
    if (start + size >= list.length) break;
  }
  return parts;
}

/**
 * Merge the parts' answers into ONE proposal.
 *
 * Journeys merge by name, milestones by (journey, milestone) name, and tasks by
 * their ref — or, when the sheet gave none, by title plus owner. That is what
 * makes the overlap safe: a row the model sees twice is kept once.
 *
 * The FIRST value wins for anything a part states once (an objective, a date); a
 * later part may only fill a gap. A tracker is not a vote.
 */
export function mergePlanParts(parts = []) {
  const journeys = [];
  const byJourney = new Map();
  const seenTasks = new Set();
  const unplaced = [];
  const alreadyCovered = [];
  const warnings = [];
  let refsDerived = false;

  const key = (value) => String(value ?? "").trim().toLowerCase();

  for (const part of parts) {
    if (!part || typeof part !== "object") continue;
    if (part.refs_derived === true || part.refs_derived === "true") refsDerived = true;
    if (Array.isArray(part.unplaced)) unplaced.push(...part.unplaced);
    if (Array.isArray(part.already_covered)) alreadyCovered.push(...part.already_covered);
    if (Array.isArray(part.warnings)) warnings.push(...part.warnings);

    for (const journey of Array.isArray(part.journeys) ? part.journeys : []) {
      if (!journey || typeof journey !== "object") continue;
      const name = String(journey.name ?? "").trim();
      let target = byJourney.get(key(name));
      if (!target) {
        target = { ...journey, name, milestones: [] };
        byJourney.set(key(name), target);
        journeys.push(target);
      } else {
        for (const field of ["objective", "start_date", "target_date"]) {
          if (!target[field] && journey[field]) target[field] = journey[field];
        }
      }

      for (const milestone of Array.isArray(journey.milestones) ? journey.milestones : []) {
        if (!milestone || typeof milestone !== "object") continue;
        const milestoneName = String(milestone.name ?? "").trim();
        let milestoneTarget = target.milestones.find((item) => key(item?.name) === key(milestoneName));
        if (!milestoneTarget) {
          milestoneTarget = { ...milestone, name: milestoneName, tasks: [] };
          target.milestones.push(milestoneTarget);
        } else {
          for (const field of ["ref", "description", "objective", "start_date", "target_date"]) {
            if (!milestoneTarget[field] && milestone[field]) milestoneTarget[field] = milestone[field];
          }
        }

        for (const task of Array.isArray(milestone.tasks) ? milestone.tasks : []) {
          if (!task || typeof task !== "object") continue;
          const ref = key(task.ref);
          const identity = ref || `by-title:${key(task.title)}|${key(task.owner_name)}`;
          const taskKey = `${key(milestoneName)}|${identity}`;
          if (seenTasks.has(taskKey)) continue;
          seenTasks.add(taskKey);
          milestoneTarget.tasks.push(task);
        }
      }
    }
  }

  return { refs_derived: refsDerived, journeys, unplaced, already_covered: alreadyCovered, warnings };
}

/**
 * Read the JSON object out of a model answer, or say precisely why it cannot be.
 *
 * The evidence is logged SERVER-SIDE — the finish reason, the length, and the
 * tail of the reply — because the tail is the only thing that can settle what
 * went wrong, and it is gone the moment the request ends. The reply itself is
 * never shown to the user: it is machine output, not an explanation.
 *
 * `error` is kept for logs and API consumers; `error_key` is what a screen
 * translates, so no user-facing English is baked in here.
 */
function readModelJson({ raw, finishReason, truncated }, label) {
  const text = String(raw || "");
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error(
      `[plan-import:${label}] no JSON object in the answer — finish_reason=${finishReason}, chars=${text.length}`,
      text.slice(-500),
    );
    return { ok: false, error: "The model returned no usable JSON.", error_key: "venture.planImport.answerUnusable" };
  }
  try {
    return { parsed: JSON.parse(jsonMatch[0]) };
  } catch (parseError) {
    console.error(
      `[plan-import:${label}] unparseable answer — finish_reason=${finishReason}, truncated=${truncated}, ` +
        `chars=${text.length}, ${parseError.message}`,
      text.slice(-800),
    );
    return truncated
      ? {
          ok: false,
          error: `The model's answer stopped at the ${PLAN_ANSWER_TOKENS}-token ceiling before it was finished.`,
          error_key: "venture.planImport.answerTruncated",
          error_params: { limit: PLAN_ANSWER_TOKENS },
        }
      : { ok: false, error: "The model returned invalid JSON.", error_key: "venture.planImport.answerInvalid" };
  }
}

/**
 * Interpret a read sheet into a validated proposal.
 *
 * @returns {Promise<{ok: true, proposal, unmatched_owners, warnings, truncated}
 *   | {ok: false, error}>}
 */
export async function interpretPlanSheet({
  sheets = [],
  contextText = "",
  existingProgrammeText = "",
  sheetName = null,
} = {}) {
  // The chosen sheet is marked in the rendering AND named in the prompt: the
  // marker tells the model where the work lives, the name tells it that the
  // choice was made deliberately, on the reader's side.
  // The plan sheet, when the caller named one — the parts are cut from ITS rows.
  const planSheet = sheetName
    ? (Array.isArray(sheets) ? sheets : []).find(
        (item) =>
          String(item?.name ?? "").trim().toLowerCase() === String(sheetName).trim().toLowerCase(),
      )
    : null;

  // One part when the sheet fits — the common case, and the only case that
  // existed before. Several when the tracker is too long for one answer.
  const rowParts = planSheet ? chunkPlanRows(planSheet.rows) : null;
  let parsed;
  let truncated = false;

  if (!rowParts || rowParts.length === 1) {
    const sheetText = renderPlanSheets(sheets, sheetName);
    const built = buildPlanPrompt({ contextText, sheetText, existingProgrammeText, sheetName });
    const answer = await askPlanModel(built.messages, "interpret");
    if (answer.error) return answer;
    const read = readModelJson(answer, "interpret");
    if (read.error) return read;
    parsed = read.parsed;
    truncated = built.truncated;
  } else {
    // A SPLIT pass. The reference sheets are dropped here on purpose: they are
    // context, and context is the one thing a part cannot afford. Row labels
    // keep their place in the whole sheet (`part.start`), so a dependency can
    // still name a row that lives in another part.
    const answers = [];
    for (const [index, part] of rowParts.entries()) {
      const label = `interpret ${index + 1}/${rowParts.length}`;
      const sheetText = renderPlanSheets([{ name: sheetName, rows: part.rows }], sheetName, part.start);
      const built = buildPlanPrompt({
        contextText,
        sheetText,
        existingProgrammeText,
        sheetName,
        part: { index: index + 1, total: rowParts.length },
      });
      const answer = await askPlanModel(built.messages, label);
      if (answer.error) return answer;
      const read = readModelJson(answer, label);
      if (read.error) return read;
      answers.push(read.parsed);
    }
    parsed = mergePlanParts(answers);
  }
  if (!Array.isArray(parsed.journeys) || parsed.journeys.length === 0) {
    if (!(Array.isArray(parsed.already_covered) && parsed.already_covered.length > 0)) {
      return { ok: false, error: "The model proposed no journey.", error_key: "venture.planImport.answerUnusable" };
    }
  }

  const warnings = (Array.isArray(parsed.warnings) ? parsed.warnings : [])
    .map((warning) => String(warning).trim())
    .filter(Boolean)
    .slice(0, 50);
  if (truncated) {
    warnings.push("The sheet was longer than one model call carries; only the shown part was mapped.");
  }
  const unplaced = (Array.isArray(parsed.unplaced) ? parsed.unplaced : [])
    .map((item) => ({
      location: toText(item?.location) || "unknown",
      reason: toText(item?.reason) || "not stated",
    }))
    .slice(0, 100);

  // What the analyst judged already present. On a reassessment this is the
  // important half of the answer — the thing that stops the same work from being
  // proposed a second time.
  const alreadyCovered = (Array.isArray(parsed.already_covered) ? parsed.already_covered : [])
    .map((item) => ({
      sheet_item: toText(item?.sheet_item) || "unknown",
      existing: toText(item?.existing) || "unknown",
    }))
    .slice(0, 200);

  // Whether the analyst had to INFER the task references. Worth saying out loud:
  // a dependency points at a reference, so inferred ones deserve a second look.
  const refsDerived = parsed.refs_derived === true || parsed.refs_derived === "true";
  if (refsDerived) {
    warnings.push(
      "Task references were numbered by row order — the sheet gave no task id per row. Check the dependencies.",
    );
  }

  const journeys = normalizeJourneys(parsed.journeys);
  // Suggested dates come from the tasks, so they are derived before anything
  // else reads the structure.
  deriveProposalDates(journeys, warnings);
  validateDependencyRefs(journeys, warnings);

  // Owner resolution — one lookup per distinct name, unresolved people named.
  const unmatchedOwners = await resolveProposalOwners(journeys, warnings);

  const stats = computeProposalStats({ journeys });

  return {
    ok: true,
    proposal: { journeys, unplaced, already_covered: alreadyCovered, refs_derived: refsDerived, stats },
    unmatched_owners: unmatchedOwners,
    warnings,
    truncated,
  };
}

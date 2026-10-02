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
  const sheetText = renderPlanSheets(sheets, sheetName);
  const { messages, truncated } = buildPlanPrompt({ contextText, sheetText, existingProgrammeText, sheetName });

  let raw;
  try {
    raw = await deepseekIntelligence.chat(messages, undefined, 8192);
  } catch (error) {
    return { ok: false, error: `The model could not be reached (${error.message || "unknown error"}).`, error_key: "venture.planImport.failed" };
  }

  const jsonMatch = String(raw || "").match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { ok: false, error: "The model returned no usable JSON.", error_key: "venture.planImport.answerInvalid" };
  let parsed;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (_) {
    return { ok: false, error: "The model returned invalid JSON.", error_key: "venture.planImport.answerInvalid" };
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

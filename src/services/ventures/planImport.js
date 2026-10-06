/**
 * PLAN IMPORT — interpreting an uploaded tracker into a proposed programme.
 *
 * The document is an INPUT, never the source of truth: this module reads it
 * with the model, validates what the model returns against the platform's own
 * data (people, dates, dependency references), and hands back a PROPOSAL.
 * Nothing here writes venture data — the reviewer decides in the next step,
 * and a proposal is not a change.
 *
 * Guardrails live in the SYSTEM message, so nothing inside the sheet can
 * promote itself to an instruction. The mapping is the fixed hierarchy —
 * Journey (direction / North Star) → Milestone (outcome / KPI) → Task
 * (action) → Deliverable (proof) — and anything the model cannot place is
 * reported (unplaced / warnings / unmatched owners), never guessed.
 *
 * Split (lane L2): the code lives in `./planImport/` — prompt, proposal,
 * interpret, draft, revise, apply. This file re-exports the same public surface
 * (named + default), so importers and tests are unchanged.
 *
 * Layer (see docs/LAYER_SPLIT.md): the decisions live here; every statement
 * lives in `@/models/venturePlanImportStore`. The caller (the plan-import
 * controller) initialises the database, like every other migrated service.
 */

export {
  MAX_PLAN_PROMPT_CHARS,
  MAX_PLAN_CONTEXT_CHARS,
  renderPlanSheets,
  isMilestoneSheet,
  buildPlanPrompt,
} from "./planImport/prompt";
export {
  deriveProposalDates,
  computeProposalStats,
  collectUnmatchedOwners,
  normalizeJourneys,
  collectTaskRefs,
  validateDependencyRefs,
  resolveProposalOwners,
  knownOwnerCids,
} from "./planImport/proposal";
export {
  buildExistingProgramme,
  interpretPlanSheet,
  PLAN_ANSWER_TOKENS,
  PLAN_CHUNK_ROWS,
  chunkPlanRows,
  mergePlanParts,
  dedupeTasksByRef,
} from "./planImport/interpret";
export {
  getOpenPlanImport,
  getPlanImport,
  createPlanImport,
  updatePlanImportProposal,
  discardPlanImport,
} from "./planImport/draft";
export {
  MAX_PLAN_REVISE_CHARS,
  diffProposals,
  revisePlanProposal,
} from "./planImport/revise";
export {
  applyPlanImport,
} from "./planImport/apply";

import {
  renderPlanSheets,
  isMilestoneSheet,
  buildPlanPrompt,
} from "./planImport/prompt";
import {
  deriveProposalDates,
  computeProposalStats,
  collectUnmatchedOwners,
  normalizeJourneys,
  validateDependencyRefs,
  resolveProposalOwners,
  knownOwnerCids,
} from "./planImport/proposal";
import {
  buildExistingProgramme,
  interpretPlanSheet,
  PLAN_ANSWER_TOKENS,
  PLAN_CHUNK_ROWS,
  chunkPlanRows,
  mergePlanParts,
  dedupeTasksByRef,
} from "./planImport/interpret";
import {
  getOpenPlanImport,
  getPlanImport,
  createPlanImport,
  updatePlanImportProposal,
  discardPlanImport,
} from "./planImport/draft";
import {
  diffProposals,
  revisePlanProposal,
} from "./planImport/revise";
import {
  applyPlanImport,
} from "./planImport/apply";

export default {
  interpretPlanSheet,
  buildPlanPrompt,
  renderPlanSheets,
  isMilestoneSheet,
  PLAN_ANSWER_TOKENS,
  PLAN_CHUNK_ROWS,
  chunkPlanRows,
  mergePlanParts,
  dedupeTasksByRef,
  buildExistingProgramme,
  normalizeJourneys,
  deriveProposalDates,
  validateDependencyRefs,
  resolveProposalOwners,
  knownOwnerCids,
  computeProposalStats,
  collectUnmatchedOwners,
  diffProposals,
  revisePlanProposal,
  applyPlanImport,
  getOpenPlanImport,
  getPlanImport,
  createPlanImport,
  updatePlanImportProposal,
  discardPlanImport,
};

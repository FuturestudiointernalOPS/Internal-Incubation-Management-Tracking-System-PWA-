/**
 * VENTURE JOURNEY — stage authoring, archive/delete and the template library.
 *
 * The Journey is the Venture-facing operating path: authorized staff define the
 * stages a specific Venture actually needs (never a hardcoded curriculum). This
 * service holds the DECISIONS of that authoring surface:
 *   - stage reads with a progressive fallback (archive / template columns);
 *   - the ordered swap and the re-serialised delete (transaction boundaries);
 *   - the filed-work guard that blocks a permanent delete;
 *   - the template library: what a save captures and what an apply recreates,
 *     including the first-stage status and the CONTINUED numbering.
 *
 * Every statement lives in `@/models/ventureJourneyStore`; nothing here runs
 * SQL (the boundary is pinned by `server/services-boundaries.test.js`).
 *
 * This module used to be re-exported through the `@/lib/ventureJourneys`,
 * `@/lib/ventureJourneyArchive` and `@/lib/ventureJourneyTemplates` facades;
 * those facades are gone (CH-4) and importers read this module directly.
 *
 * Split (lane L2): the code lives in `./journey/` — stages, archive, templates.
 * This file re-exports the same public surface (named + default when there is
 * one), so importers and tests are unchanged.
 */

export {
  ensureJourneyTable,
  resolveVentureInternalId,
  listJourneyStages,
  getJourneyStage,
  nextJourneyStageOrder,
  moveJourneyStage,
  deleteJourneyStage,
} from "./journey/stages";
export {
  stageHasFiledWork,
  archiveJourneyStages,
  restoreJourneyStages,
  deleteJourneyStages,
} from "./journey/archive";
export {
  listJourneyTemplates,
  saveJourneyAsTemplate,
  applyJourneyTemplate,
} from "./journey/templates";


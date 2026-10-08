/**
 * Programs — the program curriculum (SERVICE layer).
 *
 * This module is the entry point the curriculum controller imports from. The
 * domain work is split by concern:
 *
 *   curriculumSchema.js   — the self-healing schema steps the writes need
 *   curriculumShared.js   — the version snapshot and the KPI refresh trigger
 *   curriculumScope.js    — which RECORD's program authorises an action
 *   curriculumActions.js  — the POST action vocabulary
 *   curriculumUpdate.js   — the PUT (field update + legacy full update)
 *   curriculumDelete.js   — the per-type DELETE cascade
 *
 * The CONTROLLER keeps authentication, the `programs.edit` capability, the
 * `wave: "content"` record scope and the response envelope.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions and orchestration, no SQL, no HTTP.
 * It reads and writes through `@/models/**`.
 */

export * from "./curriculumSchema";
export * from "./curriculumShared";
export * from "./curriculumScope";
export * from "./curriculumActions";
export * from "./curriculumUpdate";
export * from "./curriculumDelete";

/**
 * Platform — form runs (SERVICE layer).
 *
 * The domain work behind `/api/platform/form-runs`: the READ assembly of one
 * Run's detail (the run screen), the decision/result email and document cluster,
 * the shared review workflow, the run lifecycle and assignments, the respondent
 * write path, the email/message batch actions and the link/document/run actions.
 * The CONTROLLER keeps the capabilities, the request routing and the response
 * envelope.
 *
 * Split (see docs/LAYER_SPLIT.md): the code lives in `./formRuns/` —
 * `detail`, `resultEmails`, `review`, `lifecycle`, `submitters`, `sends`,
 * `actions`. This file re-exports the same public surface, so importers and
 * tests are unchanged.
 *
 * Layer: decisions and shaping, no SQL, no HTTP. It reads through `@/models/**`
 * and `@/lib/**`.
 */

export * from "./formRuns/detail";
export * from "./formRuns/resultEmails";
export * from "./formRuns/review";
export * from "./formRuns/lifecycle";
export * from "./formRuns/submitters";
export * from "./formRuns/sends";
export * from "./formRuns/actions";

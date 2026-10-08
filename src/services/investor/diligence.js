/**
 * Investor service — the due-diligence workspace.
 *
 * Layer (see docs/LAYER_SPLIT.md): every DECISION of the due-diligence workspace
 * lives in `./diligence/` — the JSON-column helper (`json`), the per-role status
 * policy (`status`), the version-history + follow-up edits (`questions`), the read
 * side (`read`), the workspace/request/note writes (`workspaceActions`), the
 * request transition (`requestActions`), the follow-up actions
 * (`followUpActions`) and the own-scope dispatch (`dispatch`). This file
 * re-exports the same public surface, so importers and tests are unchanged.
 *
 * Every statement lives in `@/models/investor`. No SQL, no HTTP: a refusal is a
 * value ({ ok: false, error, status }) the HTTP boundary turns into a response.
 */

export { toArray } from "./diligence/json";
export { canTransitionDiligenceStatus, diligenceTransitionRefusal } from "./diligence/status";
export {
  appendTransitionHistory,
  appendFollowUpQuestion,
  answerFollowUpQuestion,
} from "./diligence/questions";
export {
  canViewDiligencePipeline,
  loadDiligence,
  buildDiligenceForViewer,
} from "./diligence/read";
export {
  createDiligenceWorkspace,
  addDiligenceRequest,
  addDiligenceNote,
} from "./diligence/workspaceActions";
export { updateDiligenceRequest } from "./diligence/requestActions";
export { addFollowUpQuestion, respondToFollowUpQuestion } from "./diligence/followUpActions";
export { runDiligenceAction } from "./diligence/dispatch";
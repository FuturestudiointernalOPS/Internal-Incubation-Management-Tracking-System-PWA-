/**
 * Platform — intents (SERVICE layer).
 *
 * The domain decisions behind `/api/intents` and its sub-routes: who may list,
 * read, create, update or delete an Intent (and add tasks under it), the
 * responsible/context defaults, the Contact-Group assignment rule, the task
 * counts batch and the progress summary. The CONTROLLER keeps `requireAuth`,
 * `initDb`, the request parsing and the response envelope.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions and shaping, no HTTP. It reads and
 * writes through `@/models/**` and records the audit trail through the tasks
 * audit service. Every function returns `{ status, body }` for the controller to
 * serialise, and lets an unexpected failure propagate to its try/catch (500).
 *
 * This file is a thin BARREL over cohesive modules in the sibling
 * `services/platform/intents/` folder (the split convention: `x.js` + `x/`),
 * split by use case:
 *
 *   list.js   — list Intents with its security and batched task counts
 *   create.js — create an Intent (title + responsible-exists)
 *   update.js — update an Intent (ownership + field set)
 *   delete.js — delete an Intent (ownership + task unlink)
 *   detail.js — one Intent with its tasks, blockers and progress
 *   tasks.js  — create a task under an Intent (inheritance + Contact-Group)
 *
 * Importers keep the same path (`@/services/platform/intents`).
 */

export * from "./intents/list";
export * from "./intents/create";
export * from "./intents/update";
export * from "./intents/delete";
export * from "./intents/detail";
export * from "./intents/tasks";

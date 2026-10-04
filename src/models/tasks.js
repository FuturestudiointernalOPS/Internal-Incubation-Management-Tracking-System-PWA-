/**
 * Tasks model — data access for the tasks domain (tasks, subtasks,
 * task assignments, task notifications).
 *
 * This file is a thin BARREL over cohesive modules in the sibling
 * `models/tasks/` folder (the split convention: `x.js` + `x/`):
 *
 *   reads.js  — task lookups and the related sub-task/blocker/resource reads
 *   list.js   — the filtered task list (spectrum scope + filters)
 *   scope.js  — project/contact/assignment access facts
 *   writes.js — create, completion lifecycle, deletes, assignments, notifies
 *   admin.js  — the Super Admin task and blocker lists
 *
 * Each function wraps exactly one SQL statement, byte-identical to the queries
 * that used to sit inline in the controller (`src/app/api/tasks/route.js`), so
 * behavior is unchanged. Importers keep the same path (`@/models/tasks`).
 *
 * Model-layer rules (see docs/MVC_REFACTOR.md):
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data/outcome it returns.
 *  - Notification/audit *content* is shaped by callers, not here.
 */

export * from "./tasks/reads";
export * from "./tasks/list";
export * from "./tasks/scope";
export * from "./tasks/writes";
export * from "./tasks/admin";

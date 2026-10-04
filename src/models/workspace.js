/**
 * Workspace model — shared cross-cutting data access for the API routes that
 * sit outside the vertical domains (workspaces hub, calendar, sessions,
 * notifications, profile, progress, activity, documents, categories, contact
 * emails, team tasks, export jobs).
 *
 * This file is a thin BARREL over cohesive modules in the sibling
 * `models/workspace/` folder (the split convention: `x.js` + `x/`):
 *
 *   hub.js           — the post-login hub memberships, roles and program scopes
 *   calendar.js      — the calendar event sources and the session CRUD
 *   notifications.js — the notification inbox and the reminder engines
 *   profile.js       — profile reads/writes and the contact identity guards
 *   programs.js      — progress metrics, document requirements, work categories
 *   teamTasks.js     — the team task board
 *   ops.js           — activity log, run export, pending campaign dispatch
 *
 * Each function wraps exactly one SQL statement, byte-identical to the queries
 * that used to sit inline in the controllers, so behavior is unchanged.
 * Importers keep the same path (`@/models/workspace`).
 *
 * Model-layer rules (see docs/MVC_REFACTOR.md §4):
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data/outcome it returns.
 */

export * from "./workspace/hub";
export * from "./workspace/calendar";
export * from "./workspace/notifications";
export * from "./workspace/profile";
export * from "./workspace/programs";
export * from "./workspace/teamTasks";
export * from "./workspace/ops";

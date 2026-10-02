/**
 * Tasks — TEAM BOARD (SERVICE layer).
 *
 * The lightweight per-team task board behind `/api/team-tasks`. It is a different
 * table from the main `tasks` workflow (no subtasks, no carry-over, no audit
 * trail), so it gets its own module rather than growing `update.js`.
 *
 * What lives here:
 *   - WHICH records a caller may touch. A team's board is team-scoped: a
 *     team-entity session (role "team", cid = its own team id) may only ever
 *     reach ITS OWN board, management is unscoped, and everyone else must be
 *     staffed on the program that owns the team. A team that cannot be
 *     attributed to a program is REFUSED, never allowed — an action that cannot
 *     be scope-checked must not be guessed at;
 *   - the board's field vocabulary: the POST defaults and the PUT column
 *     whitelist (only these five columns are writable, so a client cannot
 *     reach `created_by` or `team_id` through the update);
 *   - the use cases themselves (list / create / update / delete).
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions and orchestration, no SQL, no HTTP.
 * It reads and writes through `@/models/**`.
 *
 * The HTTP boundary stays in the controller, as everywhere: this module answers
 * WHICH scope rule applies and the route calls `requireProgramScope` with the
 * program's id (see `src/__tests__/program-scope-coverage.test.js`, which holds
 * the "groups" wave wired to this surface).
 */

import { getSession, hasProgramManagementAccess } from "@/lib/auth";
import { getTeamById } from "@/models/teams";
import {
  getTeamTasks,
  getTeamTaskTeamId,
  createTeamTask,
  updateTeamTaskFields,
  deleteTeamTask,
} from "@/models/workspace";

/**
 * The board's writable columns, in the order they are assembled.
 *
 * This list IS the write surface: `team_id`, `created_by` and `created_at` are
 * absent on purpose, so no update can move a task to another board or re-attribute
 * its author.
 */
const WRITABLE_FIELDS = [
  "title",
  "description",
  "status",
  "priority",
  "assigned_to",
];

/** The POST defaults for a board task. */
const CREATE_DEFAULTS = {
  status: "todo",
  priority: "medium",
};

/** A scope verdict that needs nothing further; a deny carries its own answer. */
const ALLOW = { kind: "allow" };
const deny = (status, errorKey) => ({ kind: "deny", status, errorKey });
const programScope = (programId) => ({
  kind: "program-scope",
  programId: programId ?? null,
});

/**
 * May this session reach this team's board?
 *
 * The three verdicts are deliberately distinct:
 *   - `allow`         — decided here, nothing left to check (own board, management);
 *   - `program-scope` — the caller must additionally be staffed on the owning
 *                      program; the route runs that record-scope guard;
 *   - `deny`          — refused here, with the status and error key to answer.
 *
 * @returns {Promise<{kind: "allow"} | {kind: "program-scope", programId: string|null}
 *                    | {kind: "deny", status: number, errorKey: string}>}
 */
export async function resolveTeamBoardScope(teamId) {
  const session = await getSession();
  if (!session) return deny(401, "errors.authRequired");

  // A team session IS a team: it reaches its own board and nothing else. A
  // foreign board is a 404, not a 403 — the caller has no business learning
  // that the board exists.
  if (session.role === "team") {
    return String(teamId) === String(session.cid) ? ALLOW : deny(404, "errors.notFound");
  }

  if (hasProgramManagementAccess(session.role)) return ALLOW;

  const teamRow = (await getTeamById(teamId))?.rows?.[0];
  if (!teamRow) return deny(404, "errors.notFound");

  return programScope(teamRow.program_id);
}

/**
 * The same rule, reached from a task id the client sent: resolve the task's team
 * first, then scope to it. A task that resolves to no team is refused.
 *
 * @returns {Promise<{kind: "allow"|"program-scope"|"deny", ...}>}
 */
export async function resolveTeamBoardTaskScope(taskId) {
  const teamId = (await getTeamTaskTeamId(taskId))?.rows?.[0]?.team_id;
  if (!teamId) return deny(404, "errors.notFound");
  return resolveTeamBoardScope(teamId);
}

/**
 * The SET clause for a board task update, built from the whitelisted columns
 * only. `updated_at` is always touched, which is why a request carrying no
 * writable field at all is refused rather than written as a no-op.
 *
 * @returns {{fields: string[], args: any[]}|{error: string}}
 */
export function assembleBoardTaskPatch(patch) {
  const fields = [];
  const args = [];
  for (const field of WRITABLE_FIELDS) {
    if (patch[field] === undefined) continue;
    fields.push(`${field} = ?`);
    args.push(patch[field]);
  }
  if (fields.length === 0) return { error: "No fields to update" };
  fields.push("updated_at = NOW()");
  return { fields, args };
}

/** The values a new board task is created with, defaults applied. */
export function resolveBoardTaskCreation({ description, status, priority, assigned_to, created_by }) {
  return {
    description: description || null,
    status: status || CREATE_DEFAULTS.status,
    priority: priority || CREATE_DEFAULTS.priority,
    assignedTo: assigned_to || null,
    createdBy: created_by || null,
  };
}

/**
 * List a team's board, priority first then most recent (the ordering is the
 * model's — the board reads as a work queue, not a log).
 */
export async function listTeamBoardTasks(teamId) {
  const result = await getTeamTasks(teamId);
  return { status: 200, body: { success: true, tasks: result.rows } };
}

/**
 * Create a board task on a team the caller is scoped to.
 *
 * The parameter names are the request's own field names, so the controller hands
 * the body straight through without renaming anything — the same shape
 * `updateTeamBoardTask` takes its patch in.
 */
export async function createTeamBoardTask({ team_id, title, ...rest }) {
  const values = resolveBoardTaskCreation(rest);
  const result = await createTeamTask(
    team_id,
    title,
    values.description,
    values.status,
    values.priority,
    values.assignedTo,
    values.createdBy,
  );
  return { status: 200, body: { success: true, task: result.rows[0] } };
}

/**
 * Update a board task. Returns a refusal when the request named no writable
 * column — the caller stays scoped, and nothing is written.
 *
 * @returns {Promise<{status: number, error?: string, body?: Object}>}
 */
export async function updateTeamBoardTask({ id, patch }) {
  const clause = assembleBoardTaskPatch(patch);
  if (clause.error) return { status: 400, error: clause.error };

  const result = await updateTeamTaskFields(id, clause.fields, clause.args);
  return { status: 200, body: { success: true, task: result.rows[0] } };
}

/** Delete a board task. */
export async function deleteTeamBoardTask(id) {
  await deleteTeamTask(id);
  return { status: 200, body: { success: true } };
}
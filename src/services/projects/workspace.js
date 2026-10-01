/**
 * Projects — workspace use cases (SERVICE layer).
 *
 * The domain work behind `/api/projects`. The CONTROLLER still authenticates and
 * authorises (which capability, which object-level access) and shapes the HTTP
 * answer; everything below is what a project action actually DOES:
 *
 *   - who may see the whole portfolio, and who is limited to their own rows;
 *   - how a request's PM leads resolve (create and update differ on purpose);
 *   - how a project's `meta` JSON is merged on update;
 *   - the order of the writes (create → members → notify; update → lead sync;
 *     delete members → delete project).
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions and orchestration, no SQL, no HTTP.
 * It reads and writes through `@/models/**`.
 */

import {
  createProject,
  upsertProjectLeadMember,
  createProjectAssignmentNotification,
  getProjectsList,
  getProjectMembersForProjects,
  getTaskSummaryByProjectIds,
  getProjectMetaById,
  updateProject,
  projectUpdateClause,
  deleteProjectLeads,
  upsertProjectLeadMemberOnUpdate,
  deleteProjectMembersByProjectId,
  deleteProjectById,
} from "@/models/projects";
import {
  PORTFOLIO_ROLES,
  seesWholePortfolio,
  resolveListingScope,
} from "@/services/authorization/listingScope";

/**
 * The roles that see the whole project portfolio. Everyone else is limited to
 * the projects they own or belong to. (Alias of the shared authorization rule.)
 */
export const PROJECT_PORTFOLIO_ROLES = PORTFOLIO_ROLES;

/** May this role look at projects it is not a member of? */
export const seesWholeProjectPortfolio = seesWholePortfolio;

/** The shared own-scope rule, re-exported for the collaboration module. */
export const resolveOwnScope = resolveListingScope;

/**
 * Resolve which rows a caller's project list may return.
 *
 * A non-portfolio role is pinned to their own id: asking for somebody else's is
 * refused rather than silently ignored. A portfolio role may filter by whatever
 * cid (or none) they passed.
 *
 * @returns {{filterCid?: string|null, denied?: string}}
 */
export function resolveProjectListFilter({ role, sessionCid, requestedCid }) {
  const resolved = resolveOwnScope({
    role,
    sessionCid,
    requestedCid,
    denialMessage: "You can only view your own projects.",
  });
  if (resolved.denied) return { denied: resolved.denied };
  return { filterCid: resolved.cid };
}

/**
 * The PM leads to attach on CREATE. A single `assigned_pm_id` is folded into the
 * array (deduplicated); the first lead also becomes the legacy `owner_id`.
 *
 * @returns {{leads: Array, primaryOwnerId: string|null}}
 */
export function resolveCreateLeads({ assignedPmId, assignedPmIds }) {
  const leads = Array.isArray(assignedPmIds) ? [...assignedPmIds] : [];
  if (assignedPmId && !leads.includes(assignedPmId)) leads.push(assignedPmId);
  return { leads, primaryOwnerId: leads.length > 0 ? leads[0] : null };
}

/**
 * The PM leads to attach on UPDATE — deliberately different from create:
 * `undefined` (neither field sent) means "leave the leads alone", whereas a
 * sent-but-empty `assigned_pm_ids` means "remove every lead".
 *
 * @returns {Array|undefined}
 */
export function resolveUpdateLeads({ assignedPmId, assignedPmIds }) {
  if (assignedPmIds !== undefined) return assignedPmIds;
  if (assignedPmId !== undefined) return assignedPmId ? [assignedPmId] : [];
  return undefined;
}

/** Did the request carry any field that is stored inside the `meta` JSON? */
export function hasProjectMetaChanges({
  description,
  conceptNote,
  conceptNoteUrl,
  assignedPmId,
  assignedPmIds,
}) {
  return (
    description !== undefined ||
    conceptNote !== undefined ||
    conceptNoteUrl !== undefined ||
    assignedPmId !== undefined ||
    assignedPmIds !== undefined
  );
}

/**
 * Merge the incoming meta fields over the stored `meta`, leaving untouched keys
 * as they were. `leads` (when defined) replaces the lead/owner keys together.
 *
 * @returns {string} the new meta JSON
 */
export function mergeProjectMeta({
  currentMeta,
  description,
  conceptNote,
  conceptNoteUrl,
  leads,
}) {
  const base = currentMeta || {};
  const primaryOwnerId = leads && leads.length > 0 ? leads[0] : null;
  return JSON.stringify({
    ...base,
    ...(description !== undefined ? { description } : {}),
    ...(conceptNote !== undefined ? { concept_note: conceptNote } : {}),
    ...(conceptNoteUrl !== undefined ? { concept_note_url: conceptNoteUrl } : {}),
    ...(leads !== undefined
      ? { assigned_pm_id: primaryOwnerId, assigned_pm_ids: leads }
      : {}),
  });
}

/** Parse a project's stored `meta` (a JSON string, an object, or nothing). */
export function parseProjectMeta(rawMeta) {
  return (typeof rawMeta === "string" ? JSON.parse(rawMeta) : rawMeta) || {};
}

/** Create a project, attach its leads, and notify each of them. */
export async function createProjectWithLeads({
  programId,
  name,
  status,
  description,
  conceptNote,
  conceptNoteUrl,
  startDate,
  endDate,
  priority,
  assignedPmId,
  assignedPmIds,
}) {
  const { leads, primaryOwnerId } = resolveCreateLeads({
    assignedPmId,
    assignedPmIds,
  });

  // Build meta with all extra fields; the first lead is the legacy owner.
  const meta = JSON.stringify({
    description: description || null,
    concept_note: conceptNote || null,
    concept_note_url: conceptNoteUrl || null,
    assigned_pm_id: primaryOwnerId,
    assigned_pm_ids: leads,
  });

  const result = await createProject(
    programId,
    name,
    status,
    startDate,
    endDate,
    priority,
    meta,
    primaryOwnerId,
  );

  const projectId = result.rows[0]?.id || result.lastInsertRowid;

  // Each lead becomes a project member with the lead role.
  for (const leadId of leads) {
    await upsertProjectLeadMember(projectId, leadId);
  }

  // Notify each lead. A failed notification must not lose the project.
  for (const leadId of leads) {
    try {
      await createProjectAssignmentNotification(
        leadId,
        "New Project Assignment",
        `You have been assigned as lead for project "${name}".`,
        "project_assignment",
      );
    } catch (notifErr) {
      console.error(
        "Project assignment notification failed:",
        notifErr.message,
      );
    }
  }

  return { projectId };
}

/**
 * The projects a caller may see, with their members and task summary attached.
 * Returns a refusal when a non-portfolio caller asks for another person's rows.
 *
 * @returns {Promise<{status: number, error?: string, projects?: Array}>}
 */
export async function listProjects({
  programId,
  role,
  sessionCid,
  requestedCid,
  includeArchived,
}) {
  const filter = resolveProjectListFilter({ role, sessionCid, requestedCid });
  if (filter.denied) {
    return { status: 403, error: filter.denied };
  }

  const result = await getProjectsList(
    programId,
    filter.filterCid,
    includeArchived,
  );
  const projectIds = result.rows.map((row) => row.id);

  // All members in one query instead of N+1.
  let allMembers = [];
  if (projectIds.length > 0) {
    const membersResult = await getProjectMembersForProjects(projectIds);
    allMembers = membersResult.rows || [];
  }
  const memberMap = {};
  for (const member of allMembers) {
    const key = String(member.project_id);
    if (!memberMap[key]) memberMap[key] = [];
    memberMap[key].push({ user_cid: member.user_cid, role: member.role });
  }

  // Per-project task stats in ONE grouped query instead of one COUNT per project.
  const taskMap = {};
  if (projectIds.length > 0) {
    const taskSummaryResult = await getTaskSummaryByProjectIds(projectIds);
    for (const row of taskSummaryResult.rows || []) taskMap[row.pid] = row;
  }

  const projects = result.rows.map((row) => {
    const key = String(row.id);
    const taskSummary = taskMap[key] || {};
    return {
      ...row,
      meta: parseProjectMeta(row.meta),
      members: memberMap[key] || [],
      task_summary: {
        total: taskSummary.total || 0,
        completed: taskSummary.completed || 0,
      },
    };
  });

  return { status: 200, projects };
}

/**
 * Apply a partial update to a project and re-sync its leads when they changed.
 *
 * @returns {Promise<{status: number, error?: string, action?: string}>}
 */
export async function updateProjectRecord({ id, patch }) {
  const columnValues = {};

  if (patch.name !== undefined) columnValues.name = patch.name;
  if (patch.status !== undefined) columnValues.status = patch.status;
  if (patch.start_date !== undefined) {
    columnValues.start_date = patch.start_date || null;
  }
  if (patch.end_date !== undefined) {
    columnValues.end_date = patch.end_date || null;
  }
  if (
    patch.priority !== undefined &&
    ["critical", "high", "medium", "low"].includes(patch.priority)
  ) {
    columnValues.priority = patch.priority;
  }

  const leads = resolveUpdateLeads({
    assignedPmId: patch.assigned_pm_id,
    assignedPmIds: patch.assigned_pm_ids,
  });

  // Meta fields live inside the JSON column: read the current value, merge, and
  // mirror the first lead into the legacy owner_id column.
  if (
    hasProjectMetaChanges({
      description: patch.description,
      conceptNote: patch.concept_note,
      conceptNoteUrl: patch.concept_note_url,
      assignedPmId: patch.assigned_pm_id,
      assignedPmIds: patch.assigned_pm_ids,
    })
  ) {
    const current = await getProjectMetaById(id);
    const currentMeta = parseProjectMeta(current.rows[0]?.meta);

    columnValues.meta = mergeProjectMeta({
      currentMeta,
      description: patch.description,
      conceptNote: patch.concept_note,
      conceptNoteUrl: patch.concept_note_url,
      leads,
    });

    // Keep owner_id in step with the lead list.
    if (leads !== undefined) {
      columnValues.owner_id = leads.length > 0 ? leads[0] : null;
    }
  }

  if (Object.keys(columnValues).length === 0) {
    return { status: 400, error: "No fields to update." };
  }

  const { fields, args } = projectUpdateClause(columnValues);
  args.push(id);
  await updateProject(fields, args);

  // Re-sync the members table only when the request carried lead fields.
  if (
    patch.assigned_pm_ids !== undefined ||
    patch.assigned_pm_id !== undefined
  ) {
    await deleteProjectLeads(id);
    for (const leadId of leads || []) {
      await upsertProjectLeadMemberOnUpdate(id, leadId);
    }
  }

  return { status: 200, action: "updated" };
}

/** Delete a project: its members first (no orphans), then the row itself. */
export async function deleteProjectRecord(id) {
  await deleteProjectMembersByProjectId(id);
  await deleteProjectById(id);
}

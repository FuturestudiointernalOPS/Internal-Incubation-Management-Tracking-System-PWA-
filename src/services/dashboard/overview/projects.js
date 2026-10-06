/**
 * Dashboard service — the overview project list.
 *
 * The quick-access project rows: what the person owns, plus the projects they
 * collaborate on (the owned one wins if it appears in both). No SQL, no HTTP.
 */

/** The project row shape (stats + completion rate) used by the quick access. */
function toQuickAccessProject(project, role) {
  return {
    id: project.id,
    name: project.name,
    status: project.status,
    owner_id: project.owner_id,
    meta: project.meta,
    role,
    taskStats: {
      total: parseInt(project.task_total) || 0,
      completed: parseInt(project.task_completed) || 0,
    },
    blockerStats: { active: parseInt(project.blocker_active) || 0 },
    completionRate:
      (parseInt(project.task_total) || 0) > 0
        ? Math.round(
            ((parseInt(project.task_completed) || 0) / (parseInt(project.task_total) || 1)) * 100,
          )
        : 0,
  };
}

/**
 * The owned projects first, then the collaborator projects (deduplicated against
 * the owned ones). `collaboratorProjects` is the already-read row set, or `null`
 * when the collaborator read failed — the list then holds the owned projects
 * only.
 */
export function buildQuickAccessProjects(ownedProjects, collaboratorProjects) {
  const ownedMapped = (ownedProjects || []).map((project) =>
    toQuickAccessProject(project, "owner"),
  );
  const ownedIds = new Set(ownedMapped.map((project) => String(project.id)));
  const collabMapped = (collaboratorProjects || [])
    .filter((project) => !ownedIds.has(String(project.id)))
    .map((project) => toQuickAccessProject(project, "collaborator"));
  return [...ownedMapped, ...collabMapped];
}
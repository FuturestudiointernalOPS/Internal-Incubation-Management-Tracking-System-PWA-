"use client";

import ProjectsView from "@/spaces/staff/core/components/ProjectsView";

/**
 * MY PROJECTS
 *
 * Shows the projects assigned to the logged-in user (staff / PM), and the
 * invitations waiting for an answer. The data and the actions live in
 * `@/spaces/staff/core/components/ProjectsView`.
 */
export default function MyProjects() {
  return <ProjectsView />;
}

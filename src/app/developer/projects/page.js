import { redirect } from "next/navigation";

/**
 * Developer Projects → redirect to canonical /staff/projects.
 * Both roles share the same "My Projects" view; role detection
 * is handled automatically by ProjectsListView via the session API.
 */
export default function DeveloperProjectsRedirect() {
  redirect("/staff/projects");
}

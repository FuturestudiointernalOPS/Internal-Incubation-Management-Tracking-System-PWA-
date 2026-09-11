import { redirect } from "next/navigation";

/**
 * Milestones no longer have a standalone surface: a milestone always belongs
 * to a Journey, and it is managed inside that Journey (add / edit / reorder /
 * complete / archive live in the Journey panel).
 *
 * This route is kept as a redirect so notifications, history entries and old
 * bookmarks never 404.
 */
export const dynamic = "force-dynamic";

export default async function VentureMilestonesRedirect({ params }) {
  const { id } = await params;
  redirect(`/admin/ventures/${id}/journey`);
}

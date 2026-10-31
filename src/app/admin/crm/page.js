import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * The legacy CRM dashboard moved to the workspace.
 *
 * Its figures and its newest-people list now live in /crm, next to the records
 * layer, so there is a single CRM home. This route stays as a server redirect
 * for one release so bookmarks, old links and the Communication back-links keep
 * working.
 */
export default function LegacyCrmDashboardRedirect() {
  redirect("/crm");
}

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * The duplicate queue moved into the CRM workspace.
 * Kept as a server redirect for one release so old links keep working.
 */
export default function LegacyDuplicatesRedirect() {
  redirect("/crm/duplicates");
}

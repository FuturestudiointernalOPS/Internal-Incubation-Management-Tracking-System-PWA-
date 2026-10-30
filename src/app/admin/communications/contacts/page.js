import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * The people directory moved to the CRM workspace.
 *
 * /crm/contacts is now the single directory: it renders the full contacts screen
 * for the Super Admin and the read-only list for everyone else. This route stays
 * as a server redirect for one release so old links and bookmarks keep working.
 */
export default function LegacyContactsRedirect() {
  redirect("/crm/contacts");
}

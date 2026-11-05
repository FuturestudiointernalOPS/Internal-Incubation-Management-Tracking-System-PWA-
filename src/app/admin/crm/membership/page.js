import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Membership moved into the CRM workspace; the screen itself now decides
 * between read-only and writable from `org_membership.manage`.
 * Kept as a server redirect for one release so old links keep working.
 */
export default function LegacyMembershipRedirect() {
  redirect("/crm/membership");
}

import { redirect } from "next/navigation";
import { getSession } from "@/server/auth/session";
import { hasAnyFacilitatorAssignment } from "@/models/authorization/accessQueries";
import { roleHomeHref, MEMBER_HOME } from "@/models/platform/roles";
import { isPlatformOwnerRole } from "@/lib/identity";

export const dynamic = "force-dynamic";

/**
 * Facilitator area gate (server-side).
 *
 * Access to /member/facilitator/* is granted only to:
 *   - super admins (system-defined global access), or
 *   - users who hold at least one v2_program_staff facilitator assignment.
 *
 * Anyone else is redirected to their own home — the unified member dashboard.
 * The address `/member/facilitator` itself is retired (it is the dashboard
 * now), so this gate only protects the facilitator's own screens.
 */
export default async function FacilitatorLayout({ children }) {
  const session = await getSession();
  if (!session) redirect("/login");

  if (!isPlatformOwnerRole(session.role)) {
    const assigned = await hasAnyFacilitatorAssignment(
      session.cid,
      session.email,
    );
    if (!assigned) {
      // The member home refuses nobody, so there is no loop to fear any more:
      // the facilitator dashboard is not a separate destination.
      redirect(roleHomeHref(session.role) || MEMBER_HOME);
    }
  }

  return children;
}

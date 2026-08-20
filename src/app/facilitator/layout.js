import { redirect } from "next/navigation";
import { getSession, hasAnyFacilitatorAssignment } from "@/lib/auth";
import { roleHomeHref } from "@/lib/platform/roles";

export const dynamic = "force-dynamic";

/**
 * Facilitator area gate (server-side).
 *
 * Access to /facilitator/* is granted only to:
 *   - super admins (system-defined global access), or
 *   - users who hold at least one v2_program_staff facilitator assignment.
 *
 * Anyone else is redirected to their own role home — typing/editing the URL
 * does not grant access to this dashboard or its features.
 */
export default async function FacilitatorLayout({ children }) {
  const session = await getSession();
  if (!session) redirect("/login");

  if (session.role !== "super_admin") {
    const assigned = await hasAnyFacilitatorAssignment(
      session.cid,
      session.email,
    );
    if (!assigned) {
      redirect(roleHomeHref(session.role) || "/workspaces");
    }
  }

  return <>{children}</>;
}

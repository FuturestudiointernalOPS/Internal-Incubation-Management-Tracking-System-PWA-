import { redirect } from "next/navigation";
import { getSession, hasAnyFacilitatorAssignment } from "@/lib/auth";
import { roleHomeHref } from "@/lib/platform/roles";
import DashboardLayout from "@/components/layout/DashboardLayout";

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
      const home = roleHomeHref(session.role) || "/workspaces";
      // A facilitator-role user WITHOUT an assignment must never be sent to
      // their own role home (/facilitator) — that is an infinite redirect.
      // Send them to the neutral workspace hub instead.
      redirect(home === "/facilitator" ? "/workspaces" : home);
    }
  }

  return (
    <DashboardLayout role="facilitator">{children}</DashboardLayout>
  );
}

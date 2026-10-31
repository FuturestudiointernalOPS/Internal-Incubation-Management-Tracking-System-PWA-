"use client";

export const dynamic = "force-dynamic";

import DashboardLayout from "@/components/layout/DashboardLayout";
import CreationAccessGuard from "@/components/create/CreationAccessGuard";

/**
 * CREATE — the delegated creation surface.
 *
 * Lives OUTSIDE `/admin` on purpose: the admin layout is reserved for the
 * platform owner, while `programs.create`, `ventures.create` and
 * `investor.create` can be granted to any person from the Permission Center.
 *
 * The shell mounts once here (like every section layout), and the guard only
 * lets in someone who holds at least one creation capability. The `role` prop
 * is the pre-session fallback only — the effective role, and therefore the
 * sidebar, always comes from the session.
 */
export default function CreateLayout({ children }) {
  return (
    <DashboardLayout role="staff">
      <CreationAccessGuard>{children}</CreationAccessGuard>
    </DashboardLayout>
  );
}

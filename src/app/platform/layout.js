"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";

export const dynamic = "force-dynamic";

/**
 * PLATFORM LAYOUT — the Forms workspace inside the main dashboard shell.
 *
 * The workspace no longer has a sidebar of its own: its screens (dashboard,
 * forms, runs…) unfold under Communication → Forms in the main sidebar, and
 * render on the right of that same shell. The sidebar is built from the
 * connected person's session role and rights; `role` is only the pre-session
 * fallback, as in every other section layout.
 */
export default function PlatformLayout({ children }) {
  return <DashboardLayout role="staff">{children}</DashboardLayout>;
}

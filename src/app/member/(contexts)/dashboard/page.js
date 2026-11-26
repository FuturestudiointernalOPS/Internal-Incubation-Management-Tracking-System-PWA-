"use client";

export const dynamic = "force-dynamic";

import DashboardScreen from "@/spaces/member/core/DashboardScreen";

/**
 * /member/dashboard — THE member home.
 *
 * This IS the canonical address (the short `/dashboard` is a retired alias the
 * address catalogue redirects here). The page lives inside the member space's
 * shell group, so ONE sidebar serves the whole space instead of mounting a
 * second one here.
 *
 * The page is a thin entry point: the screen belongs to the member space
 * (`src/spaces/member/core/`), not to the router.
 */
export default function MemberDashboardPage() {
  return <DashboardScreen />;
}

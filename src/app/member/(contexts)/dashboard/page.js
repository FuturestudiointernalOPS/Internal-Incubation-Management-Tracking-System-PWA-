"use client";

export const dynamic = "force-dynamic";

import DashboardScreen from "@/spaces/member/core/DashboardScreen";

/**
 * /dashboard — THE member home.
 *
 * The URL is served by a rewrite from `/dashboard` to this route (see
 * `next.config.mjs`), so the address the person sees is the short one while the
 * page still lives inside the member space's shell group. That is what keeps
 * ONE sidebar for the whole space instead of mounting a second one here.
 *
 * The page is a thin entry point: the screen belongs to the member space
 * (`src/spaces/member/core/`), not to the router.
 */
export default function MemberDashboardPage() {
  return <DashboardScreen />;
}

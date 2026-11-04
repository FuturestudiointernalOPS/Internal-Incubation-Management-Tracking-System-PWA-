"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { getDashboardSessionUser, subscribeDashboardSession } from "@/lib/dashboardSession";
import { isDeniedInOperatingSpace, isOperatingSpace } from "@/spaces/registry";

/**
 * Where a person with no business in an operating area is sent.
 *
 * The relationship-aware landing (a founder's own venture, a learner's course)
 * is resolved by the server at sign-in; this is the neutral fallback.
 */
export const PERSONAL_HOME = "/workspaces";

/** Pure: should this role be turned away from an operating section? */
export function isTurnedAway(role) {
  return isDeniedInOperatingSpace(role);
}

/**
 * Keeps a personal identity out of an operating section (`/staff`, `/admin`).
 *
 * The list of identities that belong to the member space lives in ONE place
 * (`src/spaces/registry.js`); this guard only applies it. It is a courtesy of
 * the UI, not the security boundary: the API routes stay the authority and
 * refuse these identities on their own. The decision rests on the role the
 * session answered with, so a staff-family account — Lead Managers included —
 * is never affected, and while the role is still unknown the section renders as
 * before rather than guessing.
 */
export default function SectionRoleGuard({ space = "staff", children }) {
  const router = useRouter();
  const role = useSyncExternalStore(
    subscribeDashboardSession,
    () => getDashboardSessionUser()?.role || null,
    () => null,
  );
  const turnedAway =
    isOperatingSpace(space) && Boolean(role) && isTurnedAway(role);

  useEffect(() => {
    if (turnedAway) router.replace(PERSONAL_HOME);
  }, [turnedAway, router]);

  return turnedAway ? null : children;
}

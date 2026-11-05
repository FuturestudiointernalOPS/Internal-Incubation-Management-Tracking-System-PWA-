"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { getDashboardSessionUser, subscribeDashboardSession } from "@/lib/dashboardSession";
import { normalizeRole } from "@/lib/identity";

/**
 * Identities that belong to a PERSONAL surface (a person, not a staff function).
 * Their sidebar is relationship-driven and never offers the staff, programme
 * manager, finance or CRM areas, so landing there by address only shows them an
 * operating shell that every one of its API calls then refuses.
 */
const PERSONAL_IDENTITIES = new Set(["member", "participant", "founder", "investor"]);

/** Where a person with no business in an operating area is sent. */
export const PERSONAL_HOME = "/workspaces";

/** Pure: should this role be turned away from an operating section? */
export function isTurnedAway(role) {
  return PERSONAL_IDENTITIES.has(normalizeRole(role));
}

/**
 * Keeps a personal identity out of an operating section (/staff, /pm, /finance,
 * /crm). It is a courtesy of the UI, not the security boundary: the API routes
 * stay the authority and refuse these identities on their own. The decision rests
 * on the role the session answered with, so a staff-family account — Lead
 * Managers included — is never affected, and while the role is still unknown the
 * section renders as before rather than guessing.
 */
export default function SectionRoleGuard({ children }) {
  const router = useRouter();
  const role = useSyncExternalStore(
    subscribeDashboardSession,
    () => getDashboardSessionUser()?.role || null,
    () => null,
  );
  const turnedAway = Boolean(role) && isTurnedAway(role);

  useEffect(() => {
    if (turnedAway) router.replace(PERSONAL_HOME);
  }, [turnedAway, router]);

  return turnedAway ? null : children;
}

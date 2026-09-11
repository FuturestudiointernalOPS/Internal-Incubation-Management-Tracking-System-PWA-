"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * ONE DASHBOARD — /staff/me forwards to the dashboard.
 *
 * "My Dashboard" was a second dashboard: its own personal calendar, its own
 * notifications list, its own ventures list — the duplication that made one
 * account look like three dashboards. The calendar page (/staff) is the single
 * dashboard; the relationships it used to list are added to it as stat cards,
 * and notifications live in the header bell.
 *
 * The URL stays as a forwarder so old bookmarks and sidebar muscle memory keep
 * working.
 */
export default function StaffPersonalHomeRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/staff");
  }, [router]);

  return null;
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useDialogs } from "@/components/ui/DialogProvider";

const BASE = "/api/integrations/google-calendar";

// Outcomes the OAuth callback reports through `?gcal=` (see callback/route.js).
const OUTCOME_KEYS = {
  connected: "connected",
  connectedSyncPending: "connectedSyncPending",
  denied: "denied",
  invalidState: "failed",
  failed: "failed",
  noRefreshToken: "failed",
  scopeDenied: "scopeDenied",
  notConfigured: "notConfigured",
};

// The OAuth outcome is announced ONCE per page load, even though the hook is
// mounted by both the shell and (on /admin) the dashboard — two instances must
// not raise two notices for one round-trip.
let outcomeAnnounced = false;

/**
 * A user's Google Calendar connection. Shared by every role.
 *
 * Loads the status; when connected and `withEvents`, asks the server for a sync
 * if the last one is stale, then loads the events the user added to the "Future
 * Studio" calendar (already filtered server-side — personal calendars are never
 * read). Announces the outcome of the OAuth round-trip once and cleans `?gcal=`
 * from the URL. Exposes connect / syncNow / disconnect.
 *
 * `withEvents` is off by default: the profile card only needs the connection
 * state, not the calendar feed.
 */
export function useGoogleCalendar({ t, withEvents = false } = {}) {
  const router = useRouter();
  const { confirm, alert } = useDialogs();
  const [status, setStatus] = useState(null); // null = loading or not reachable
  const [events, setEvents] = useState([]);
  const [syncing, setSyncing] = useState(false);

  const loadEvents = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/events`);
      const data = await res.json();
      if (data.success) setEvents(data.events || []);
    } catch {
      // The page keeps working without Google entries.
    }
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch(BASE);
      if (!res.ok) {
        setStatus(null); // not signed in, or the API is unavailable: no control
        return null;
      }
      const data = await res.json();
      setStatus(data);
      return data;
    } catch {
      setStatus(null);
      return null;
    }
  }, []);

  const runSync = useCallback(
    async ({ ifStale = false } = {}) => {
      setSyncing(true);
      try {
        const res = await fetch(`${BASE}/sync${ifStale ? "?ifStale=1" : ""}`, { method: "POST" });
        const data = await res.json().catch(() => ({}));
        await Promise.all([loadStatus(), withEvents ? loadEvents() : Promise.resolve()]);
        return data;
      } finally {
        setSyncing(false);
      }
    },
    [loadEvents, loadStatus, withEvents],
  );

  useEffect(() => {
    (async () => {
      const current = await loadStatus();
      if (current?.connected) {
        if (withEvents) await loadEvents();
        runSync({ ifStale: true });
      }
    })();
  }, [loadStatus, loadEvents, runSync, withEvents]);

  // One-time notice after the round-trip through Google.
  useEffect(() => {
    // Read once from the URL (no useSearchParams: it would need a Suspense boundary).
    const outcome = new URLSearchParams(window.location.search).get("gcal");
    if (!outcome || outcomeAnnounced) return;
    outcomeAnnounced = true;
    const key = OUTCOME_KEYS[outcome] || "failed";
    router.replace(window.location.pathname, { scroll: false });
    alert({ message: t(`googleCalendar.outcome.${key}`) });
  }, [router, alert, t]);

  const connect = useCallback(async () => {
    if (status && !status.configured) {
      // Not set up on this server: say what is missing instead of failing silently.
      await alert({
        title: t("googleCalendar.notConfiguredTitle"),
        message: t("googleCalendar.notConfiguredMessage"),
        hint: (status.missing || []).join(", "),
      });
      return;
    }
    // Full-page navigation: the server redirects to Google's consent screen.
    // The current path travels along so the callback returns the person here.
    const next = encodeURIComponent(window.location.pathname);
    window.location.href = new URL(`${BASE}/connect?next=${next}`, window.location.origin).toString();
  }, [status, alert, t]);

  const syncNow = useCallback(async () => {
    const data = await runSync();
    if (!data?.success) {
      await alert({ message: t("googleCalendar.syncFailed") });
    }
  }, [runSync, alert, t]);

  const disconnect = useCallback(async () => {
    const ok = await confirm({
      message: t("googleCalendar.disconnectConfirm"),
      hint: t("googleCalendar.disconnectHint"),
      tone: "danger",
      confirmLabel: t("googleCalendar.disconnect"),
    });
    if (!ok) return;
    await fetch(BASE, { method: "DELETE" });
    setEvents([]);
    await loadStatus();
  }, [confirm, loadStatus, t]);

  return { status, events, syncing, connect, syncNow, disconnect };
}

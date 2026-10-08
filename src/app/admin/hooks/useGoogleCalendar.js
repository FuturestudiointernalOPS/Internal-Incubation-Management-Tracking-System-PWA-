"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

/**
 * The super admin's Google Calendar connection, for the dashboard calendar.
 *
 * Loads the status; when connected, asks the server for a sync if the last one
 * is stale, then loads the events the user added to the "Future Studio"
 * calendar in Google (already filtered server-side — personal calendars are
 * never read). Announces the outcome of the OAuth round-trip once and cleans
 * `?gcal=` from the URL. Exposes connect / syncNow / disconnect.
 */
export function useGoogleCalendar({ t }) {
  const router = useRouter();
  const { confirm, alert } = useDialogs();
  const [status, setStatus] = useState(null); // null = loading or not allowed
  const [events, setEvents] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const announced = useRef(false);

  const loadEvents = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/events`);
      const data = await res.json();
      if (data.success) setEvents(data.events || []);
    } catch {
      // The dashboard calendar keeps working without Google entries.
    }
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch(BASE);
      if (!res.ok) {
        setStatus(null); // not a super admin, or the API is unavailable: no button
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
        await Promise.all([loadStatus(), loadEvents()]);
        return data;
      } finally {
        setSyncing(false);
      }
    },
    [loadEvents, loadStatus],
  );

  useEffect(() => {
    (async () => {
      const current = await loadStatus();
      if (current?.connected) {
        await loadEvents();
        runSync({ ifStale: true });
      }
    })();
  }, [loadStatus, loadEvents, runSync]);

  // One-time notice after the round-trip through Google.
  useEffect(() => {
    // Read once from the URL (no useSearchParams: it would need a Suspense boundary).
    const outcome = new URLSearchParams(window.location.search).get("gcal");
    if (!outcome || announced.current) return;
    announced.current = true;
    const key = OUTCOME_KEYS[outcome] || "failed";
    router.replace("/admin", { scroll: false });
    alert({ message: t(`admin.googleCalendar.outcome.${key}`) });
  }, [router, alert, t]);

  const connect = useCallback(async () => {
    if (status && !status.configured) {
      // Not set up on this server: say what is missing instead of failing silently.
      await alert({
        title: t("admin.googleCalendar.notConfiguredTitle"),
        message: t("admin.googleCalendar.notConfiguredMessage"),
        hint: (status.missing || []).join(", "),
      });
      return;
    }
    // Full-page navigation: the server redirects to Google's consent screen.
    // (an API route, not a page — router.push cannot follow it).
    window.location.href = new URL(`${BASE}/connect`, window.location.origin).toString();
  }, [status, alert, t]);

  const syncNow = useCallback(async () => {
    const data = await runSync();
    if (!data?.success) {
      await alert({ message: t("admin.googleCalendar.syncFailed") });
    }
  }, [runSync, alert, t]);

  const disconnect = useCallback(async () => {
    const ok = await confirm({
      message: t("admin.googleCalendar.disconnectConfirm"),
      hint: t("admin.googleCalendar.disconnectHint"),
      tone: "danger",
      confirmLabel: t("admin.googleCalendar.disconnect"),
    });
    if (!ok) return;
    await fetch(BASE, { method: "DELETE" });
    setEvents([]);
    await loadStatus();
  }, [confirm, loadStatus, t]);

  return { status, events, syncing, connect, syncNow, disconnect };
}

"use client";

import { AlertTriangle, CalendarPlus, RefreshCw, Unlink } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "./constants";

/**
 * The Google Calendar control in the dashboard calendar's header.
 *
 *   not connected → "Connect Google Calendar" (starts the OAuth flow)
 *   connected     → linked account, "sync now", "disconnect"
 *   access lost   → "reconnect"
 *   not set up    → the same button; the click explains what is missing
 *
 * Renders nothing until the status is known (and nothing at all for a caller
 * the API refuses), so the calendar never flickers for other roles.
 */
export default function GoogleCalendarConnect({ status, syncing, onConnect, onSync, onDisconnect }) {
  const { t } = useI18n();
  if (!status) return null;

  if (!status.connected) {
    // Always clickable: when the server is not set up yet, the click explains
    // what is missing (see useGoogleCalendar.connect) instead of doing nothing.
    return (
      <button
        type="button"
        onClick={onConnect}
        title={status.configured ? t("admin.googleCalendar.connectHint") : t("admin.googleCalendar.notConfiguredHint")}
        className="btn btn-secondary gap-2 !py-1.5 !px-3 text-[11px]"
      >
        <CalendarPlus className="w-3.5 h-3.5 text-[var(--brand-orange)]" />
        {t("admin.googleCalendar.connect")}
      </button>
    );
  }

  if (status.lastError === "revoked") {
    return (
      <button
        type="button"
        onClick={onConnect}
        title={t("admin.googleCalendar.revokedHint")}
        className="btn btn-secondary gap-2 !py-1.5 !px-3 text-[11px]"
      >
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
        {t("admin.googleCalendar.reconnect")}
      </button>
    );
  }

  const lastSync = status.lastSyncedAt ? new Date(status.lastSyncedAt).toLocaleString() : "—";
  return (
    <div className="flex items-center gap-1">
      <span
        className="hidden sm:inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[var(--surface-2)] text-[10px] font-bold text-[var(--text-secondary)] max-w-[200px]"
        title={`${status.email || ""} · ${t("admin.googleCalendar.lastSync")}: ${lastSync}`}
      >
        <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0" />
        <span className="truncate">{status.email || t("admin.googleCalendar.connected")}</span>
      </span>
      <button
        type="button"
        onClick={onSync}
        disabled={syncing}
        title={`${t("admin.googleCalendar.syncNow")} — ${t("admin.googleCalendar.lastSync")}: ${lastSync}`}
        aria-label={t("admin.googleCalendar.syncNow")}
        className="p-1.5 rounded-lg hover:bg-tertiary transition-all disabled:opacity-50"
      >
        <RefreshCw className={cn("w-4 h-4", syncing && "animate-spin")} />
      </button>
      <button
        type="button"
        onClick={onDisconnect}
        title={t("admin.googleCalendar.disconnect")}
        aria-label={t("admin.googleCalendar.disconnect")}
        className="p-1.5 rounded-lg hover:bg-tertiary transition-all text-[var(--text-secondary)]"
      >
        <Unlink className="w-4 h-4" />
      </button>
    </div>
  );
}

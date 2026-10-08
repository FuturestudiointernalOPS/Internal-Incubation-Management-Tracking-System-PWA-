"use client";

import { AlertTriangle, CalendarPlus, RefreshCw, Unlink } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useGoogleCalendar } from "./useGoogleCalendar";

/**
 * "Google Calendar" connection card, for any role's account/profile page.
 *
 * Renders nothing until the status is known (and nothing at all when the API
 * refuses), so a page never flickers. The connection state is the same one the
 * dashboards use; only the connection is managed here, not the calendar feed.
 */
export default function GoogleCalendarCard() {
  const { t } = useI18n();
  const gc = useGoogleCalendar({ t });

  if (!gc.status) return null;

  const connected = gc.status.connected && gc.status.lastError !== "revoked";
  const revoked = gc.status.connected && gc.status.lastError === "revoked";
  const lastSync = gc.status.lastSyncedAt
    ? new Date(gc.status.lastSyncedAt).toLocaleString()
    : "—";

  return (
    <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-[var(--text-primary)]">
            {t("admin.googleCalendar.connect")}
          </p>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            {connected
              ? `${gc.status.email || ""} · ${t("admin.googleCalendar.lastSync")}: ${lastSync}`
              : revoked
                ? t("admin.googleCalendar.revokedHint")
                : t("admin.googleCalendar.connectHint")}
          </p>
        </div>

        {connected ? (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={gc.syncNow}
              disabled={gc.syncing}
              title={t("admin.googleCalendar.syncNow")}
              aria-label={t("admin.googleCalendar.syncNow")}
              className="p-1.5 rounded-lg hover:bg-[var(--surface-2)] transition-all disabled:opacity-50"
            >
              <RefreshCw className={gc.syncing ? "w-4 h-4 animate-spin" : "w-4 h-4"} />
            </button>
            <button
              type="button"
              onClick={gc.disconnect}
              title={t("admin.googleCalendar.disconnect")}
              aria-label={t("admin.googleCalendar.disconnect")}
              className="p-1.5 rounded-lg hover:bg-[var(--surface-2)] transition-all text-[var(--text-secondary)]"
            >
              <Unlink className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={gc.connect}
            title={gc.status.configured ? t("admin.googleCalendar.connectHint") : t("admin.googleCalendar.notConfiguredHint")}
            className="flex items-center gap-2 shrink-0 px-3 py-1.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-lg text-[11px] font-bold text-[var(--text-primary)] hover:bg-[var(--surface-3)] transition-colors"
          >
            {revoked ? (
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <CalendarPlus className="w-3.5 h-3.5 text-[var(--brand-orange)]" />
            )}
            {revoked ? t("admin.googleCalendar.reconnect") : t("admin.googleCalendar.connect")}
          </button>
        )}
      </div>
    </div>
  );
}

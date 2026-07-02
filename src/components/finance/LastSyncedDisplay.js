"use client";

import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";

/**
 * Relative time helper (no external dependency).
 * Returns a string like "3 minutes" or "2 hours".
 */
function timeAgo(isoString, t) {
  if (!isoString) return null;
  const now = Date.now();
  const then = new Date(isoString).getTime();
  if (isNaN(then)) return null;

  const diffMs = now - then;
  if (diffMs < 0) return null;

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return t("finance.dashboard.lastSyncedJustNow");

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? "s" : ""}`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""}`;

  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? "s" : ""}`;
}

/**
 * Last Synced Display + Sync Now Button.
 *
 * Props:
 *   lastSyncedAt  - ISO datetime string
 *   sourceType    - String identifier for the source
 *   isSyncing     - Whether a sync is in progress
 *   onSync      - Callback when Sync Now is clicked
 *   syncError   - Error message from last sync attempt (optional)
 */
export default function LastSyncedDisplay({
  lastSyncAt,
  syncing = false,
  onSync,
  syncError,
}) {
  const { t } = useI18n();
  const [relative, setRelative] = useState(() => timeAgo(lastSyncAt, t));
  const [staleLevel, setStaleLevel] = useState("synced");

  useEffect(() => {
    function update() {
      setRelative(timeAgo(lastSyncAt, t));

      if (!lastSyncAt) {
        setStaleLevel("notSynced");
        return;
      }
      const hours = (Date.now() - new Date(lastSyncAt).getTime()) / 3600000;
      if (hours < 6) setStaleLevel("synced");
      else if (hours < 24) setStaleLevel("stale");
      else setStaleLevel("stale");
    }

    update();
    const interval = setInterval(update, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [lastSyncAt, t]);

  const colorMap = {
    synced: "var(--green)",
    stale: "var(--amber)",
    notSynced: "var(--red)",
  };

  return (
    <div className="flex items-center gap-4">
      {/* Last synced indicator */}
      <div className="flex items-center gap-2">
        <span
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: colorMap[staleLevel] || "var(--text-secondary)" }}
        />
        <span
          className="text-[10px] font-bold"
          style={{ color: "var(--text-secondary)" }}
        >
          {lastSyncAt
            ? t("finance.dashboard.lastSynced", { time: relative || "?" })
            : t("finance.status.notSynced")}
        </span>
      </div>

      {/* Sync Now button */}
      <button
        onClick={onSync}
        disabled={syncing}
        className="rounded-lg px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          background: syncing
            ? "var(--surface-2)"
            : "var(--brand-orange)",
          color: syncing ? "var(--text-secondary)" : "#fff",
          border: syncing ? "1px solid var(--border-primary)" : "none",
        }}
      >
        {syncing ? (
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 border-2 border-t-transparent rounded-full animate-spin" />
            {t("finance.dashboard.syncing")}
          </span>
        ) : (
          t("finance.dashboard.syncNow")
        )}
      </button>

      {/* Sync error message */}
      {syncError && (
        <span
          className="text-[10px] font-bold"
          style={{ color: "var(--red)" }}
        >
          {syncError}
        </span>
      )}
    </div>
  );
}

"use client";

import React from "react";
import { useI18n } from "@/lib/i18n";
import Badge from "./Badge";

/**
 * PHASE UI-3 — the unified pending-changes list (UI-2c + Defaults Matrix).
 *
 * One presentation for "what am I about to save": capability label + OFF/level
 * badge. Scrollable past a handful of entries so the review bar stays compact.
 */
export default function PendingChangesList({ items = [], maxHeight = "10rem" }) {
  const { t } = useI18n();
  if (!items.length) return null;
  return (
    <ul className="space-y-1 overflow-y-auto" style={{ maxHeight }}>
      {items.map((item, i) => {
        const level = Number(item.level ?? item.to ?? 0);
        return (
          <li
            key={`${item.label}-${i}`}
            className="flex items-center justify-between gap-3 text-xs"
          >
            <span className="font-bold text-[var(--text-primary)] truncate">
              {item.label}
            </span>
            {level > 0 ? (
              <Badge variant="verified">
                {t("engineering.permissions.pendingLevelFull", { level })}
              </Badge>
            ) : (
              <Badge variant="locked">
                {t("engineering.permissions.pendingLevelOff")}
              </Badge>
            )}
          </li>
        );
      })}
    </ul>
  );
}

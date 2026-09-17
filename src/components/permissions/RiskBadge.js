"use client";

import React from "react";
import { useI18n } from "@/lib/i18n";
import {
  RISK_BADGE_CLASS,
  RISK_UNKNOWN_BADGE_CLASS,
  riskLabelKey,
} from "./riskGate";

/**
 * PHASE UI-9 — one risk chip, shared by the confirmation dialog and the
 * role/group rollup. It renders the SAME colour language AdvancedCapabilities
 * uses, so `critical` never looks like `medium` depending on the screen.
 *
 * The label comes from the locale file (engineering.permissions.advancedRisk.*)
 * with the raw level as the fallback, so a new level added to the catalog shows
 * up as itself instead of an empty chip.
 */
export default function RiskBadge({ risk, className = "" }) {
  const { t } = useI18n();
  const key = riskLabelKey(risk);
  const label = t(key);
  return (
    <span
      className={`shrink-0 px-1.5 py-0.5 rounded border text-[9px] font-black uppercase tracking-widest ${
        RISK_BADGE_CLASS[risk] || RISK_UNKNOWN_BADGE_CLASS
      } ${className}`}
    >
      {label === key ? risk : label}
    </span>
  );
}

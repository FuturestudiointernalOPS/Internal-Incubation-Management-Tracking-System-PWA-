"use client";

import React from "react";
import Badge from "./Badge";
import { useI18n } from "@/lib/i18n";

/**
 * UI-2 primitive — the effective result of a capability, WITH its reason.
 * Mixed sources never collapse: a profile-yes + restriction-no renders as
 * "DENIED — Restriction" instead of a bare cross.
 *
 * @param {{effective: boolean, reason?: string|null}} props
 */
// Both vocabularies are mapped: the UI-local one (legacy derivation) and the
// ENGINE's enum reasons (§12.4 — the reason the server actually enforced).
const REASON_KEYS = {
  // UI-local derivation
  "not-eligible": "engineering.permissions.effectiveReasonNotEligible",
  restriction: "engineering.permissions.effectiveReasonRestriction",
  "no-source": "engineering.permissions.effectiveReasonNoSource",
  // Engine enum (AUTHZ_REASONS)
  not_eligible: "engineering.permissions.effectiveReasonNotEligible",
  blocked: "engineering.permissions.effectiveReasonRestriction",
  missing_permission: "engineering.permissions.effectiveReasonNoSource",
  insufficient_level: "engineering.permissions.effectiveReasonInsufficientLevel",
  account_not_active: "engineering.permissions.effectiveReasonAccountNotActive",
};

export default function EffectiveBadge({ effective, reason }) {
  const { t } = useI18n();
  if (effective) {
    return <Badge variant="mapped">{t("engineering.permissions.effectiveAllowed")}</Badge>;
  }
  const reasonKey = REASON_KEYS[reason];
  return (
    <Badge variant="denied">
      {t("engineering.permissions.effectiveDenied")}
      {reasonKey ? ` — ${t(reasonKey)}` : ""}
    </Badge>
  );
}

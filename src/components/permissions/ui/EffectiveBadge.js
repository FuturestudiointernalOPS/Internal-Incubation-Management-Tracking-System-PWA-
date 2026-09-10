"use client";

import React from "react";
import Badge from "./Badge";
import { useI18n } from "@/lib/i18n";

/**
 * UI-2 primitive — the effective result of a capability, WITH its reason.
 * Mixed sources never collapse: a profile-yes + restriction-no renders as
 * "DENIED — Restriction" instead of a bare cross.
 *
 * @param {{effective: boolean, reason?: "restriction"|"no-source"|null}} props
 */
const REASON_KEYS = {
  restriction: "engineering.permissions.effectiveReasonRestriction",
  "no-source": "engineering.permissions.effectiveReasonNoSource",
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

"use client";

import { Sparkles } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { buildVerdict, TONE } from "./analysisModel";

/**
 * WHAT THIS MEANS — the conclusion, in sentences.
 *
 * Built from the same figures the panels above show, using the studio's own
 * thresholds (through the traffic light). It states what the numbers imply; it
 * does not invent a recommendation the data cannot support.
 */
const TONE_CLASS = { [TONE.bad]: "r", [TONE.warn]: "w", [TONE.good]: "g", [TONE.muted]: "" };

export default function VerdictPanel({ dashboard }) {
  const { t, lang } = useI18n();
  const { sentences, tone } = buildVerdict({ dashboard, t, lang });

  return (
    <div
      className="stf-card"
      style={{
        padding: 16,
        display: "grid",
        gap: 10,
        borderLeft: `3px solid ${
          tone === TONE.bad
            ? "var(--status-red, #ef4444)"
            : tone === TONE.good
              ? "var(--stf-done, #10B981)"
              : "var(--brand-orange)"
        }`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Sparkles size={15} style={{ color: "var(--brand-orange)" }} />
        <p className="stf-k" style={{ margin: 0 }}>{t("vadmin.reportsVerdict.title")}</p>
        <span className={`stf-tag ${TONE_CLASS[tone] || ""}`}>{t("vadmin.reportsVerdict.reading")}</span>
      </div>
      <p className="stf-small" style={{ margin: 0, color: "var(--text-primary)", lineHeight: 1.6 }}>
        {sentences.join(" ")}
      </p>
    </div>
  );
}

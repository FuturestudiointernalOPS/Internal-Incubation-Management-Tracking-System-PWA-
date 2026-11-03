"use client";

import { ShieldAlert } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { buildRisks, TONE } from "./analysisModel";

/**
 * THE RISKS WORTH ACTING ON.
 *
 * Each row is a threshold the studio itself set (traffic light), a reporting
 * cadence that has gone quiet, or a Data Room requirement that is unmet — never
 * an opinion. An empty list says so instead of showing a green "all clear" the
 * data has not earned.
 */
const TAG_TONE = { [TONE.bad]: "r", [TONE.warn]: "w", [TONE.good]: "g", [TONE.muted]: "" };

export default function RiskPanel({ dashboard, compliance, dataRoom }) {
  const { t, lang } = useI18n();
  const risks = buildRisks({ dashboard, compliance, dataRoom, lang });

  return (
    <div className="stf-card" style={{ padding: 16, display: "grid", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <ShieldAlert size={15} style={{ color: "var(--brand-orange)" }} />
        <p className="stf-k" style={{ margin: 0 }}>{t("vadmin.reportsRisks.title")}</p>
      </div>

      {risks.length === 0 ? (
        <p className="stf-small" style={{ margin: 0 }}>{t("vadmin.reportsRisks.none")}</p>
      ) : (
        <ul style={{ display: "grid", gap: 8, margin: 0, padding: 0, listStyle: "none" }}>
          {risks.map((risk) => (
            <li
              key={risk.key}
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 12,
                paddingBottom: 8,
                borderBottom: "1px solid var(--border-primary)",
              }}
            >
              <span className={`stf-tag ${TAG_TONE[risk.tone] || ""}`}>
                {t(`vadmin.reportsRisks.${risk.key}`)}
              </span>
              <span className="stf-small" style={{ textAlign: "right" }}>
                {t(risk.detailKey, risk.detail)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

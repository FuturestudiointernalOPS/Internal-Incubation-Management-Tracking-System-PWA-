"use client";

import { Wallet } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import StatusCard from "@/components/ui/StatusCard";
import { bridgeToTargetRunway, money, num } from "./analysisModel";

/**
 * FUNDING READINESS — can this Venture take money, and how much does it need?
 *
 * Roadmap readiness and Data Room completeness are the two indicators the
 * founder already sees (separate on purpose — never one number pretending to be
 * both); the bridge is the studio's own green runway at the current burn.
 */
const TONE_OF_PERCENT = (value) => (value === null || value === undefined ? "o" : value >= 80 ? "g" : value >= 50 ? "o" : "r");

export default function FundingPanel({ dashboard, readiness, baseline }) {
  const { t, lang } = useI18n();
  const roadmap = readiness?.roadmap_readiness?.overall_percent ?? null;
  const dataRoom = readiness?.data_room_readiness?.readiness_percent ?? null;
  const missingDocs = Number(readiness?.data_room_readiness?.missing_count) || 0;
  const currency = dashboard?.latest?.currency || "XOF";
  const bridge = bridgeToTargetRunway(dashboard);

  const received = baseline?.outsideFinancingMode === "band"
    ? baseline.outsideFinancingBand || "—"
    : money(baseline?.outsideFinancingValue ?? null, baseline?.currency || currency, lang);

  const stage = dashboard?.stage || {};
  const nextStage = stage.nextStage || null;
  const missingCriteria = Number(stage.missing) || 0;

  return (
    <div className="space-y-5">
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Wallet size={15} style={{ color: "var(--brand-orange)" }} />
        <p className="stf-k" style={{ margin: 0 }}>{t("vadmin.reportsFunding.title")}</p>
      </div>

      <div className="stf-grid c4">
        <StatusCard
          tone={TONE_OF_PERCENT(roadmap)}
          label={t("vadmin.reportsFunding.roadmap")}
          value={roadmap === null ? "—" : `${num(roadmap, lang)}%`}
          hint={t("vadmin.reportsFunding.roadmapHint")}
        />
        <StatusCard
          tone={TONE_OF_PERCENT(dataRoom)}
          label={t("vadmin.reportsFunding.dataRoom")}
          value={dataRoom === null ? "—" : `${num(dataRoom, lang)}%`}
          hint={
            missingDocs > 0
              ? t("vadmin.reportsFunding.dataRoomMissing", { missing: num(missingDocs, lang) })
              : t("vadmin.reportsFunding.dataRoomComplete")
          }
        />
        <StatusCard
          tone="g"
          label={t("vadmin.reportsFunding.received")}
          value={received}
          hint={t("vadmin.reportsFunding.receivedHint")}
        />
        <StatusCard
          tone={bridge ? "o" : "g"}
          label={t("vadmin.reportsFunding.gap")}
          value={bridge ? money(bridge.amount, currency, lang) : t("vadmin.reportsFunding.none")}
          hint={
            bridge
              ? t("vadmin.reportsFunding.gapHint", {
                  months: num(bridge.months, lang, 1),
                  target: num(dashboard?.thresholds?.runwayGreenMonths, lang, 0),
                })
              : t("vadmin.reportsFunding.gapNone")
          }
        />
      </div>

      <div className="stf-card" style={{ padding: 14, display: "grid", gap: 8 }}>
        <p className="stf-k" style={{ margin: 0 }}>{t("vadmin.reportsFunding.nextStage")}</p>
        {nextStage ? (
          <>
            <p className="stf-small" style={{ margin: 0, color: "var(--text-primary)" }}>
              {t(`venture.reporting.stage.name.${nextStage}`)} ·{" "}
              {t("vadmin.reportsFunding.criteria", {
                met: num(stage.met, lang),
                total: num(stage.total, lang),
              })}
            </p>
            <p className="stf-small" style={{ margin: 0 }}>
              {missingCriteria > 0
                ? t("vadmin.reportsFunding.missing", { count: num(missingCriteria, lang) })
                : t("vadmin.reportsFunding.nothingMissing")}
            </p>
          </>
        ) : (
          <p className="stf-small" style={{ margin: 0 }}>{t("vadmin.reportsFunding.noNextStage")}</p>
        )}
      </div>
    </div>
  );
}

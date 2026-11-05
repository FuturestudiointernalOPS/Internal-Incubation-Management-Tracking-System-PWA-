"use client";

import { HeartHandshake } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import StatusCard from "@/components/ui/StatusCard";
import { latestMonth, num, pointValue } from "./analysisModel";

/**
 * IMPACT — what the Venture changed, against its locked baseline.
 *
 * Jobs are the honest comparison: the baseline FTE was captured once and is
 * never rewritten, so "created" and "supported" cannot drift with a later
 * report. Both are FTE, never headcount, which is why they are labelled so.
 */
export default function ImpactPanel({ dashboard, baseline }) {
  const { t, lang } = useI18n();
  const month = latestMonth(dashboard?.months || []);
  const latestFte = pointValue(month?.fte);
  const baselineFte = baseline?.fte === null || baseline?.fte === undefined ? null : Number(baseline.fte);

  if (!baseline) {
    return (
      <div className="stf-card" style={{ padding: 16 }}>
        <p className="stf-small" style={{ margin: 0 }}>{t("vadmin.reportsImpact.noBaseline")}</p>
      </div>
    );
  }

  // Created and lost are reported separately. A Venture that went from 6 FTE to
  // 4 has created 0 jobs — printing "−2" under a "jobs created" label reads as
  // a small negative number, when it is a loss of two jobs.
  const net = latestFte !== null && baselineFte !== null ? latestFte - baselineFte : null;
  const created = net === null ? null : Math.max(0, net);
  const lost = net === null ? null : Math.max(0, -net);

  const jobsHint =
    net === null
      ? t("vadmin.reportsImpact.noBaseline")
      : lost > 0
        ? `${num(baselineFte, lang, 1)} → ${num(latestFte, lang, 1)} · ${num(lost, lang, 1)} ${t("vadmin.reportsImpact.jobsLost")}`
        : `${num(baselineFte, lang, 1)} → ${num(latestFte, lang, 1)}`;

  return (
    <div className="space-y-5">
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <HeartHandshake size={15} style={{ color: "var(--brand-orange)" }} />
        <p className="stf-k" style={{ margin: 0 }}>{t("vadmin.reportsImpact.title")}</p>
      </div>

      <div className="stf-grid c4">
        <StatusCard
          tone={net === null ? "o" : net >= 0 ? "g" : "r"}
          label={t("vadmin.reportsImpact.jobsCreated")}
          value={created === null ? "—" : created > 0 ? `+${num(created, lang, 1)}` : num(created, lang, 1)}
          hint={jobsHint}
        />
        <StatusCard
          tone="g"
          label={t("vadmin.reportsImpact.jobsSupported")}
          value={num(latestFte, lang, 1)}
          hint={t("vadmin.reportsImpact.fteHint")}
        />
        <StatusCard
          tone="o"
          label={t("vadmin.reportsImpact.headcount")}
          value={num(dashboard?.team?.headcount ?? null, lang)}
          hint={t("vadmin.reportsImpact.headcountHint")}
        />
        <StatusCard
          tone="o"
          label={t("vadmin.reportsImpact.womenShare")}
          value={dashboard?.team?.womenShare == null ? "—" : `${num(dashboard.team.womenShare, lang, 1)}%`}
          hint={t("vadmin.reportsImpact.teamHint")}
        />
        <StatusCard
          tone="o"
          label={t("vadmin.reportsImpact.youthShare")}
          value={dashboard?.team?.youthShare == null ? "—" : `${num(dashboard.team.youthShare, lang, 1)}%`}
          hint={t("vadmin.reportsImpact.teamHint")}
        />
      </div>

      <div className="stf-card" style={{ padding: 14, display: "grid", gap: 6 }}>
        <p className="stf-k" style={{ margin: 0 }}>{t("vadmin.reportsImpact.customers")}</p>
        <p className="stf-small" style={{ margin: 0, color: "var(--text-primary)" }}>
          {num(baseline.payingCustomers, lang)} → {num(month?.payingCustomers, lang)}
        </p>
      </div>
    </div>
  );
}

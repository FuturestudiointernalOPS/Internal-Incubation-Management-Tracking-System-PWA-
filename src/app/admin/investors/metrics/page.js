"use client";

import { BarChart3, Calendar, DollarSign, Loader2, Rocket, TrendingUp, Users } from "lucide-react";

import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import SectionHead from "@/components/ui/SectionHead";

const pickMetrics = (payload) => (payload?.success ? payload.metrics || null : null);

function Stat({ label, value }) {
  return (
    <div className="stf-card" style={{ padding: 12, background: "var(--surface-2)" }}>
      <div className="stf-k">{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, marginTop: 4 }}>{value}</div>
    </div>
  );
}

/**
 * /admin/investors/metrics
 *
 * The studio's investor metrics (A–F), computed live from the event log and the
 * tables. Missing data is "—", never a fabricated zero.
 */
export default function InvestorMetricsPage() {
  const { t } = useI18n();
  const { data, loading } = useApi("/api/admin/investors/metrics", {
    defaultValue: null,
    transform: pickMetrics,
  });

  if (loading && !data) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--brand-orange)]" />
      </div>
    );
  }

  const metrics = data || {};
  const A = metrics.A || {};
  const B = metrics.B || {};
  const C = metrics.C || {};
  const D = metrics.D || {};
  const E = metrics.E || {};
  const F = metrics.F || {};

  const n = (value) => (value == null ? "—" : Number(value).toLocaleString());
  const pct = (value) => (value == null ? "—" : `${Math.round(Number(value) * 100)}%`);
  const days = (value) => (value == null ? "—" : `${Number(value).toFixed(1)}d`);
  const hours = (value) => (value == null ? "—" : `${Number(value).toFixed(1)}h`);

  return (
    <div className="stf" style={{ paddingBottom: 60 }}>
      <div className="stf-head">
        <div>
          <h1 className="stf-title">{t("investorAdmin.metrics.title")}</h1>
          <p className="stf-sub">{t("investorAdmin.metrics.subtitle")}</p>
        </div>
      </div>

      <section className="stf-sec">
        <SectionHead letter="A" tone="o" icon={Users} title={t("investorAdmin.metrics.sectionA")} />
        <div className="stf-grid">
          <Stat label={t("investorAdmin.metrics.applicationsReceived")} value={n(A.applicationsReceived)} />
          <Stat label={t("investorAdmin.metrics.approvalRate")} value={pct(A.approvalRate)} />
          <Stat label={t("investorAdmin.metrics.medianDaysToApprove")} value={days(A.medianDaysToApprove)} />
          <Stat label={t("investorAdmin.metrics.activationRate")} value={pct(A.activationRate)} />
          <Stat label={t("investorAdmin.metrics.medianDaysToActivate")} value={days(A.medianDaysToActivate)} />
          <Stat label={t("investorAdmin.metrics.activeInvestors")} value={n(A.activeInvestors)} />
          <Stat label={t("investorAdmin.metrics.invitationSent")} value={n(A.invitationSent)} />
          <Stat label={t("investorAdmin.metrics.invitationSubmitRate")} value={pct(A.invitationSubmitRate)} />
        </div>
      </section>

      <section className="stf-sec">
        <SectionHead letter="B" tone="b" icon={Rocket} title={t("investorAdmin.metrics.sectionB")} />
        <div className="stf-grid">
          <Stat label={t("investorAdmin.metrics.liveEntries")} value={n(B.liveEntries)} />
          <Stat label={t("investorAdmin.metrics.liveTargetTotal")} value={n(B.liveTargetTotal)} />
          <Stat label={t("investorAdmin.metrics.medianDaysInDealFlow")} value={days(B.medianDaysInDealFlow)} />
          <Stat label={t("investorAdmin.metrics.deckReadiness")} value={pct(B.deckReadiness)} />
          <Stat label={t("investorAdmin.metrics.raiseSuccessRate")} value={pct(B.raiseSuccessRate)} />
        </div>
      </section>

      <section className="stf-sec">
        <SectionHead letter="C" tone="o" icon={TrendingUp} title={t("investorAdmin.metrics.sectionC")} />
        <div className="stf-grid">
          <Stat label={t("investorAdmin.metrics.ventureViews")} value={n(C.ventureViews)} />
          <Stat label={t("investorAdmin.metrics.deckOpenRate")} value={pct(C.deckOpenRate)} />
          <Stat label={t("investorAdmin.metrics.interestRate")} value={pct(C.interestRate)} />
          <Stat label={t("investorAdmin.metrics.watchlistAdds")} value={n(C.watchlistAdds)} />
        </div>
      </section>

      <section className="stf-sec">
        <SectionHead letter="D" tone="b" icon={Calendar} title={t("investorAdmin.metrics.sectionD")} />
        <div className="stf-grid">
          <Stat label={t("investorAdmin.metrics.introRequests")} value={n(D.introRequests)} />
          <Stat label={t("investorAdmin.metrics.introApprovalRate")} value={pct(D.introApprovalRate)} />
          <Stat label={t("investorAdmin.metrics.medianHoursToDecide")} value={hours(D.medianHoursToDecide)} />
          <Stat label={t("investorAdmin.metrics.meetingsHeld")} value={n(D.meetingsHeld)} />
          <Stat label={t("investorAdmin.metrics.noShowRate")} value={pct(D.noShowRate)} />
          <Stat label={t("investorAdmin.metrics.medianHoursToSchedule")} value={hours(D.medianHoursToSchedule)} />
          <Stat label={t("investorAdmin.metrics.medianDaysRequestToMeeting")} value={days(D.medianDaysRequestToMeeting)} />
          <Stat label={t("investorAdmin.metrics.rescheduleRate")} value={pct(D.rescheduleRate)} />
          <Stat label={t("investorAdmin.metrics.introToDiligenceRate")} value={pct(D.introToDiligenceRate)} />
          <Stat label={t("investorAdmin.metrics.introBacklog")} value={n(D.introBacklog)} />
        </div>
      </section>

      <section className="stf-sec">
        <SectionHead letter="E" tone="o" icon={BarChart3} title={t("investorAdmin.metrics.sectionE")} />
        <div className="stf-grid">
          <Stat label={t("investorAdmin.metrics.pairs")} value={n(E.pairs)} />
          <Stat label={t("investorAdmin.metrics.investedPairs")} value={n(E.investedPairs)} />
          <Stat label={t("investorAdmin.metrics.interestToInvestment")} value={pct(E.interestToInvestment)} />
          <Stat label={t("investorAdmin.metrics.investments")} value={n(E.investments)} />
          <Stat label={t("investorAdmin.metrics.investedTotal")} value={n(E.investedTotal)} />
          <Stat label={t("investorAdmin.metrics.averageTicket")} value={n(E.averageTicket)} />
          <Stat label={t("investorAdmin.metrics.medianDaysToClose")} value={days(E.medianDaysToClose)} />
        </div>

        {E.stepConversion && Object.keys(E.stepConversion).length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div className="stf-small" style={{ fontWeight: 700 }}>
              {t("investorAdmin.metrics.stepConversion")}
            </div>
            {Object.entries(E.stepConversion).map(([step, value]) => (
              <div key={step} className="stf-small">
                {step}: {pct(value)}
              </div>
            ))}
          </div>
        )}

        {(E.timeInStage || []).length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div className="stf-small" style={{ fontWeight: 700 }}>
              {t("investorAdmin.metrics.timeInStage")}
            </div>
            {(E.timeInStage || []).map((row) => (
              <div key={row.stage} className="stf-small">
                {row.stage}: {row.medianDays == null ? "—" : `${Number(row.medianDays).toFixed(1)}d`} ({row.pairs})
              </div>
            ))}
          </div>
        )}

        {(E.lossReasons || []).length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div className="stf-small" style={{ fontWeight: 700 }}>
              {t("investorAdmin.metrics.lossReasons")}
            </div>
            {(E.lossReasons || []).map((row) => (
              <div key={row.reason} className="stf-small">
                {row.reason}: {row.count}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="stf-sec">
        <SectionHead letter="F" tone="b" icon={DollarSign} title={t("investorAdmin.metrics.sectionF")} />
        <div className="stf-grid">
          <Stat label={t("investorAdmin.metrics.financingEvents")} value={n(F.financingEvents)} />
          <Stat label={t("investorAdmin.metrics.outsideCapital")} value={n(F.outsideCapital)} />
        </div>
        <p className="stf-small" style={{ marginTop: 8 }}>
          {t("investorAdmin.metrics.fNote")}
        </p>
      </section>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useDialogs } from "@/components/ui/DialogProvider";
import AppCard from "@/components/ui/AppCard";
import AppButton from "@/components/ui/AppButton";
import AppBadge from "@/components/ui/AppBadge";
import SectionHead from "@/components/ui/SectionHead";

/**
 * THE STAGE CARD — the same component for the founder and for the studio.
 *
 * The founder sees where they are, how far the next stage is, and exactly what
 * is missing. The studio (`canDecide`) additionally gets Propose / Approve /
 * Reject. One component, one source of truth: a founder and a reviewer can
 * never be told different things about the same venture.
 *
 * "Missing" is shown as its own state on purpose — a criterion that cannot be
 * judged is not a failure (spec §4.3).
 */

const STATUS_VARIANT = {
  met: "success",
  not_met: "danger",
  missing: "warning",
};

/** The traffic light reuses the same badges, with its own vocabulary. */
const LIGHT_VARIANT = {
  green: "success",
  amber: "warning",
  red: "danger",
  unknown: "default",
};

async function api(path, options) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  return { ok: response.ok, payload };
}

export default function VentureStageCard({ ventureId, canDecide = false }) {
  const { t } = useI18n();
  const { prompt } = useDialogs();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const base = `/api/ventures/${encodeURIComponent(ventureId)}/reporting/stage`;

  const load = useCallback(async () => {
    setLoading(true);
    const result = await api(base);
    if (result.ok) setStatus(result.payload);
    else setError(result.payload.error || "errors.somethingWrong");
    setLoading(false);
  }, [base]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (action, reason) => {
    setBusy(true);
    setError(null);
    const result = await api(base, { method: "POST", body: JSON.stringify({ action, reason }) });
    setBusy(false);
    if (!result.ok) {
      setError((result.payload.errors || [result.payload.error])[0] || "errors.somethingWrong");
      return;
    }
    await load();
  };

  const reject = async () => {
    const reason = await prompt({
      message: t("venture.reporting.stage.validation.reason"),
      tone: "danger",
      required: true,
      confirmLabel: t("venture.reporting.stage.action.reject"),
      cancelLabel: t("common.cancel"),
    });
    if (!reason) return;
    await act("reject", reason);
  };

  if (loading) return <AppCard>{t("common.loading")}</AppCard>;
  if (!status) {
    return (
      <div className="space-y-4">
        <SectionHead
          title={t("venture.reporting.stage.title")}
          subtitle={t("venture.reporting.stage.subtitle")}
        />
        <AppCard padding="normal" className="text-center py-8">
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {t("venture.reporting.stage.history")} - {t("status.pending")}
          </p>
        </AppCard>
      </div>
    );
  }

  const percent = Math.round((status.progress || 0) * 100);
  const pending = status.pendingProposal;

  return (
    <div className="space-y-4">
      <SectionHead
        title={t("venture.reporting.stage.title")}
        subtitle={t("venture.reporting.stage.subtitle")}
      />

      <AppCard padding="normal" className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <AppBadge variant="brand" dot>
            {t("venture.reporting.stage.current")}:{" "}
            {t(`venture.reporting.stage.name.${status.currentStage}`)}
          </AppBadge>
          {status.nextStage && (
            <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
              {t("venture.reporting.stage.next")}:{" "}
              {t(`venture.reporting.stage.name.${status.nextStage}`)} · {percent}%
            </span>
          )}
        </div>

        {status.trafficLight && (
          <div className="flex flex-wrap items-center gap-2">
            <AppBadge variant={LIGHT_VARIANT[status.trafficLight.overall] || "default"} dot>
              {t("venture.reporting.traffic.overall")}:{" "}
              {t(`venture.reporting.traffic.status.${status.trafficLight.overall}`)}
            </AppBadge>
            {status.trafficLight.dimensions.map((dimension) => (
              <span
                key={dimension.key}
                className="text-[11px]"
                style={{ color: "var(--text-secondary)" }}
              >
                {t(`venture.reporting.traffic.dimension.${dimension.key}`)}:{" "}
                {t(`venture.reporting.traffic.status.${dimension.status}`)}
              </span>
            ))}
          </div>
        )}

        {status.reviewFlag?.flagged && (
          <p className="text-xs font-bold text-rose-500">
            {t("venture.reporting.stage.review.flagged", {
              months: status.reviewFlag.threshold,
            })}
          </p>
        )}
        {status.reviewFlag?.applicable && !status.reviewFlag.flagged && (
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {t("venture.reporting.stage.review.ok")}
          </p>
        )}

        {!status.nextStage ? (
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {t("venture.reporting.stage.maxStage")}
          </p>
        ) : (
          <>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {t("venture.reporting.stage.progress", {
                stage: t(`venture.reporting.stage.name.${status.nextStage}`),
              })}
              : {status.met}/{status.total}
            </p>

            <ul className="space-y-2">
              {status.criteria.map((criterion) => (
                <li
                  key={criterion.key}
                  className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 last:border-0"
                  style={{ borderColor: "var(--border-primary)" }}
                >
                  <span className="text-[12px]" style={{ color: "var(--text-primary)" }}>
                    {t(`venture.reporting.stage.criterion.${criterion.key}`, {
                      months: criterion.months ?? 3,
                    })}
                  </span>
                  <span className="flex items-center gap-3">
                    {criterion.expected !== undefined && (
                      <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                        {Array.isArray(criterion.actual)
                          ? criterion.actual.join(" / ")
                          : criterion.actual ?? "—"}{" "}
                        / {criterion.expected}
                      </span>
                    )}
                    <AppBadge variant={STATUS_VARIANT[criterion.status] || "default"}>
                      {t(`venture.reporting.stage.status.${criterion.status}`)}
                    </AppBadge>
                  </span>
                </li>
              ))}
            </ul>

            {status.missing > 0 && (
              <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                {t("venture.reporting.stage.missingCount", { count: status.missing })}
              </p>
            )}
          </>
        )}

        {error && <p className="text-xs text-rose-500">{t(error)}</p>}

        {canDecide && (
          <div className="flex flex-wrap gap-2 border-t pt-3" style={{ borderColor: "var(--border-primary)" }}>
            {pending ? (
              <>
                <span className="text-[11px] font-bold" style={{ color: "var(--text-secondary)" }}>
                  {t("venture.reporting.stage.pending", {
                    stage: t(`venture.reporting.stage.name.${pending.toStage}`),
                  })}
                </span>
                <AppButton onClick={() => act("approve")} disabled={busy}>
                  {t("venture.reporting.stage.action.approve")}
                </AppButton>
                <AppButton variant="danger" onClick={reject} disabled={busy}>
                  {t("venture.reporting.stage.action.reject")}
                </AppButton>
              </>
            ) : (
              <AppButton
                variant="secondary"
                onClick={() => act("propose")}
                disabled={busy || !status.eligible}
              >
                {t("venture.reporting.stage.action.propose")}
              </AppButton>
            )}
          </div>
        )}

        {status.history?.length > 0 && (
          <div className="space-y-1 border-t pt-3" style={{ borderColor: "var(--border-primary)" }}>
            <p
              className="text-[10px] font-bold uppercase tracking-wider"
              style={{ color: "var(--text-secondary)" }}
            >
              {t("venture.reporting.stage.history")}
            </p>
            <ul className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
              {status.history.map((entry, index) => (
                <li key={`${entry.decidedAt}-${index}`}>
                  {entry.fromStage
                    ? `${t(`venture.reporting.stage.name.${entry.fromStage}`)} → `
                    : ""}
                  {t(`venture.reporting.stage.name.${entry.toStage}`)}
                  {entry.decidedAt ? ` · ${String(entry.decidedAt).slice(0, 10)}` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
      </AppCard>
    </div>
  );
}

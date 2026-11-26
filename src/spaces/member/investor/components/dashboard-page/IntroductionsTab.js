"use client";

import { useState } from "react";
import { RotateCw } from "lucide-react";
import AppButton from "@/components/ui/AppButton";
import AppEmptyState from "@/components/ui/AppEmptyState";
import AppStatusBadge from "@/components/ui/AppStatusBadge";
import { useApi } from "@/lib/hooks/useApi";
import { useI18n } from "@/lib/i18n";

const EMPTY_REQUESTS = [];
const pickRequests = (payload) => payload?.success && Array.isArray(payload.requests)
  ? payload.requests : EMPTY_REQUESTS;

const STATUS_KEYS = {
  submitted: "requestSent",
  under_review: "underReview",
  approved: "approved",
  declined: "declined",
  withdrawn: "withdrawn",
};

export default function IntroductionsTab({ onMessage }) {
  const { t, lang } = useI18n();
  const { data: requests, loading, error, refresh } = useApi("/api/investor/introductions", {
    defaultValue: EMPTY_REQUESTS,
    transform: pickRequests,
  });
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);

  const withdraw = async (request) => {
    setBusyId(request.id);
    setActionError(null);
    try {
      const response = await fetch("/api/investor/introductions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: request.id, action: "withdraw" }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "errors.somethingWrong");
      }
      refresh();
    } catch (requestError) {
      setActionError(requestError.message);
    } finally {
      setBusyId(null);
    }
  };

  if (loading && requests.length === 0) {
    return <div className="space-y-3" aria-label={t("common.loading")} aria-busy="true">
      {[0, 1, 2].map((item) => <div key={item} className="stf-card h-24 animate-pulse" />)}
    </div>;
  }

  if (error && requests.length === 0) {
    return (
      <div className="stf-card space-y-3" role="alert">
        <p className="stf-small">{t("dashboardV2.loadError")}</p>
        <AppButton variant="secondary" icon={RotateCw} onClick={refresh}>
          {t("dashboardV2.retry")}
        </AppButton>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <AppEmptyState
        title={t("dashboardV2.noIntroductions")}
        description={t("dashboardV2.noIntroductionsHint")}
      />
    );
  }

  return (
    <div className="space-y-3">
      {actionError && <p className="stf-small text-rose-500" role="alert">{t(actionError)}</p>}
      {requests.map((request) => (
        <article className="stf-card flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between" key={request.id}>
          <div className="min-w-0 space-y-2">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">
              {request.venture_name || request.venture_id}
            </h3>
            <p className="stf-small">{t("dashboardV2.requestedOn", {
              date: request.requested_at ? new Date(request.requested_at).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US") : "—",
            })}</p>
            {request.message && <p className="stf-small break-words">{request.message}</p>}
            {request.status === "declined" && request.decline_reason && (
              <p className="stf-small">{t("dashboardV2.reason")}: {request.decline_reason}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <AppStatusBadge status={request.status} label={t(`dashboardV2.status.${STATUS_KEYS[request.status] || "requestSent"}`)} />
            {request.status === "approved" && onMessage && (
              <AppButton size="sm" variant="secondary" onClick={() => onMessage(request)}>
                {t("dashboardV2.message")}
              </AppButton>
            )}
            {["submitted", "under_review"].includes(request.status) && (
              <AppButton
                size="sm"
                variant="secondary"
                loading={busyId === request.id}
                disabled={busyId !== null}
                onClick={() => withdraw(request)}
              >
                {t("dashboardV2.withdraw")}
              </AppButton>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

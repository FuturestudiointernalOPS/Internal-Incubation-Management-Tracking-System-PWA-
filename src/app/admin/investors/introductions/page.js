"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import { useDialogs } from "@/components/ui/DialogProvider";
import AppButton from "@/components/ui/AppButton";

const pickRequests = (payload) => (payload?.success ? payload.requests || [] : []);
const EMPTY = [];

const ACTIONS = {
  start_review: { confirm: "reviewConfirm", done: "reviewStarted" },
  approve: { confirm: "approveConfirm", done: "approvedDone" },
  decline: { confirm: "declineConfirm", done: "declinedDone" },
};

/**
 * /admin/investors/introductions
 *
 * The studio review queue. Approving requires the pair to already be on the
 * pipeline; it creates (or reopens) the relationship workspace and notifies the
 * investor. Every decision is confirmed and acknowledged; a decline needs a
 * reason.
 */
export default function IntroductionsAdminPage() {
  const { t, lang } = useI18n();
  const { confirm, prompt, alert } = useDialogs();
  const { data: requests, loading, refresh } = useApi("/api/admin/investors/introductions", {
    defaultValue: EMPTY,
    transform: pickRequests,
  });
  const [busyId, setBusyId] = useState(null);

  const act = async (request, action) => {
    let reason = null;
    let internalNote = null;
    if (action === "decline") {
      reason = await prompt({
        message: t("investorAdmin.introductions.declineReason"),
        required: true,
        inputLabel: t("investorAdmin.introductions.declineReasonLabel"),
        validate: (value) =>
          String(value || "").trim() ? null : t("investorAdmin.introductions.declineRequired"),
      });
      if (!reason) return;
    }
    if (action === "approve" || action === "decline") {
      internalNote = await prompt({
        message: t("investorAdmin.introductions.internalNote"),
        inputLabel: t("investorAdmin.introductions.internalNoteLabel"),
        placeholder: t("investorAdmin.introductions.internalNotePlaceholder"),
      });
      if (internalNote === null) return;
    }

    const meta = ACTIONS[action];
    if (!(await confirm({ message: t(`investorAdmin.introductions.${meta.confirm}`) }))) return;

    setBusyId(`${request.id}-${action}`);
    try {
      const response = await fetch("/api/admin/investors/introductions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: request.id, action, reason, internal_note: internalNote || null }),
      });
      const json = await response.json();
      if (!json.success) throw new Error(json.error || "Failed");
      refresh();
      await alert({ message: t(`investorAdmin.introductions.${meta.done}`) });
    } catch (error) {
      await alert({ message: error.message });
    } finally {
      setBusyId(null);
    }
  };

  if (loading && requests.length === 0) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--brand-orange)]" />
      </div>
    );
  }

  return (
    <div className="stf" style={{ paddingBottom: 60 }}>
      <div className="stf-head">
        <div>
          <h1 className="stf-title">{t("investorAdmin.introductions.title")}</h1>
          <p className="stf-sub">{t("investorAdmin.introductions.subtitle")}</p>
        </div>
      </div>

      {requests.length === 0 ? (
        <p className="stf-small">{t("investorAdmin.introductions.empty")}</p>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {requests.map((request) => (
            <div key={request.id} className="stf-card" style={{ padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <b>
                    {request.organization_name || request.investor_email || t("investorAdmin.introductions.investor")}
                    {" → "}
                    {request.venture_name || request.venture_id}
                  </b>
                  {request.investor_email && request.organization_name && (
                    <div className="stf-small">{request.investor_email}</div>
                  )}
                  <div className="stf-small">{request.message || t("investorAdmin.introductions.noMessage")}</div>
                  <div className="stf-small">
                    {request.requested_at ? new Date(request.requested_at).toLocaleString(lang === "fr" ? "fr-FR" : "en-US") : t("investorAdmin.introductions.unknownDate")}
                  </div>
                </div>
                <span className="stf-tag">{t(`dashboardV2.status.${request.status === "submitted" ? "requestSent" : request.status === "under_review" ? "underReview" : request.status}`)}</span>
              </div>

              {["submitted", "under_review"].includes(request.status) && (
                <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  {request.status === "submitted" && (
                    <AppButton
                      variant="secondary"
                      size="sm"
                      onClick={() => act(request, "start_review")}
                      disabled={busyId === `${request.id}-start_review`}
                    >
                      {t("investorAdmin.introductions.startReview")}
                    </AppButton>
                  )}
                  <AppButton
                    variant="primary"
                    size="sm"
                    onClick={() => act(request, "approve")}
                    disabled={busyId === `${request.id}-approve`}
                  >
                    {t("investorAdmin.introductions.approve")}
                  </AppButton>
                  <AppButton
                    variant="secondary"
                    size="sm"
                    onClick={() => act(request, "decline")}
                    disabled={busyId === `${request.id}-decline`}
                  >
                    {t("investorAdmin.introductions.decline")}
                  </AppButton>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

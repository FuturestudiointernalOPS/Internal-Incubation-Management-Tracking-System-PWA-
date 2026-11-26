"use client";

import { useState } from "react";
import { CalendarClock } from "lucide-react";

import AppButton from "@/components/ui/AppButton";
import { useDialogs } from "@/components/ui/DialogProvider";
import { useApi } from "@/lib/hooks/useApi";
import { useI18n } from "@/lib/i18n";

const EMPTY = [];
const pickWorkspaces = (payload) => payload?.success && Array.isArray(payload.workspaces)
  ? payload.workspaces
  : EMPTY;

export default function MeetingsTab() {
  const { t, lang } = useI18n();
  const { confirm } = useDialogs();
  const { data: workspaces, loading, refresh } = useApi("/api/investor/meetings/slots", {
    defaultValue: EMPTY,
    transform: pickWorkspaces,
  });
  const [busyId, setBusyId] = useState(null);
  const [startValues, setStartValues] = useState({});
  const [actionError, setActionError] = useState(null);
  const [actionNotice, setActionNotice] = useState(null);
  const [rescheduleValues, setRescheduleValues] = useState({});
  const [feedbackValues, setFeedbackValues] = useState({});

  const act = async (workspace, body, method = "POST") => {
    setBusyId(workspace.id);
    setActionError(null);
    setActionNotice(null);
    try {
      const response = await fetch("/api/investor/meetings/slots", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: workspace.id, ...body }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "errors.somethingWrong");
      if (result.email_sent === false) setActionNotice(t("investorMisc.meetings.emailFailed"));
      await refresh();
    } catch {
      setActionError(t("investorMisc.meetings.actionFailed"));
    } finally {
      setBusyId(null);
    }
  };

  if (loading && workspaces.length === 0) {
    return <p className="stf-small">{t("common.loading")}</p>;
  }

  if (workspaces.length === 0) {
    return <p className="stf-small">{t("investorMisc.meetings.empty")}</p>;
  }

  return (
    <div className="space-y-4">
      {actionError && <p className="stf-small" role="alert">{actionError}</p>}
      {actionNotice && <p className="stf-small" role="status">{actionNotice}</p>}
      {workspaces.map((workspace) => (
        <article className="stf-card space-y-3" key={workspace.id}>
          <div>
            <h3 className="font-bold text-[var(--text-primary)]">
              {workspace.venture_name || t("investorMisc.meetings.venture")}
            </h3>
          </div>

          {(workspace.meetings || []).map((meeting) => (
            <div className="flex flex-wrap items-center justify-between gap-2" key={meeting.id}>
              <span className="stf-small">
                {meeting.start_at
                  ? new Date(meeting.start_at).toLocaleString(lang === "fr" ? "fr-FR" : "en-US")
                  : `${meeting.scheduled_date || ""} ${meeting.scheduled_time || ""}`}
                {" · "}
                {t(`investorMisc.meetings.status.${meeting.status}`)}
              </span>
              {meeting.video_link && (
                <a className="stf-btn" href={meeting.video_link} target="_blank" rel="noreferrer">
                  {t("investorMisc.meetings.join")}
                </a>
              )}
              {["confirmed", "scheduled"].includes(meeting.status) && (
                <div className="flex flex-wrap items-end gap-2">
                  <label className="stf-small">
                    {t("investorMisc.meetings.start")}
                    <input
                      type="datetime-local"
                      value={rescheduleValues[meeting.id] || ""}
                      onChange={(event) => setRescheduleValues((values) => ({
                        ...values,
                        [meeting.id]: event.target.value,
                      }))}
                      className="mt-1 block rounded-lg px-3 py-2"
                      style={{ background: "var(--surface-2)", border: "1px solid var(--border-primary)" }}
                    />
                  </label>
                  <AppButton
                    variant="secondary"
                    size="sm"
                    disabled={busyId === workspace.id || !rescheduleValues[meeting.id]}
                    onClick={() => {
                      const startAt = new Date(rescheduleValues[meeting.id]);
                      if (Number.isFinite(startAt.getTime())) {
                        void act(workspace, {
                          action: "reschedule",
                          meeting_id: meeting.id,
                          start_at: startAt.toISOString(),
                          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                        }, "PUT");
                      }
                    }}
                  >
                    {t("investorMisc.meetings.reschedule")}
                  </AppButton>
                  <AppButton
                    variant="danger"
                    size="sm"
                    disabled={busyId === workspace.id}
                    onClick={async () => {
                      if (!(await confirm({
                        message: t("investorMisc.meetings.cancelConfirm"),
                        tone: "danger",
                      }))) return;
                      await act(workspace, { action: "cancel", meeting_id: meeting.id }, "PUT");
                    }}
                  >
                    {t("investorMisc.meetings.cancel")}
                  </AppButton>
                </div>
              )}
              {meeting.status === "held" && (
                meeting.my_feedback ? (
                  <p className="stf-small" role="status">
                    {t("investorMisc.meetings.feedbackSaved")}: {t(`investorMisc.meetings.${meeting.my_feedback.interest === "not_interested" ? "notInterested" : meeting.my_feedback.interest === "need_more_information" ? "needMoreInformation" : "interested"}`)}
                  </p>
                ) : (
                  <div className="grid gap-2 sm:max-w-xl">
                    <p className="stf-small font-semibold">{t("investorMisc.meetings.feedbackTitle")}</p>
                    <select
                      aria-label={t("investorMisc.meetings.feedbackTitle")}
                      value={(feedbackValues[meeting.id] || {}).interest || ""}
                      onChange={(event) => setFeedbackValues((values) => ({
                        ...values,
                        [meeting.id]: { ...(values[meeting.id] || {}), interest: event.target.value },
                      }))}
                      className="rounded-lg px-3 py-2"
                      style={{ background: "var(--surface-2)", border: "1px solid var(--border-primary)" }}
                    >
                      <option value="">{t("common.select")}</option>
                      <option value="interested">{t("investorMisc.meetings.interested")}</option>
                      <option value="not_interested">{t("investorMisc.meetings.notInterested")}</option>
                      <option value="need_more_information">{t("investorMisc.meetings.needMoreInformation")}</option>
                    </select>
                    <label className="stf-small">
                      {t("investorMisc.meetings.feedbackNote")}
                      <textarea
                        maxLength={1000}
                        value={(feedbackValues[meeting.id] || {}).note || ""}
                        onChange={(event) => setFeedbackValues((values) => ({
                          ...values,
                          [meeting.id]: { ...(values[meeting.id] || {}), note: event.target.value },
                        }))}
                        className="mt-1 block w-full rounded-lg px-3 py-2"
                        style={{ background: "var(--surface-2)", border: "1px solid var(--border-primary)" }}
                      />
                    </label>
                    <AppButton
                      variant="primary"
                      size="sm"
                      disabled={busyId === workspace.id || !(feedbackValues[meeting.id] || {}).interest}
                      onClick={() => act(workspace, {
                        action: "feedback",
                        meeting_id: meeting.id,
                        interest: feedbackValues[meeting.id]?.interest,
                        note: feedbackValues[meeting.id]?.note || null,
                      }, "PUT")}
                    >
                      {t("investorMisc.meetings.submitFeedback")}
                    </AppButton>
                  </div>
                )
              )}
            </div>
          ))}

          {(workspace.slots || []).map((slot) => (
            <div className="flex flex-wrap items-center justify-between gap-2" key={slot.id}>
              <span className="stf-small">
                {new Date(slot.start_at).toLocaleString(lang === "fr" ? "fr-FR" : "en-US")}
                {" · "}
                {t(`investorMisc.meetings.status.${slot.status}`)}
              </span>
              {slot.status === "proposed" && slot.proposed_by_type !== "investor" && (
                <AppButton
                  variant="secondary"
                  size="sm"
                  disabled={busyId === workspace.id}
                  onClick={() => act(workspace, { action: "accept", slot_id: slot.id }, "PUT")}
                >
                  {t("investorMisc.meetings.accept")}
                </AppButton>
              )}
            </div>
          ))}

          <div className="flex flex-wrap items-end gap-3">
            <label className="stf-small">
              {t("investorMisc.meetings.start")}
              <input
                type="datetime-local"
                value={startValues[workspace.id] || ""}
                onChange={(event) => setStartValues((values) => ({
                  ...values,
                  [workspace.id]: event.target.value,
                }))}
                className="mt-1 block rounded-lg px-3 py-2"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border-primary)" }}
              />
            </label>
            <AppButton
              variant="primary"
              size="sm"
              icon={CalendarClock}
              disabled={busyId === workspace.id || !startValues[workspace.id]
                || (workspace.slots || []).filter((slot) => slot.status === "proposed").length >= 3}
              onClick={() => {
                const startAt = new Date(startValues[workspace.id]);
                if (!Number.isFinite(startAt.getTime())) {
                  setActionError(t("investorMisc.meetings.actionFailed"));
                  return;
                }
                void act(workspace, {
                  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                  slots: [{ start_at: startAt.toISOString(), duration_minutes: 30 }],
                });
              }}
            >
              {t("investorMisc.meetings.propose")}
            </AppButton>
            {(workspace.slots || []).filter((slot) => slot.status === "proposed").length >= 3 && (
              <p className="stf-small">{t("investorMisc.meetings.slotsLimitReached")}</p>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

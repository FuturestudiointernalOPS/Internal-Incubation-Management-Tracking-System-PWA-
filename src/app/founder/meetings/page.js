"use client";

import { useState } from "react";
import { Calendar, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import AppButton from "@/components/ui/AppButton";
import { useDialogs } from "@/components/ui/DialogProvider";

export const dynamic = "force-dynamic";

const pickWorkspaces = (payload) => (payload?.success ? payload.workspaces || [] : []);
const EMPTY = [];

/**
 * /founder/meetings
 *
 * The founder side of the introduction calendar: propose a time on a shared
 * relationship workspace, or accept one the investor proposed. Times are stored
 * in UTC; the founder's IANA timezone is captured with the proposal.
 */
export default function FounderMeetingsPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { confirm } = useDialogs();
  const { data: workspaces, loading, refresh } = useApi("/api/investor/meetings/slots", {
    defaultValue: EMPTY,
    transform: pickWorkspaces,
  });
  const [forms, setForms] = useState({});
  const [busy, setBusy] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [actionNotice, setActionNotice] = useState(null);

  const setField = (id, field, value) =>
    setForms((previous) => ({ ...previous, [id]: { ...(previous[id] || {}), [field]: value } }));

  const call = async (body, method = "POST") => {
    const response = await fetch("/api/investor/meetings/slots", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await response.json();
    if (!response.ok || !json.success) throw new Error(json.error || "errors.somethingWrong");
    if (json.email_sent === false) setActionNotice(t("investorMisc.meetings.emailFailed"));
    return json;
  };

  const propose = async (workspace) => {
    const form = forms[workspace.id] || {};
    if (!form.start) return;
    setBusy(workspace.id);
    setActionError(null);
    setActionNotice(null);
    try {
      await call({
        workspace_id: workspace.id,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        slots: [{ start_at: new Date(form.start).toISOString(), duration_minutes: Number(form.duration || 30) }],
      });
      refresh();
    } catch (_) {
      setActionError(t("investorMisc.meetings.actionFailed"));
    } finally {
      setBusy(null);
    }
  };

  const accept = async (workspace, slot) => {
    setBusy(workspace.id);
    setActionError(null);
    try {
      await call({ action: "accept", workspace_id: workspace.id, slot_id: slot.id }, "PUT");
      refresh();
    } catch (_) {
      setActionError(t("investorMisc.meetings.actionFailed"));
    } finally {
      setBusy(null);
    }
  };

  if (loading && workspaces.length === 0) {
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
          <h1 className="stf-title">{t("investorMisc.meetings.title")}</h1>
          <p className="stf-sub">{t("investorMisc.meetings.subtitle")}</p>
        </div>
      </div>

      {workspaces.length === 0 ? (
        <p className="stf-small">{t("investorMisc.meetings.empty")}</p>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {workspaces.map((workspace) => (
            <div key={workspace.id} className="stf-card" style={{ padding: 16 }}>
              <b>{workspace.venture_name || `#${workspace.venture_id}`}</b>
              {(workspace.slots || []).length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div className="stf-small" style={{ fontWeight: 700 }}>
                    {t("investorMisc.meetings.slots")}
                  </div>
                  {workspace.slots.map((slot) => (
                    <div
                      key={slot.id}
                      style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 6 }}
                    >
                      <span className="stf-small">
                        {new Date(slot.start_at).toLocaleString()} · {slot.status}
                      </span>
                      {slot.status === "proposed" && (
                        <AppButton variant="primary" size="sm" onClick={() => accept(workspace, slot)}>
                          {t("investorMisc.meetings.accept")}
                        </AppButton>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {(workspace.meetings || []).length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div className="stf-small" style={{ fontWeight: 700 }}>
                    {t("investorMisc.meetings.confirmed")}
                  </div>
                  {workspace.meetings.map((meeting) => (
                      <div key={meeting.id} className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                        <span className="stf-small">
                          {meeting.start_at
                            ? new Date(meeting.start_at).toLocaleString()
                            : `${meeting.scheduled_date || ""} ${meeting.scheduled_time || ""}`}{" "}
                          · {t(`investorMisc.meetings.status.${meeting.status}`)}
                        </span>
                        {["confirmed", "scheduled"].includes(meeting.status) && (
                          <div className="flex flex-wrap items-end gap-2">
                            <label className="stf-small">
                              {t("investorMisc.meetings.start")}
                              <input
                                type="datetime-local"
                                value={(forms[workspace.id] || {})[`reschedule-${meeting.id}`] || ""}
                                onChange={(event) => setField(workspace.id, `reschedule-${meeting.id}`, event.target.value)}
                                className="w-full mt-1 px-3 py-2 rounded-lg"
                                style={{ background: "var(--surface-2)", border: "1px solid var(--border-primary)" }}
                              />
                            </label>
                            <AppButton
                              variant="secondary"
                              size="sm"
                              disabled={busy === workspace.id || !(forms[workspace.id] || {})[`reschedule-${meeting.id}`]}
                              onClick={async () => {
                                setBusy(workspace.id);
                                setActionError(null);
                                setActionNotice(null);
                                try {
                                  const startAt = new Date((forms[workspace.id] || {})[`reschedule-${meeting.id}`]);
                                  if (!Number.isFinite(startAt.getTime())) throw new Error("invalid date");
                                  await call({
                                    action: "reschedule",
                                    meeting_id: meeting.id,
                                    start_at: startAt.toISOString(),
                                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                                  }, "PUT");
                                  refresh();
                                } catch (_) {
                                  setActionError(t("investorMisc.meetings.actionFailed"));
                                } finally {
                                  setBusy(null);
                                }
                              }}
                            >
                              {t("investorMisc.meetings.reschedule")}
                            </AppButton>
                            <AppButton
                              variant="danger"
                              size="sm"
                              disabled={busy === workspace.id}
                              onClick={async () => {
                                if (!(await confirm({
                                  message: t("investorMisc.meetings.cancelConfirm"),
                                  tone: "danger",
                                }))) return;
                                setBusy(workspace.id);
                                setActionError(null);
                                setActionNotice(null);
                                try {
                                  await call({ action: "cancel", meeting_id: meeting.id }, "PUT");
                                  refresh();
                                } catch (_) {
                                  setActionError(t("investorMisc.meetings.actionFailed"));
                                } finally {
                                  setBusy(null);
                                }
                              }}
                            >
                              {t("investorMisc.meetings.cancel")}
                            </AppButton>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )}

              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", alignItems: "end" }}>
                <AppButton
                  variant="secondary"
                  size="sm"
                  onClick={() => router.push(`/founder/messages/${encodeURIComponent(workspace.id)}`)}
                >
                  {t("investorMisc.workspaceMessages.open")}
                </AppButton>
                <label className="stf-small">
                  {t("investorMisc.meetings.start")}
                  <input
                    type="datetime-local"
                    value={(forms[workspace.id] || {}).start || ""}
                    onChange={(event) => setField(workspace.id, "start", event.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-lg"
                    style={{ background: "var(--surface-2)", border: "1px solid var(--border-primary)" }}
                  />
                </label>
                <label className="stf-small">
                  {t("investorMisc.meetings.duration")}
                  <input
                    type="number"
                    min="15"
                    step="15"
                    value={(forms[workspace.id] || {}).duration || 30}
                    onChange={(event) => setField(workspace.id, "duration", event.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-lg"
                    style={{ background: "var(--surface-2)", border: "1px solid var(--border-primary)" }}
                  />
                </label>
                <AppButton
                  variant="primary"
                  size="sm"
                  icon={Calendar}
                  onClick={() => propose(workspace)}
                  disabled={busy === workspace.id
                    || (workspace.slots || []).filter((slot) => slot.status === "proposed").length >= 3}
                >
                  {t("investorMisc.meetings.propose")}
                </AppButton>
                {(workspace.slots || []).filter((slot) => slot.status === "proposed").length >= 3 && (
                  <p className="stf-small">{t("investorMisc.meetings.slotsLimitReached")}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {actionError && <p className="stf-small" role="alert">{actionError}</p>}
      {actionNotice && <p className="stf-small" role="status">{actionNotice}</p>}
    </div>
  );
}

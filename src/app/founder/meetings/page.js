"use client";

import { useState } from "react";
import { Calendar, Loader2 } from "lucide-react";

import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import AppButton from "@/components/ui/AppButton";

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
  const { t } = useI18n();
  const { data: workspaces, loading, refresh } = useApi("/api/investor/meetings/slots", {
    defaultValue: EMPTY,
    transform: pickWorkspaces,
  });
  const [forms, setForms] = useState({});
  const [busy, setBusy] = useState(null);

  const setField = (id, field, value) =>
    setForms((previous) => ({ ...previous, [id]: { ...(previous[id] || {}), [field]: value } }));

  const call = async (body, method = "POST") => {
    const response = await fetch("/api/investor/meetings/slots", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await response.json();
    if (!json.success) throw new Error(json.error || "Failed");
    return json;
  };

  const propose = async (workspace) => {
    const form = forms[workspace.id] || {};
    if (!form.start) return;
    setBusy(workspace.id);
    try {
      await call({
        workspace_id: workspace.id,
        proposer_type: "founder",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        slots: [{ start_at: new Date(form.start).toISOString(), duration_minutes: Number(form.duration || 30) }],
      });
      refresh();
    } catch (_) {
    } finally {
      setBusy(null);
    }
  };

  const accept = async (workspace, slot) => {
    setBusy(workspace.id);
    try {
      await call({ action: "accept", workspace_id: workspace.id, slot_id: slot.id }, "PUT");
      refresh();
    } catch (_) {
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
              <div className="stf-small">
                {t("investorMisc.meetings.investor")}: {workspace.investor_id}
              </div>

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
                    <div key={meeting.id} className="stf-small">
                      {meeting.start_at
                        ? new Date(meeting.start_at).toLocaleString()
                        : `${meeting.scheduled_date || ""} ${meeting.scheduled_time || ""}`}{" "}
                      · {meeting.status}
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", alignItems: "end" }}>
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
                  disabled={busy === workspace.id}
                >
                  {t("investorMisc.meetings.propose")}
                </AppButton>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import React, { useState } from "react";
import { useI18n } from "@/lib/i18n";
import {
  Shield,
  AlertTriangle,
  Monitor,
  CheckCircle2,
  XCircle,
  Loader2,
  Activity,
} from "lucide-react";
import { useApi } from "@/lib/hooks/useApi";
import { formatDate } from "@/components/admin/security/constants";
import SecurityHeader from "@/components/admin/security/SecurityHeader";
import SecurityTabs from "@/components/admin/security/SecurityTabs";
import SecurityOverviewTab from "@/components/admin/security/SecurityOverviewTab";
import SecuritySessionsTab from "@/components/admin/security/SecuritySessionsTab";
import SecurityEventsTab from "@/components/admin/security/SecurityEventsTab";
import SecurityConfirmDialog from "@/components/admin/security/SecurityConfirmDialog";

// Module scope on purpose: the hook keys its internal callback on these
// functions, so inline arrows would give them a new identity on every render and
// refetch in a loop. The four summary reads keep their payload because the
// summary combines parts of each; a failed one reports null, which is what keeps
// the summary from being assembled out of a half-failed set.
const pickPayload = (payload) => (payload?.success ? payload : null);
const pickSessions = (payload) => (payload?.success ? payload.sessions || [] : []);
const pickEvents = (payload) => (payload?.success ? payload.events || [] : []);
const pickLoginHistory = (payload) => (payload?.success ? payload.history || [] : []);

// Login-history rows carry MACHINE CODES, never prose. They are rendered through
// t() so the console shows translated labels instead of a raw enum (i18n rule).
const LOGIN_ACTION_KEYS = {
  login_success: "adminMisc.security.actionLoginSuccess",
  team_login_success: "adminMisc.security.actionTeamLoginSuccess",
  family_login_success: "adminMisc.security.actionFamilyLoginSuccess",
  login_failed: "adminMisc.security.actionLoginFailed",
};
const LOGIN_FAILURE_KEYS = {
  invalid_credentials: "adminMisc.security.failureInvalidCredentials",
  account_inactive: "adminMisc.security.failureAccountInactive",
  account_pending: "adminMisc.security.failureAccountPending",
  account_archived: "adminMisc.security.failureAccountArchived",
  account_not_active: "adminMisc.security.failureAccountNotActive",
  rate_limited: "adminMisc.security.failureRateLimited",
};

// The seven reads this console needs, at module scope for the same reason as the
// transformations above.
const SUMMARY_SESSIONS_URL = "/api/security/sessions?limit=10";
const SUMMARY_EVENTS_URL = "/api/security/events?type=stats&hours=24";
const SUMMARY_LOGINS_URL = "/api/security/login-history?type=stats&hours=24";
const SUMMARY_AUDIT_URL = "/api/audit-logs?type=stats&hours=24";
const SESSIONS_URL = "/api/security/sessions?limit=50";
const EVENTS_URL = "/api/security/events?limit=50";
const LOGIN_HISTORY_URL = "/api/security/login-history?limit=50";

export default function SecurityPage() {
  const { t } = useI18n();

  // Render a login-history code as a translated label; a code with no mapping
  // (e.g. a row written before these codes existed) degrades to a humanised form.
  const loginActionLabel = (action) =>
    LOGIN_ACTION_KEYS[action] ? t(LOGIN_ACTION_KEYS[action]) : (action || "").replace(/_/g, " ");
  const loginFailureLabel = (reason) =>
    LOGIN_FAILURE_KEYS[reason] ? t(LOGIN_FAILURE_KEYS[reason]) : (reason || t("adminMisc.security.failed"));

  const [activeTab, setActiveTab] = useState("overview");

  // Confirm dialog
  const [confirmAction, setConfirmAction] = useState(null);

  // Every loader's work — cache-first paint, discarding a stale response, the
  // background refresh — belongs to the hook, so the screen keeps no data state
  // of its own and never sets state from an effect. The summary used to be
  // written by combining four responses; it is derived from them instead, and
  // stays absent until all four have answered, which is what the old loader did
  // by applying only when every response succeeded.
  const {
    data: summarySessions,
    loading: summarySessionsLoading,
    refresh: refreshSummarySessions,
  } = useApi(SUMMARY_SESSIONS_URL, { transform: pickPayload });
  const {
    data: summaryEvents,
    loading: summaryEventsLoading,
    refresh: refreshSummaryEvents,
  } = useApi(SUMMARY_EVENTS_URL, { transform: pickPayload });
  const {
    data: summaryLogins,
    loading: summaryLoginsLoading,
    refresh: refreshSummaryLogins,
  } = useApi(SUMMARY_LOGINS_URL, { transform: pickPayload });
  const {
    data: summaryAudit,
    loading: summaryAuditLoading,
    refresh: refreshSummaryAudit,
  } = useApi(SUMMARY_AUDIT_URL, { transform: pickPayload });
  const {
    data: sessions,
    loading: sessionsLoading,
    setData: setSessions,
    refresh: refreshSessions,
  } = useApi(SESSIONS_URL, { defaultValue: [], transform: pickSessions });
  const {
    data: events,
    loading: eventsLoading,
    refresh: refreshEvents,
  } = useApi(EVENTS_URL, { defaultValue: [], transform: pickEvents });
  const {
    data: loginHistory,
    loading: loginLoading,
    refresh: refreshLoginHistory,
  } = useApi(LOGIN_HISTORY_URL, { defaultValue: [], transform: pickLoginHistory });

  const loading =
    summarySessionsLoading ||
    summaryEventsLoading ||
    summaryLoginsLoading ||
    summaryAuditLoading ||
    sessionsLoading ||
    eventsLoading ||
    loginLoading;

  const summary =
    summarySessions && summaryEvents && summaryLogins && summaryAudit
      ? {
          active_sessions: summarySessions.sessions?.length || 0,
          ...summaryEvents,
          ...summaryLogins,
          audit_total: summaryAudit.total || summaryAudit.audit_logs_24h || 0,
        }
      : null;

  // The refresh button re-reads all seven, as the old single loader did.
  const refreshAll = () => {
    refreshSummarySessions();
    refreshSummaryEvents();
    refreshSummaryLogins();
    refreshSummaryAudit();
    refreshSessions();
    refreshEvents();
    refreshLoginHistory();
  };

  const handleRevokeSession = async (token) => {
    try {
      const response = await fetch("/api/security/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke", session_token: token }),
      });
      const data = await response.json();
      if (data.success) {
        setSessions((prev) => prev.filter((session) => session.token !== token));
        setConfirmAction(null);
      }
    } catch (error) {
      console.error("Revoke error:", error);
    }
  };

  const handleResolveEvent = async (eventId) => {
    try {
      const response = await fetch("/api/security/events", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resolve", event_id: eventId, resolution_notes: "Reviewed and resolved" }),
      });
      const data = await response.json();
      if (data.success) {
        refreshEvents();
        setConfirmAction(null);
      }
    } catch (error) {
      console.error("Resolve error:", error);
    }
  };

  const tabs = [
    { id: "overview", label: t("adminMisc.security.tabOverview"), icon: Shield },
    { id: "sessions", label: t("adminMisc.security.tabSessions"), icon: Monitor },
    { id: "events", label: t("adminMisc.security.tabEvents"), icon: AlertTriangle },
    { id: "login_history", label: t("adminMisc.security.tabLoginHistory"), icon: Activity },
  ];

  return (
    <>
      <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] p-6">
        <SecurityHeader t={t} onRefresh={refreshAll} />

        <SecurityTabs tabs={tabs} activeTab={activeTab} onSelect={setActiveTab} />

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-[var(--brand-orange)]" size={32} />
          </div>
        )}

        {/* The failure banner that stood here was unreachable: each of the four
            loaders swallowed its own error, so the promise combining them could
            never reject and this message could never be set. A read that fails
            now leaves its own list empty, which is what the screen already did
            in practice. */}

        {/* ─── OVERVIEW TAB ──────────────────────────────────────────────── */}
        {!loading && activeTab === "overview" && (
          <SecurityOverviewTab
            t={t}
            summary={summary}
            events={events}
            loginHistory={loginHistory}
            loginActionLabel={loginActionLabel}
          />
        )}

        {/* ─── SESSIONS TAB ──────────────────────────────────────────────── */}
        {!loading && activeTab === "sessions" && (
          <SecuritySessionsTab
            t={t}
            sessionsLoading={sessionsLoading}
            sessions={sessions}
            setConfirmAction={setConfirmAction}
          />
        )}

        {/* ─── SECURITY EVENTS TAB ───────────────────────────────────────── */}
        {!loading && activeTab === "events" && (
          <SecurityEventsTab
            t={t}
            eventsLoading={eventsLoading}
            events={events}
            setConfirmAction={setConfirmAction}
          />
        )}

        {/* ─── LOGIN HISTORY TAB ─────────────────────────────────────────── */}
        {!loading && activeTab === "login_history" && (
          <div>
            {loginLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="animate-spin text-[var(--brand-orange)]" size={24} /></div>
            ) : loginHistory.length === 0 ? (
              <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl p-12 text-center">
                <Activity className="mx-auto mb-3 text-[var(--text-secondary)]" size={40} />
                <p className="text-[var(--text-secondary)]">{t("adminMisc.security.noLoginHistory")}</p>
              </div>
            ) : (
              <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[var(--border-primary)]">
                        <th className="text-left p-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("adminMisc.security.colTimestamp")}</th>
                        <th className="text-left p-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("adminMisc.security.colUser")}</th>
                        <th className="text-left p-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("adminMisc.security.colAction")}</th>
                        <th className="text-left p-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("adminMisc.security.colDeviceBrowser")}</th>
                        <th className="text-left p-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("adminMisc.security.colIpLocation")}</th>
                        <th className="text-left p-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("adminMisc.security.colStatus")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loginHistory.map((loginEntry) => (
                        <tr key={loginEntry.id} className="border-b border-[var(--border-secondary)] hover:bg-[var(--surface-2)]">
                          <td className="p-4 text-sm text-[var(--text-secondary)] whitespace-nowrap">{formatDate(loginEntry.created_at)}</td>
                          <td className="p-4">
                            <p className="text-sm text-[var(--text-primary)]">{loginEntry.user_name || loginEntry.user_cid || t("adminMisc.security.unknown")}</p>
                            {loginEntry.user_email && <p className="text-xs text-[var(--text-secondary)]">{loginEntry.user_email}</p>}
                          </td>
                          <td className="p-4">
                            <span className="text-sm text-[var(--text-primary)]">{loginActionLabel(loginEntry.action)}</span>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              {loginEntry.browser && <span className="text-xs text-[var(--text-secondary)]">{loginEntry.browser}</span>}
                              {loginEntry.os && <span className="text-xs text-[var(--text-secondary)]">{loginEntry.os}</span>}
                              {loginEntry.device && <span className="text-xs text-[var(--text-secondary)]">({loginEntry.device})</span>}
                            </div>
                          </td>
                          <td className="p-4">
                            {loginEntry.ip_address && <p className="text-sm font-mono text-[var(--text-primary)]">{loginEntry.ip_address}</p>}
                            {loginEntry.country && <p className="text-xs text-[var(--text-secondary)]">{loginEntry.country}</p>}
                          </td>
                          <td className="p-4">
                            <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full ${
                              loginEntry.is_success ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                            }`}>
                              {loginEntry.is_success ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                              {loginEntry.is_success ? t("adminMisc.security.success") : loginFailureLabel(loginEntry.failure_reason)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Confirmation Dialog */}
        {confirmAction && (
          <SecurityConfirmDialog
            t={t}
            confirmAction={confirmAction}
            onCancel={() => setConfirmAction(null)}
            onRevoke={handleRevokeSession}
            onResolve={handleResolveEvent}
          />
        )}
      </div>
    </>
  );
}

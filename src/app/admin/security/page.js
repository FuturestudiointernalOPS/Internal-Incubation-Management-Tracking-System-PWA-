"use client";

import React, { useState } from "react";
import { useI18n } from "@/lib/i18n";
import {
  Shield,
  AlertTriangle,
  Monitor,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Loader2,
  LogOut,
  Activity,
} from "lucide-react";
import { useApi } from "@/lib/hooks/useApi";

const SEVERITY_COLORS = {
  info: "text-blue-400 bg-blue-500/10",
  warning: "text-amber-400 bg-amber-500/10",
  error: "text-red-400 bg-red-500/10",
  critical: "text-rose-400 bg-rose-500/10",
};

function formatDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// Module scope on purpose: the hook keys its internal callback on these
// functions, so inline arrows would give them a new identity on every render and
// refetch in a loop. The four summary reads keep their payload because the
// summary combines parts of each; a failed one reports null, which is what keeps
// the summary from being assembled out of a half-failed set.
const pickPayload = (d) => (d?.success ? d : null);
const pickSessions = (d) => (d?.success ? d.sessions || [] : []);
const pickEvents = (d) => (d?.success ? d.events || [] : []);
const pickLoginHistory = (d) => (d?.success ? d.history || [] : []);

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
      const res = await fetch("/api/security/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke", session_token: token }),
      });
      const data = await res.json();
      if (data.success) {
        setSessions((prev) => prev.filter((s) => s.token !== token));
        setConfirmAction(null);
      }
    } catch (err) {
      console.error("Revoke error:", err);
    }
  };

  const handleResolveEvent = async (eventId) => {
    try {
      const res = await fetch("/api/security/events", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resolve", event_id: eventId, resolution_notes: "Reviewed and resolved" }),
      });
      const data = await res.json();
      if (data.success) {
        refreshEvents();
        setConfirmAction(null);
      }
    } catch (err) {
      console.error("Resolve error:", err);
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
      <div className="min-h-screen bg-[#020617] text-white p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter flex items-center gap-2">
              <Shield className="text-[var(--brand-orange)]" size={24} />
              {t("adminMisc.security.title")}
            </h1>
            <p className="text-sm text-gray-400 mt-1">{t("adminMisc.security.subtitle")}</p>
          </div>
          <button
            onClick={refreshAll}
            className="flex items-center gap-2 px-4 py-2 bg-[#0f172a] border border-gray-800 rounded-xl hover:bg-[#1e293b] transition-colors text-sm"
          >
            <RefreshCw size={14} />
            {t("adminMisc.security.refresh")}
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 bg-[#0f172a] border border-gray-800 rounded-xl p-1 mb-6 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? "bg-[var(--brand-orange)] text-black"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

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
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-[#0f172a] border border-gray-800 rounded-xl p-4">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-2">
                  <Monitor size={14} />
                  {t("adminMisc.security.activeSessions")}
                </div>
                <p className="text-2xl font-black tracking-tight">{summary?.active_sessions || 0}</p>
              </div>
              <div className="bg-[#0f172a] border border-gray-800 rounded-xl p-4">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-2">
                  <AlertTriangle size={14} />
                  {t("adminMisc.security.unresolvedEvents")}
                </div>
                <p className="text-2xl font-black tracking-tight text-amber-400">{summary?.unresolved_events || 0}</p>
              </div>
              <div className="bg-[#0f172a] border border-gray-800 rounded-xl p-4">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-2">
                  <CheckCircle2 size={14} />
                  {t("adminMisc.security.loginSuccess")}
                </div>
                <p className="text-2xl font-black tracking-tight text-emerald-400">{summary?.login_successes || 0}</p>
              </div>
              <div className="bg-[#0f172a] border border-gray-800 rounded-xl p-4">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-2">
                  <XCircle size={14} />
                  {t("adminMisc.security.loginFailures")}
                </div>
                <p className="text-2xl font-black tracking-tight text-red-400">{summary?.login_failures || 0}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Recent Security Events */}
              <div className="bg-[#0f172a] border border-gray-800 rounded-xl p-4">
                <h3 className="text-sm font-black uppercase tracking-tight text-gray-300 mb-4">{t("adminMisc.security.recentSecurityEvents")}</h3>
                {events.length === 0 ? (
                  <p className="text-gray-500 text-sm">{t("adminMisc.security.noSecurityEvents24h")}</p>
                ) : (
                  <div className="space-y-2">
                    {events.slice(0, 5).map((evt) => (
                      <div key={evt.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-white/5">
                        <AlertTriangle size={14} className={`mt-0.5 ${evt.severity === "critical" ? "text-rose-400" : evt.severity === "warning" ? "text-amber-400" : "text-blue-400"}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-300 truncate">{evt.description || evt.event_type?.replace(/_/g, " ")}</p>
                          <p className="text-xs text-gray-500">{formatDate(evt.created_at)}</p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${SEVERITY_COLORS[evt.severity] || SEVERITY_COLORS.info}`}>
                          {evt.severity}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Login Activity */}
              <div className="bg-[#0f172a] border border-gray-800 rounded-xl p-4">
                <h3 className="text-sm font-black uppercase tracking-tight text-gray-300 mb-4">{t("adminMisc.security.recentLoginActivity")}</h3>
                {loginHistory.length === 0 ? (
                  <p className="text-gray-500 text-sm">{t("adminMisc.security.noLoginActivity24h")}</p>
                ) : (
                  <div className="space-y-2">
                    {loginHistory.slice(0, 5).map((h) => (
                      <div key={h.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-white/5">
                        {h.is_success ? (
                          <CheckCircle2 size={14} className="mt-0.5 text-emerald-400" />
                        ) : (
                          <XCircle size={14} className="mt-0.5 text-red-400" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-300">{h.user_name || h.user_cid || t("adminMisc.security.unknown")}</p>
                          <p className="text-xs text-gray-500">
                            {h.action?.replace(/_/g, " ")} {h.ip_address ? t("adminMisc.security.fromIp", { ip: h.ip_address }) : ""}
                          </p>
                        </div>
                        <p className="text-xs text-gray-500 whitespace-nowrap">{formatDate(h.created_at)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── SESSIONS TAB ──────────────────────────────────────────────── */}
        {!loading && activeTab === "sessions" && (
          <div>
            {sessionsLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="animate-spin text-[var(--brand-orange)]" size={24} /></div>
            ) : sessions.length === 0 ? (
              <div className="bg-[#0f172a] border border-gray-800 rounded-xl p-12 text-center">
                <Monitor className="mx-auto mb-3 text-gray-500" size={40} />
                <p className="text-gray-400">{t("adminMisc.security.noActiveSessions")}</p>
              </div>
            ) : (
              <div className="bg-[#0f172a] border border-gray-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th className="text-left p-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">{t("adminMisc.security.colUser")}</th>
                        <th className="text-left p-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">{t("adminMisc.security.colDeviceBrowser")}</th>
                        <th className="text-left p-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">{t("adminMisc.security.colIpLocation")}</th>
                        <th className="text-left p-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">{t("adminMisc.security.colCreated")}</th>
                        <th className="text-left p-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">{t("adminMisc.security.colStatus")}</th>
                        <th className="text-left p-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">{t("adminMisc.security.colActions")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessions.map((s) => (
                        <tr key={s.token} className="border-b border-gray-800/50 hover:bg-white/[0.02]">
                          <td className="p-4">
                            <p className="text-sm text-white">{s.user_name || s.user_cid}</p>
                            <p className="text-xs text-gray-500">{s.user_email || ""}</p>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              {s.browser && <span className="text-xs text-gray-400">{s.browser}</span>}
                              {s.os && <span className="text-xs text-gray-500">{s.os}</span>}
                              {s.device && <span className="text-xs text-gray-500">({s.device})</span>}
                            </div>
                          </td>
                          <td className="p-4">
                            {s.ip_address && <p className="text-sm font-mono text-gray-300">{s.ip_address}</p>}
                            {s.country && <p className="text-xs text-gray-500">{s.country}</p>}
                          </td>
                          <td className="p-4 text-sm text-gray-400">{formatDate(s.created_at)}</td>
                          <td className="p-4">
                            <span className={`text-xs px-2.5 py-1 rounded-full ${
                              s.session_status === "active" || (!s.session_status && new Date(s.expires_at) > new Date())
                                ? "bg-emerald-500/10 text-emerald-400"
                                : "bg-gray-500/10 text-gray-400"
                            }`}>
                              {s.session_status === "revoked" ? t("adminMisc.security.revoked") : s.session_status === "expired" || new Date(s.expires_at) <= new Date() ? t("adminMisc.security.expired") : t("adminMisc.security.active")}
                            </span>
                          </td>
                          <td className="p-4">
                            <button
                              onClick={() => setConfirmAction({ type: "revoke", session: s })}
                              className="p-2 hover:bg-red-500/10 rounded-lg text-gray-400 hover:text-red-400 transition-colors"
                              title={t("adminMisc.security.revokeSession")}
                            >
                              <LogOut size={14} />
                            </button>
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

        {/* ─── SECURITY EVENTS TAB ───────────────────────────────────────── */}
        {!loading && activeTab === "events" && (
          <div>
            {eventsLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="animate-spin text-[var(--brand-orange)]" size={24} /></div>
            ) : events.length === 0 ? (
              <div className="bg-[#0f172a] border border-gray-800 rounded-xl p-12 text-center">
                <Shield className="mx-auto mb-3 text-gray-500" size={40} />
                <p className="text-gray-400">{t("adminMisc.security.noSecurityEvents")}</p>
              </div>
            ) : (
              <div className="bg-[#0f172a] border border-gray-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th className="text-left p-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">{t("adminMisc.security.colTimestamp")}</th>
                        <th className="text-left p-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">{t("adminMisc.security.colEventType")}</th>
                        <th className="text-left p-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">{t("adminMisc.security.colDescription")}</th>
                        <th className="text-left p-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">{t("adminMisc.security.colSeverity")}</th>
                        <th className="text-left p-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">{t("adminMisc.security.colStatus")}</th>
                        <th className="text-left p-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">{t("adminMisc.security.colActions")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.map((evt) => (
                        <tr key={evt.id} className="border-b border-gray-800/50 hover:bg-white/[0.02]">
                          <td className="p-4 text-sm text-gray-400 whitespace-nowrap">{formatDate(evt.created_at)}</td>
                          <td className="p-4">
                            <span className="text-sm text-white">{evt.event_type?.replace(/_/g, " ")}</span>
                          </td>
                          <td className="p-4 text-sm text-gray-400 max-w-[300px] truncate">{evt.description || "-"}</td>
                          <td className="p-4">
                            <span className={`text-xs px-2.5 py-1 rounded-full ${SEVERITY_COLORS[evt.severity] || SEVERITY_COLORS.info}`}>
                              {evt.severity}
                            </span>
                          </td>
                          <td className="p-4">
                            <span className={`text-xs px-2.5 py-1 rounded-full ${
                              evt.is_resolved ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
                            }`}>
                              {evt.is_resolved ? t("adminMisc.security.resolved") : t("adminMisc.security.open")}
                            </span>
                          </td>
                          <td className="p-4">
                            {!evt.is_resolved && (
                              <button
                                onClick={() => setConfirmAction({ type: "resolve", eventId: evt.id })}
                                className="p-2 hover:bg-emerald-500/10 rounded-lg text-gray-400 hover:text-emerald-400 transition-colors"
                                title={t("adminMisc.security.markResolved")}
                              >
                                <CheckCircle2 size={14} />
                              </button>
                            )}
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

        {/* ─── LOGIN HISTORY TAB ─────────────────────────────────────────── */}
        {!loading && activeTab === "login_history" && (
          <div>
            {loginLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="animate-spin text-[var(--brand-orange)]" size={24} /></div>
            ) : loginHistory.length === 0 ? (
              <div className="bg-[#0f172a] border border-gray-800 rounded-xl p-12 text-center">
                <Activity className="mx-auto mb-3 text-gray-500" size={40} />
                <p className="text-gray-400">{t("adminMisc.security.noLoginHistory")}</p>
              </div>
            ) : (
              <div className="bg-[#0f172a] border border-gray-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th className="text-left p-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">{t("adminMisc.security.colTimestamp")}</th>
                        <th className="text-left p-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">{t("adminMisc.security.colUser")}</th>
                        <th className="text-left p-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">{t("adminMisc.security.colAction")}</th>
                        <th className="text-left p-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">{t("adminMisc.security.colDeviceBrowser")}</th>
                        <th className="text-left p-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">{t("adminMisc.security.colIpLocation")}</th>
                        <th className="text-left p-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">{t("adminMisc.security.colStatus")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loginHistory.map((h) => (
                        <tr key={h.id} className="border-b border-gray-800/50 hover:bg-white/[0.02]">
                          <td className="p-4 text-sm text-gray-400 whitespace-nowrap">{formatDate(h.created_at)}</td>
                          <td className="p-4">
                            <p className="text-sm text-white">{h.user_name || h.user_cid || t("adminMisc.security.unknown")}</p>
                            {h.user_email && <p className="text-xs text-gray-500">{h.user_email}</p>}
                          </td>
                          <td className="p-4">
                            <span className="text-sm text-white">{h.action?.replace(/_/g, " ")}</span>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              {h.browser && <span className="text-xs text-gray-400">{h.browser}</span>}
                              {h.os && <span className="text-xs text-gray-500">{h.os}</span>}
                              {h.device && <span className="text-xs text-gray-500">({h.device})</span>}
                            </div>
                          </td>
                          <td className="p-4">
                            {h.ip_address && <p className="text-sm font-mono text-gray-300">{h.ip_address}</p>}
                            {h.country && <p className="text-xs text-gray-500">{h.country}</p>}
                          </td>
                          <td className="p-4">
                            <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full ${
                              h.is_success ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                            }`}>
                              {h.is_success ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                              {h.is_success ? t("adminMisc.security.success") : h.failure_reason || t("adminMisc.security.failed")}
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setConfirmAction(null)}>
            <div className="bg-[#0f172a] border border-gray-800 rounded-xl w-full max-w-md m-4" onClick={(e) => e.stopPropagation()}>
              <div className="p-6">
                {confirmAction.type === "revoke" ? (
                  <>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-3 bg-red-500/10 rounded-xl">
                        <LogOut size={24} className="text-red-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold">{t("adminMisc.security.revokeSession")}</h3>
                        <p className="text-sm text-gray-400">{t("adminMisc.security.forceLogoutWarning")}</p>
                      </div>
                    </div>
                    {confirmAction.session && (
                      <div className="bg-[#020617] rounded-lg p-3 mb-4 text-sm">
                        <p>{t("adminMisc.security.userLabel")} <span className="text-gray-300">{confirmAction.session.user_name || confirmAction.session.user_cid}</span></p>
                        <p>{t("adminMisc.security.ipLabel")} <span className="text-gray-300 font-mono">{confirmAction.session.ip_address || t("adminMisc.security.na")}</span></p>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-3 bg-emerald-500/10 rounded-xl">
                        <CheckCircle2 size={24} className="text-emerald-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold">{t("adminMisc.security.resolveEvent")}</h3>
                        <p className="text-sm text-gray-400">{t("adminMisc.security.markResolvedDesc")}</p>
                      </div>
                    </div>
                  </>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmAction(null)}
                    className="flex-1 px-4 py-2.5 bg-[#020617] border border-gray-800 rounded-lg text-sm hover:bg-[#1e293b] transition-colors"
                  >
                    {t("adminMisc.security.cancel")}
                  </button>
                  <button
                    onClick={() => {
                      if (confirmAction.type === "revoke") handleRevokeSession(confirmAction.session.token);
                      else handleResolveEvent(confirmAction.eventId);
                    }}
                    className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      confirmAction.type === "revoke"
                        ? "bg-red-500 hover:bg-red-600 text-white"
                        : "bg-emerald-500 hover:bg-emerald-600 text-white"
                    }`}
                  >
                    {t("adminMisc.security.confirm")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

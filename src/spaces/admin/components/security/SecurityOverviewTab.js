"use client";

import { AlertTriangle, Monitor, CheckCircle2, XCircle } from "lucide-react";
import { SEVERITY_COLORS, formatDate } from "./constants";

export default function SecurityOverviewTab({
  t,
  summary,
  events,
  loginHistory,
  loginActionLabel,
}) {
  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl p-4">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-[var(--text-secondary)] mb-2">
            <Monitor size={14} />
            {t("adminMisc.security.activeSessions")}
          </div>
          <p className="text-2xl font-black tracking-tight">{summary?.active_sessions || 0}</p>
        </div>
        <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl p-4">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-[var(--text-secondary)] mb-2">
            <AlertTriangle size={14} />
            {t("adminMisc.security.unresolvedEvents")}
          </div>
          <p className="text-2xl font-black tracking-tight text-amber-400">{summary?.unresolved_events || 0}</p>
        </div>
        <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl p-4">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-[var(--text-secondary)] mb-2">
            <CheckCircle2 size={14} />
            {t("adminMisc.security.loginSuccess")}
          </div>
          <p className="text-2xl font-black tracking-tight text-emerald-400">{summary?.login_successes || 0}</p>
        </div>
        <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl p-4">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-[var(--text-secondary)] mb-2">
            <XCircle size={14} />
            {t("adminMisc.security.loginFailures")}
          </div>
          <p className="text-2xl font-black tracking-tight text-red-400">{summary?.login_failures || 0}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Security Events */}
        <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl p-4">
          <h3 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)] mb-4">{t("adminMisc.security.recentSecurityEvents")}</h3>
          {events.length === 0 ? (
            <p className="text-[var(--text-secondary)] text-sm">{t("adminMisc.security.noSecurityEvents24h")}</p>
          ) : (
            <div className="space-y-2">
              {events.slice(0, 5).map((securityEvent) => (
                <div key={securityEvent.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-[var(--surface-2)]">
                  <AlertTriangle size={14} className={`mt-0.5 ${securityEvent.severity === "critical" ? "text-rose-400" : securityEvent.severity === "warning" ? "text-amber-400" : "text-blue-400"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--text-primary)] truncate">{securityEvent.description || securityEvent.event_type?.replace(/_/g, " ")}</p>
                    <p className="text-xs text-[var(--text-secondary)]">{formatDate(securityEvent.created_at)}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${SEVERITY_COLORS[securityEvent.severity] || SEVERITY_COLORS.info}`}>
                    {securityEvent.severity}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Login Activity */}
        <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl p-4">
          <h3 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)] mb-4">{t("adminMisc.security.recentLoginActivity")}</h3>
          {loginHistory.length === 0 ? (
            <p className="text-[var(--text-secondary)] text-sm">{t("adminMisc.security.noLoginActivity24h")}</p>
          ) : (
            <div className="space-y-2">
              {loginHistory.slice(0, 5).map((loginEntry) => (
                <div key={loginEntry.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-[var(--surface-2)]">
                  {loginEntry.is_success ? (
                    <CheckCircle2 size={14} className="mt-0.5 text-emerald-400" />
                  ) : (
                    <XCircle size={14} className="mt-0.5 text-red-400" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--text-primary)]">{loginEntry.user_name || loginEntry.user_cid || t("adminMisc.security.unknown")}</p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {loginActionLabel(loginEntry.action)} {loginEntry.ip_address ? t("adminMisc.security.fromIp", { ip: loginEntry.ip_address }) : ""}
                    </p>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] whitespace-nowrap">{formatDate(loginEntry.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

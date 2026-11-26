"use client";

import { Monitor, Loader2, LogOut } from "lucide-react";
import { formatDate } from "./constants";

export default function SecuritySessionsTab({
  t,
  sessionsLoading,
  sessions,
  setConfirmAction,
}) {
  return (
    <div>
      {sessionsLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-[var(--brand-orange)]" size={24} /></div>
      ) : sessions.length === 0 ? (
        <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl p-12 text-center">
          <Monitor className="mx-auto mb-3 text-[var(--text-secondary)]" size={40} />
          <p className="text-[var(--text-secondary)]">{t("adminMisc.security.noActiveSessions")}</p>
        </div>
      ) : (
        <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border-primary)]">
                  <th className="text-left p-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("adminMisc.security.colUser")}</th>
                  <th className="text-left p-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("adminMisc.security.colDeviceBrowser")}</th>
                  <th className="text-left p-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("adminMisc.security.colIpLocation")}</th>
                  <th className="text-left p-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("adminMisc.security.colCreated")}</th>
                  <th className="text-left p-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("adminMisc.security.colStatus")}</th>
                  <th className="text-left p-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("adminMisc.security.colActions")}</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.token} className="border-b border-[var(--border-secondary)] hover:bg-[var(--surface-2)]">
                    <td className="p-4">
                      <p className="text-sm text-[var(--text-primary)]">{session.user_name || session.user_cid}</p>
                      <p className="text-xs text-[var(--text-secondary)]">{session.user_email || ""}</p>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {session.browser && <span className="text-xs text-[var(--text-secondary)]">{session.browser}</span>}
                        {session.os && <span className="text-xs text-[var(--text-secondary)]">{session.os}</span>}
                        {session.device && <span className="text-xs text-[var(--text-secondary)]">({session.device})</span>}
                      </div>
                    </td>
                    <td className="p-4">
                      {session.ip_address && <p className="text-sm font-mono text-[var(--text-primary)]">{session.ip_address}</p>}
                      {session.country && <p className="text-xs text-[var(--text-secondary)]">{session.country}</p>}
                    </td>
                    <td className="p-4 text-sm text-[var(--text-secondary)]">{formatDate(session.created_at)}</td>
                    <td className="p-4">
                      <span className={`text-xs px-2.5 py-1 rounded-full ${
                        session.session_status === "active" || (!session.session_status && new Date(session.expires_at) > new Date())
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-gray-500/10 text-[var(--text-secondary)]"
                      }`}>
                        {session.session_status === "revoked" ? t("adminMisc.security.revoked") : session.session_status === "expired" || new Date(session.expires_at) <= new Date() ? t("adminMisc.security.expired") : t("adminMisc.security.active")}
                      </span>
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => setConfirmAction({ type: "revoke", session })}
                        className="p-2 hover:bg-red-500/10 rounded-lg text-[var(--text-secondary)] hover:text-red-400 transition-colors"
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
  );
}

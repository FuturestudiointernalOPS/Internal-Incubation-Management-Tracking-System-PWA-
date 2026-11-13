"use client";

import { Shield, Loader2, CheckCircle2 } from "lucide-react";
import { SEVERITY_COLORS, formatDate } from "./constants";

export default function SecurityEventsTab({
  t,
  eventsLoading,
  events,
  setConfirmAction,
}) {
  return (
    <div>
      {eventsLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-[var(--brand-orange)]" size={24} /></div>
      ) : events.length === 0 ? (
        <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl p-12 text-center">
          <Shield className="mx-auto mb-3 text-[var(--text-secondary)]" size={40} />
          <p className="text-[var(--text-secondary)]">{t("adminMisc.security.noSecurityEvents")}</p>
        </div>
      ) : (
        <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border-primary)]">
                  <th className="text-left p-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("adminMisc.security.colTimestamp")}</th>
                  <th className="text-left p-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("adminMisc.security.colEventType")}</th>
                  <th className="text-left p-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("adminMisc.security.colDescription")}</th>
                  <th className="text-left p-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("adminMisc.security.colSeverity")}</th>
                  <th className="text-left p-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("adminMisc.security.colStatus")}</th>
                  <th className="text-left p-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("adminMisc.security.colActions")}</th>
                </tr>
              </thead>
              <tbody>
                {events.map((securityEvent) => (
                  <tr key={securityEvent.id} className="border-b border-[var(--border-secondary)] hover:bg-[var(--surface-2)]">
                    <td className="p-4 text-sm text-[var(--text-secondary)] whitespace-nowrap">{formatDate(securityEvent.created_at)}</td>
                    <td className="p-4">
                      <span className="text-sm text-[var(--text-primary)]">{securityEvent.event_type?.replace(/_/g, " ")}</span>
                    </td>
                    <td className="p-4 text-sm text-[var(--text-secondary)] max-w-[300px] truncate">{securityEvent.description || "-"}</td>
                    <td className="p-4">
                      <span className={`text-xs px-2.5 py-1 rounded-full ${SEVERITY_COLORS[securityEvent.severity] || SEVERITY_COLORS.info}`}>
                        {securityEvent.severity}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`text-xs px-2.5 py-1 rounded-full ${
                        securityEvent.is_resolved ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
                      }`}>
                        {securityEvent.is_resolved ? t("adminMisc.security.resolved") : t("adminMisc.security.open")}
                      </span>
                    </td>
                    <td className="p-4">
                      {!securityEvent.is_resolved && (
                        <button
                          onClick={() => setConfirmAction({ type: "resolve", eventId: securityEvent.id })}
                          className="p-2 hover:bg-emerald-500/10 rounded-lg text-[var(--text-secondary)] hover:text-emerald-400 transition-colors"
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
  );
}

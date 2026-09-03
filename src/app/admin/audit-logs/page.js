"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import {
  Search,
  Filter,
  Calendar,
  AlertTriangle,
  Info,
  AlertCircle,
  Shield,
  Download,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Eye,
  X,
  Loader2,
  Clock,
} from "lucide-react";
import { cacheGet, cacheSet } from "@/lib/hooks/useApi";

const SEVERITY_COLORS = {
  info: "text-blue-400 bg-blue-500/10",
  warning: "text-amber-400 bg-amber-500/10",
  error: "text-red-400 bg-red-500/10",
  critical: "text-rose-400 bg-rose-500/10",
};

const SEVERITY_ICONS = {
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
  critical: Shield,
};

const EVENT_TYPE_OPTIONS = [
  "", "LOGIN_SUCCESS", "LOGIN_FAILED", "LOGOUT",
  "SESSION_CREATED", "SESSION_REVOKED", "PASSWORD_CHANGED",
  "ROLE_CHANGED", "PERMISSION_CHANGE", "STARTUP_CREATED",
  "STARTUP_DELETED", "PROJECT_UPDATED", "DOCUMENT_DOWNLOADED",
  "INVESTOR_ACCESS", "CONFIGURATION_UPDATED", "API_ACCESS",
  "EXPORT_GENERATED", "AUDIT_VIEWED", "SECURITY_ALERT",
];

export default function AuditLogsPage() {
  const { t } = useI18n();
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedLog, setSelectedLog] = useState(null);
  const [filters, setFilters] = useState({
    event_type: "",
    severity: "",
    limit: 50,
    offset: 0,
  });
  const [searchTerm, setSearchTerm] = useState("");

  const fetchLogs = useCallback(async (bypassCache = false) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.event_type) params.set("event_type", filters.event_type);
      if (filters.severity) params.set("severity", filters.severity);
      params.set("limit", filters.limit);
      params.set("offset", filters.offset);

      const logsUrl = `/api/audit-logs?${params}`;
      const statsUrl = "/api/audit-logs?type=stats&hours=24";
      let painted = false;
      const apply = (logsData, statsData) => {
        if (logsData.success) {
          setLogs(logsData.logs || []);
          painted = true;
        }
        if (statsData.success) setStats(statsData);
      };

      // Cache-first paint: returning to a page/filter combo renders instantly
      // when both snapshots are fresh.
      if (!bypassCache) {
        const cachedLogs = cacheGet(logsUrl);
        const cachedStats = cacheGet(statsUrl);
        if (cachedLogs !== null && cachedLogs.success && cachedStats !== null && cachedStats.success) {
          apply(cachedLogs, cachedStats);
          setLoading(false);
        }
      }

      const [logsRes, statsRes] = await Promise.all([
        fetch(logsUrl),
        fetch(statsUrl),
      ]);

      const logsData = await logsRes.json();
      const statsData = await statsRes.json();

      if (logsData.success) cacheSet(logsUrl, logsData);
      if (statsData.success) cacheSet(statsUrl, statsData);
      apply(logsData, statsData);
      if (!logsData.success) setError(t(logsData.error || "") || logsData.error);
    } catch (err) {
      if (!painted) setError(t(err.message || "") || err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const handlePrevPage = () => {
    if (filters.offset > 0) {
      setFilters((f) => ({ ...f, offset: Math.max(0, f.offset - f.limit) }));
    }
  };

  const handleNextPage = () => {
    if (logs.length === filters.limit) {
      setFilters((f) => ({ ...f, offset: f.offset + f.limit }));
    }
  };

  const formatDate = (d) => {
    if (!d) return "";
    return new Date(d).toLocaleString("fr-FR", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  return (
    <>
      <div className="min-h-screen bg-[#020617] text-white p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter flex items-center gap-2">
              <Shield className="text-[var(--brand-orange)]" size={24} />
              {t("adminMisc.auditLogs.title")}
            </h1>
            <p className="text-sm text-gray-400 mt-1">{t("adminMisc.auditLogs.subtitle")}</p>
          </div>
          <button
            onClick={fetchLogs}
            className="flex items-center gap-2 px-4 py-2 bg-[#0f172a] border border-gray-800 rounded-xl hover:bg-[#1e293b] transition-colors text-sm"
          >
            <RefreshCw size={14} />
            {t("adminMisc.auditLogs.refresh")}
          </button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-[#0f172a] border border-gray-800 rounded-xl p-4">
              <p className="text-2xl font-black tracking-tight">{stats.total || stats.audit_logs_24h || 0}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{t("adminMisc.auditLogs.events24h")}</p>
            </div>
            {(stats.by_severity || []).map((s) => (
              <div key={s.severity} className="bg-[#0f172a] border border-gray-800 rounded-xl p-4">
                <p className={`text-2xl font-black tracking-tight ${s.severity === "critical" ? "text-rose-400" : s.severity === "error" ? "text-red-400" : s.severity === "warning" ? "text-amber-400" : "text-blue-400"}`}>
                  {s.c}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{s.severity}</p>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="bg-[#0f172a] border border-gray-800 rounded-xl p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px] relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder={t("adminMisc.auditLogs.searchPlaceholder")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-[#020617] border border-gray-800 rounded-lg text-sm font-bold text-white placeholder-gray-500 focus:outline-none focus:border-[var(--brand-orange)]"
              />
            </div>
            <select
              value={filters.event_type}
              onChange={(e) => setFilters((f) => ({ ...f, event_type: e.target.value, offset: 0 }))}
              className="px-4 py-2.5 bg-[#020617] border border-gray-800 rounded-lg text-sm font-bold text-white focus:outline-none focus:border-[var(--brand-orange)]"
            >
              <option value="">{t("adminMisc.auditLogs.allEventTypes")}</option>
              {EVENT_TYPE_OPTIONS.filter(Boolean).map((opt) => (
                <option key={opt} value={opt}>{opt.replace(/_/g, " ")}</option>
              ))}
            </select>
            <select
              value={filters.severity}
              onChange={(e) => setFilters((f) => ({ ...f, severity: e.target.value, offset: 0 }))}
              className="px-4 py-2.5 bg-[#020617] border border-gray-800 rounded-lg text-sm font-bold text-white focus:outline-none focus:border-[var(--brand-orange)]"
            >
              <option value="">{t("adminMisc.auditLogs.allSeverities")}</option>
              <option value="info">{t("adminMisc.auditLogs.severityInfo")}</option>
              <option value="warning">{t("adminMisc.auditLogs.severityWarning")}</option>
              <option value="error">{t("adminMisc.auditLogs.severityError")}</option>
              <option value="critical">{t("adminMisc.auditLogs.severityCritical")}</option>
            </select>
          </div>
        </div>

        {/* Logs Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-[var(--brand-orange)]" size={32} />
          </div>
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-8 text-center">
            <AlertCircle className="mx-auto mb-3 text-red-400" size={40} />
            <p className="text-red-400">{error}</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="bg-[#0f172a] border border-gray-800 rounded-xl p-12 text-center">
            <Info className="mx-auto mb-3 text-gray-500" size={40} />
            <p className="text-sm text-gray-400">{t("adminMisc.auditLogs.emptyState")}</p>
            <p className="text-sm text-gray-600 mt-2">{t("adminMisc.auditLogs.emptyStateDesc")}</p>
          </div>
        ) : (
          <div className="bg-[#0f172a] border border-gray-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left p-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">{t("adminMisc.auditLogs.colTimestamp")}</th>
                    <th className="text-left p-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">{t("adminMisc.auditLogs.colEventType")}</th>
                    <th className="text-left p-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">{t("adminMisc.auditLogs.colActor")}</th>
                    <th className="text-left p-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">{t("adminMisc.auditLogs.colDescription")}</th>
                    <th className="text-left p-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">{t("adminMisc.auditLogs.colSeverity")}</th>
                    <th className="text-left p-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">{t("adminMisc.auditLogs.colActions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                    const SevIcon = SEVERITY_ICONS[log.severity] || Info;
                    return (
                      <tr
                        key={log.id}
                        className="border-b border-gray-800/50 hover:bg-white/[0.02] transition-colors cursor-pointer"
                        onClick={() => setSelectedLog(log)}
                      >
                        <td className="p-4 text-sm font-bold text-gray-300 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Clock size={12} className="text-gray-500" />
                            {formatDate(log.created_at)}
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="text-sm font-bold text-white">
                            {log.event_type?.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="text-sm font-bold text-gray-300">{log.actor_name || log.actor_cid}</div>
                          {log.actor_role && <div className="text-[10px] font-medium text-gray-500">{log.actor_role}</div>}
                        </td>
                        <td className="p-4 text-sm text-gray-400 max-w-[300px] truncate">
                          {log.description || "-"}
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${SEVERITY_COLORS[log.severity] || SEVERITY_COLORS.info}`}>
                            <SevIcon size={10} />
                            {log.severity || "info"}
                          </span>
                        </td>
                        <td className="p-4">
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedLog(log); }}
                            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                          >
                            <Eye size={14} className="text-gray-400" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between p-4 border-t border-gray-800">
              <p className="text-sm text-gray-500">
                {t("adminMisc.auditLogs.showing", { start: filters.offset + 1, end: filters.offset + logs.length })}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrevPage}
                  disabled={filters.offset === 0}
                  className="p-2 hover:bg-white/5 rounded-lg disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={handleNextPage}
                  disabled={logs.length < filters.limit}
                  className="p-2 hover:bg-white/5 rounded-lg disabled:opacity-30 transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Detail Modal */}
        {selectedLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setSelectedLog(null)}>
            <div className="bg-[#0f172a] border border-gray-800 rounded-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto m-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-6 border-b border-gray-800">
                <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
                  <Shield size={18} className="text-[var(--brand-orange)]" />
                  {t("adminMisc.auditLogs.detailsTitle")}
                </h2>
                <button onClick={() => setSelectedLog(null)} className="p-2 hover:bg-white/5 rounded-lg">
                  <X size={16} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">{t("adminMisc.auditLogs.colEventType")}</p>
                    <p className="text-sm font-bold">{selectedLog.event_type?.replace(/_/g, " ")}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">{t("adminMisc.auditLogs.colSeverity")}</p>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${SEVERITY_COLORS[selectedLog.severity] || SEVERITY_COLORS.info}`}>
                      {selectedLog.severity || "info"}
                    </span>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">{t("adminMisc.auditLogs.colTimestamp")}</p>
                    <p className="text-sm font-bold">{formatDate(selectedLog.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">{t("adminMisc.auditLogs.colActor")}</p>
                    <p className="text-sm font-bold">{selectedLog.actor_name || selectedLog.actor_cid}</p>
                    {selectedLog.actor_role && <p className="text-[10px] font-medium text-gray-500">{selectedLog.actor_role}</p>}
                  </div>
                  {selectedLog.venture_id && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">{t("adminMisc.auditLogs.venture")}</p>
                      <p className="text-sm font-bold">{selectedLog.venture_id}</p>
                    </div>
                  )}
                  {selectedLog.ip_address && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">{t("adminMisc.auditLogs.ipAddress")}</p>
                      <p className="text-sm font-bold font-mono text-gray-300">{selectedLog.ip_address}</p>
                    </div>
                  )}
                </div>
                {selectedLog.description && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">{t("adminMisc.auditLogs.colDescription")}</p>
                    <p className="text-sm font-bold text-gray-300">{selectedLog.description}</p>
                  </div>
                )}
                {selectedLog.metadata && typeof selectedLog.metadata === "object" && Object.keys(selectedLog.metadata).length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">{t("adminMisc.auditLogs.metadata")}</p>
                    <pre className="text-xs text-gray-400 bg-[#020617] rounded-lg p-3 overflow-x-auto">
                      {JSON.stringify(selectedLog.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

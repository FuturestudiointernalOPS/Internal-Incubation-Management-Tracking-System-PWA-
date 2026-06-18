"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Search,
  FileText,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  X,
  Shield,
  User,
  Calendar,
  Bug,
  Activity,
  AlertCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useI18n } from "@/lib/i18n";

function SeverityBadge({ severity }) {
  const config = {
    critical: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    fatal: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    error: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    warning: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    info: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  };
  const c =
    config[severity?.toLowerCase()] ||
    "bg-slate-500/10 text-slate-400 border-slate-500/20";
  return (
    <span
      className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${c}`}
    >
      {severity || "unknown"}
    </span>
  );
}

function ResolvedBadge({ resolved }) {
  if (resolved) {
    return (
      <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
        Resolved
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border bg-amber-500/10 text-amber-400 border-amber-500/20">
      Open
    </span>
  );
}

export default function DeveloperErrors() {
  const router = useRouter();
  const { t } = useI18n();
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterSeverity, setFilterSeverity] = useState("all");
  const [filterResolved, setFilterResolved] = useState("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [resolutionNotes, setResolutionNotes] = useState({});
  const [actionLoading, setActionLoading] = useState(false);

  const fetchErrors = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterSeverity !== "all") params.set("severity", filterSeverity);
      if (filterResolved === "resolved") params.set("resolved", "true");
      else if (filterResolved === "unresolved") params.set("resolved", "false");
      if (search) params.set("search", search);

      const res = await fetch(`/api/errors?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setErrors(data.errors || []);
      }
    } catch (e) {
      console.error("Failed to fetch errors", e);
    } finally {
      setLoading(false);
    }
  }, [filterSeverity, filterResolved, search]);

  useEffect(() => {
    fetchErrors();
  }, [fetchErrors]);

  const handleToggleResolved = async (id, currentlyResolved) => {
    setActionLoading(true);
    try {
      const notes = resolutionNotes[id] || null;
      await fetch("/api/errors", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          resolved: !currentlyResolved,
          resolution_notes: !currentlyResolved ? notes : null,
        }),
      });
      setResolutionNotes((prev) => ({ ...prev, [id]: "" }));
      fetchErrors();
    } catch (e) {
      console.error("Failed to update error", e);
    }
    setActionLoading(false);
  };

  const toggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <DashboardLayout role="developer" activeTab="error_logs">
      <div className="space-y-8 pb-20">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-[var(--border-primary)] pb-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Bug className="w-4 h-4 text-[var(--brand-orange)]" />
              <span className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-[0.4em]">
                Developer Console
              </span>
            </div>
            <h1 className="text-4xl font-black text-[var(--text-primary)] uppercase tracking-tighter">
              Error Logs
            </h1>
            <p className="text-xs font-bold text-[var(--text-secondary)] opacity-60">
              {errors.length} total errors captured
            </p>
          </div>
          <button
            onClick={fetchErrors}
            className="flex items-center gap-2 px-4 py-2.5 bg-secondary border border-[var(--border-primary)] rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-tertiary transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </header>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search error messages..."
              className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl pl-10 pr-4 py-3 text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/50 font-bold text-xs transition-all"
            />
          </div>
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="px-3 py-3 rounded-xl bg-secondary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none"
          >
            <option value="all">All Severity</option>
            <option value="critical">Critical</option>
            <option value="error">Error</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>
          <select
            value={filterResolved}
            onChange={(e) => setFilterResolved(e.target.value)}
            className="px-3 py-3 rounded-xl bg-secondary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none"
          >
            <option value="all">All Status</option>
            <option value="resolved">Resolved</option>
            <option value="unresolved">Unresolved</option>
          </select>
        </div>

        {/* Errors List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div
              className="w-6 h-6 border-2 border-t-[var(--brand-orange)] rounded-full animate-spin"
              style={{
                borderColor: "rgba(255,102,0,0.1)",
                borderTopColor: "var(--brand-orange)",
              }}
            />
          </div>
        ) : errors.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center opacity-40">
            <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-4" />
            <p className="text-lg font-black text-[var(--text-primary)] uppercase">
              {search || filterSeverity !== "all" || filterResolved !== "all"
                ? "No matches"
                : "No errors captured"}
            </p>
            <p className="text-xs font-bold text-slate-500 mt-1">
              {search || filterSeverity !== "all" || filterResolved !== "all"
                ? "Try different filters"
                : "Errors will appear here when something goes wrong."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {errors.map((error) => (
              <div
                key={error.id}
                className={`ios-card !p-0 overflow-hidden border-[var(--border-primary)] hover:border-[var(--brand-orange)]/30 transition-all ${
                  !error.resolved
                    ? "border-l-4 border-l-amber-500"
                    : ""
                }`}
              >
                {/* Summary Row */}
                <button
                  onClick={() => toggleExpand(error.id)}
                  className="w-full flex flex-col lg:flex-row items-stretch text-left"
                >
                  <div className="flex-1 p-4 flex items-center gap-4">
                    <div className="flex-shrink-0">
                      {expandedId === error.id ? (
                        <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <SeverityBadge severity={error.severity} />
                        <ResolvedBadge resolved={error.resolved} />
                      </div>
                      <p className="text-xs font-bold text-[var(--text-primary)] truncate">
                        {error.message || "No message"}
                      </p>
                    </div>
                    <div className="hidden lg:flex items-center gap-4 flex-shrink-0">
                      {error.url && (
                        <span className="text-[8px] font-bold text-slate-500 max-w-[160px] truncate">
                          {error.url}
                        </span>
                      )}
                      {error.user_id && (
                        <span className="text-[8px] font-bold text-slate-500 flex items-center gap-1">
                          <User className="w-3 h-3" />{" "}
                          {error.user_id}
                        </span>
                      )}
                      <span className="text-[8px] font-bold text-slate-500 flex items-center gap-1 whitespace-nowrap">
                        <Calendar className="w-3 h-3" />{" "}
                        {error.created_at
                          ? new Date(error.created_at).toLocaleDateString()
                          : "—"}
                      </span>
                    </div>
                  </div>
                </button>

                {/* Expanded Detail */}
                {expandedId === error.id && (
                  <div className="border-t border-[var(--border-primary)] bg-tertiary/50">
                    <div className="p-4 space-y-4">
                      {/* Stack Trace */}
                      {error.stack && (
                        <div>
                          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">
                            Stack Trace
                          </p>
                          <pre className="text-[9px] font-mono text-[var(--text-secondary)] bg-primary rounded-xl p-3 overflow-x-auto whitespace-pre-wrap max-h-40 overflow-y-auto border border-[var(--border-primary)]">
                            {error.stack}
                          </pre>
                        </div>
                      )}

                      {/* Request Details */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {error.method && (
                          <div className="p-3 rounded-xl bg-primary border border-[var(--border-primary)]">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                              Method
                            </p>
                            <p className="text-xs font-bold mt-0.5 text-[var(--text-primary)]">
                              {error.method}
                            </p>
                          </div>
                        )}
                        {error.endpoint && (
                          <div className="p-3 rounded-xl bg-primary border border-[var(--border-primary)]">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                              Endpoint
                            </p>
                            <p className="text-xs font-bold mt-0.5 text-[var(--text-primary)] truncate">
                              {error.endpoint}
                            </p>
                          </div>
                        )}
                        {error.status_code && (
                          <div className="p-3 rounded-xl bg-primary border border-[var(--border-primary)]">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                              Status Code
                            </p>
                            <p className="text-xs font-bold mt-0.5 text-[var(--text-primary)]">
                              {error.status_code}
                            </p>
                          </div>
                        )}
                        {error.user_agent && (
                          <div className="p-3 rounded-xl bg-primary border border-[var(--border-primary)]">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                              User Agent
                            </p>
                            <p className="text-[9px] font-bold mt-0.5 text-[var(--text-secondary)] truncate">
                              {error.user_agent}
                            </p>
                          </div>
                        )}
                        {error.url && (
                          <div className="p-3 rounded-xl bg-primary border border-[var(--border-primary)] md:col-span-2">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                              URL
                            </p>
                            <p className="text-xs font-bold mt-0.5 text-[var(--text-primary)] truncate">
                              {error.url}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Resolution Panel */}
                      <div className="p-4 rounded-xl bg-primary border border-[var(--border-primary)] space-y-3">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                          Resolution
                        </p>
                        <textarea
                          value={resolutionNotes[error.id] || ""}
                          onChange={(e) =>
                            setResolutionNotes((prev) => ({
                              ...prev,
                              [error.id]: e.target.value,
                            }))
                          }
                          rows={2}
                          placeholder="Add resolution notes..."
                          className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-xs outline-none focus:border-[var(--brand-orange)] transition-all resize-none"
                        />
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() =>
                              handleToggleResolved(error.id, !!error.resolved)
                            }
                            disabled={actionLoading}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                            style={{
                              background: error.resolved
                                ? "rgba(239,68,68,0.15)"
                                : "var(--brand-orange)",
                              color: error.resolved
                                ? "var(--chart-danger, #ef4444)"
                                : "#000",
                            }}
                          >
                            {error.resolved ? (
                              <>
                                <AlertCircle className="w-3.5 h-3.5" /> Mark
                                Unresolved
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" /> Mark
                                Resolved
                              </>
                            )}
                          </button>
                          {error.resolved_at && (
                            <span className="text-[8px] text-slate-500">
                              Resolved{" "}
                              {new Date(
                                error.resolved_at,
                              ).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        {error.resolution_notes && (
                          <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                            <p className="text-[8px] font-black text-emerald-400 uppercase tracking-widest mb-1">
                              Previous Notes
                            </p>
                            <p className="text-[10px] text-[var(--text-secondary)]">
                              {error.resolution_notes}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

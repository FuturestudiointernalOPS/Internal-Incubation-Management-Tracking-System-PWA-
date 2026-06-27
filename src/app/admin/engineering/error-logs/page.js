"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Bug,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  User,
  Calendar,
  Wrench,
  Copy,
  CheckSquare,
  Square,
  AlertTriangle,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";

const SEVERITY_CONFIG = {
  critical: { color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
  fatal: { color: "#ef4444", bg: "rgba(239,68,68,0.15)" },
  error: { color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  warning: { color: "#3b82f6", bg: "rgba(59,130,246,0.1)" },
  info: { color: "#6b7280", bg: "rgba(107,114,128,0.1)" },
};
const CATEGORY_CONFIG = {
  server_error: {
    color: "#ef4444",
    bg: "rgba(239,68,68,0.1)",
    label: "Server",
  },
  runtime_error: {
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.1)",
    label: "Runtime",
  },
  api_error: { color: "#3b82f6", bg: "rgba(59,130,246,0.1)", label: "API" },
  auth_error: { color: "#8b5cf6", bg: "rgba(139,92,246,0.1)", label: "Auth" },
  network_error: {
    color: "#06b6d4",
    bg: "rgba(6,182,212,0.1)",
    label: "Network",
  },
  validation_error: {
    color: "#f97316",
    bg: "rgba(249,115,22,0.1)",
    label: "Validation",
  },
  database_error: {
    color: "#ec4899",
    bg: "rgba(236,72,153,0.1)",
    label: "Database",
  },
  not_found: {
    color: "#64748b",
    bg: "rgba(100,116,139,0.1)",
    label: "Not Found",
  },
  timeout: { color: "#84cc16", bg: "rgba(132,204,22,0.1)", label: "Timeout" },
  build_error: { color: "#a855f7", bg: "rgba(168,85,247,0.1)", label: "Build" },
  uncategorized: {
    color: "#64748b",
    bg: "rgba(100,116,139,0.05)",
    label: "Other",
  },
};

export default function EngineeringErrorLogs() {
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterSeverity, setFilterSeverity] = useState("all");
  const [filterResolved, setFilterResolved] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [copied, setCopied] = useState(false);

  const fetchErrors = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterSeverity !== "all") params.set("severity", filterSeverity);
      if (filterResolved === "resolved") params.set("resolved", "true");
      else if (filterResolved === "unresolved") params.set("resolved", "false");
      if (filterCategory !== "all") params.set("category", filterCategory);
      if (search) params.set("search", search);
      const res = await fetch(`/api/errors?${params.toString()}`);
      const data = await res.json();
      if (data.success) setErrors(data.errors || []);
    } catch (e) {
      console.error("Failed to fetch errors", e);
    } finally {
      setLoading(false);
    }
  }, [filterSeverity, filterResolved, filterCategory, search]);

  useEffect(() => {
    fetchErrors();
  }, [fetchErrors]);

  const allSelected = errors.length > 0 && selectedIds.size === errors.length;
  const toggleSelect = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };
  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(errors.map((e) => e.id)));
  };

  const copySelected = async () => {
    const selected = errors.filter((e) => selectedIds.has(e.id));
    if (selected.length === 0) return;
    const body = selected
      .map(
        (e) =>
          `---\nError ID: #${e.id}\nOccurrences: ${e.occurrence_count || 1}x\nSeverity: ${e.severity}\nUser: ${e.user_name || "Unknown"} (Role: ${e.user_role || "N/A"})\nPage: ${e.page || "N/A"}\nAction: ${e.action_attempted || "N/A"}\nEndpoint: ${e.endpoint || "N/A"}\nStatus: ${e.status_code || "N/A"}\nTime: ${e.created_at ? new Date(e.created_at).toLocaleString() : "N/A"}\nMessage: ${e.message || "N/A"}\nStack: ${e.stack || "N/A"}\n`,
      )
      .join("\n");
    const full = `Error Report — ${selected.length} error(s)\nGenerated: ${new Date().toLocaleString()}\n\n${body}`;
    try {
      await navigator.clipboard.writeText(full);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = full;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleExpand = (id) =>
    setExpandedId((prev) => (prev === id ? null : id));

  const handleToggleResolved = async (id, currentlyResolved) => {
    await fetch("/api/errors", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, resolved: !currentlyResolved }),
    });
    fetchErrors();
  };

  const handleBulkResolve = async () => {
    for (const id of selectedIds) {
      await fetch("/api/errors", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, resolved: true }),
      });
    }
    setSelectedIds(new Set());
    fetchErrors();
  };

  const totalOccurrences = errors.reduce(
    (sum, e) => sum + (parseInt(e.occurrence_count) || 1),
    0,
  );

  return (
    <DashboardLayout role="super_admin" activeTab="engineering">
      <div className="space-y-8 pb-20">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-[var(--border-primary)] pb-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Bug className="w-4 h-4 text-[var(--brand-orange)]" />
              <span className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-[0.4em]">
                Error Logs
              </span>
            </div>
            <h1 className="text-4xl font-black text-[var(--text-primary)] uppercase tracking-tighter">
              Error Logs
            </h1>
            <p className="text-xs font-bold text-[var(--text-secondary)] opacity-60">
              {errors.length} unique · {totalOccurrences} total occurrences
            </p>
          </div>
          <div className="flex items-center gap-3">
            {selectedIds.size > 0 && (
              <>
                <button
                  onClick={handleBulkResolve}
                  className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-500/20 transition-all"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Resolve{" "}
                  {selectedIds.size}
                </button>
                <button
                  onClick={copySelected}
                  className="flex items-center gap-2 px-4 py-2.5 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:opacity-90 transition-all"
                >
                  <Copy className="w-3.5 h-3.5" />{" "}
                  {copied ? "Copied!" : `Copy ${selectedIds.size} to AI`}
                </button>
              </>
            )}
            <button
              onClick={fetchErrors}
              className="flex items-center gap-2 px-4 py-2.5 bg-secondary border border-[var(--border-primary)] rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-tertiary transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>
        </header>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl pl-10 pr-4 py-3 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/50 transition-all"
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
          </select>
          <select
            value={filterResolved}
            onChange={(e) => setFilterResolved(e.target.value)}
            className="px-3 py-3 rounded-xl bg-secondary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none"
          >
            <option value="all">All Status</option>
            <option value="unresolved">Unresolved</option>
            <option value="resolved">Resolved</option>
          </select>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-3 rounded-xl bg-secondary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none"
          >
            <option value="all">All Categories</option>
            {Object.entries(CATEGORY_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </div>

        {/* Table */}
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
          <div className="py-20 text-center opacity-40">
            <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
            <p className="text-lg font-black text-[var(--text-primary)] uppercase">
              No errors
            </p>
          </div>
        ) : (
          <div className="ios-card !p-0 border-[var(--border-primary)] overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-5 py-3 bg-tertiary/30 border-b border-[var(--border-primary)]">
              <div className="flex items-center gap-3">
                <button
                  onClick={toggleSelectAll}
                  className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
                >
                  {allSelected ? (
                    <CheckSquare className="w-4 h-4" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                  {allSelected ? "Deselect All" : "Select All"}
                </button>
                {selectedIds.size > 0 && (
                  <span className="text-[9px] font-bold text-[var(--brand-orange)]">
                    {selectedIds.size} selected
                  </span>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border-primary)]">
                    <th className="w-10 px-2 py-3"></th>
                    <th className="text-left px-2 py-3 text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
                      Severity
                    </th>
                    <th className="text-left px-2 py-3 text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
                      Message
                    </th>
                    <th className="text-left px-2 py-3 text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
                      Page
                    </th>
                    <th className="text-left px-2 py-3 text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
                      User
                    </th>
                    <th className="text-center px-2 py-3 text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
                      #
                    </th>
                    <th className="text-left px-2 py-3 text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
                      Time
                    </th>
                    <th className="text-center px-2 py-3 text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
                      Status
                    </th>
                    <th className="text-center px-2 py-3 text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
                      Fix
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {errors.map((error) => (
                    <React.Fragment key={error.id}>
                      <tr
                        className={`border-b border-[var(--border-primary)]/50 hover:bg-tertiary/20 transition-all group ${selectedIds.has(error.id) ? "bg-[var(--brand-orange)]/5" : ""} ${!error.resolved ? "border-l-2 border-l-amber-500" : ""}`}
                      >
                        <td className="px-2 py-2.5">
                          <button
                            onClick={() => toggleSelect(error.id)}
                            className="p-1 hover:bg-tertiary rounded transition-all"
                          >
                            {selectedIds.has(error.id) ? (
                              <CheckSquare className="w-3.5 h-3.5 text-[var(--brand-orange)]" />
                            ) : (
                              <Square className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                            )}
                          </button>
                        </td>
                        <td className="px-2 py-2.5">
                          <div className="flex items-center gap-1">
                            <span
                              className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded"
                              style={{
                                color: SEVERITY_CONFIG[error.severity]?.color,
                                background: SEVERITY_CONFIG[error.severity]?.bg,
                              }}
                            >
                              {error.severity}
                            </span>
                            {error.category && (
                              <span
                                className="text-[7px] font-bold px-1 py-0.5 rounded uppercase tracking-wider hidden lg:inline"
                                style={{
                                  color: CATEGORY_CONFIG[error.category]?.color,
                                  background:
                                    CATEGORY_CONFIG[error.category]?.bg,
                                }}
                              >
                                {CATEGORY_CONFIG[error.category]?.label}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-2.5 max-w-[240px]">
                          <button
                            onClick={() => toggleExpand(error.id)}
                            className="text-[9px] font-bold text-[var(--text-primary)] truncate block w-full text-left hover:text-[var(--brand-orange)] transition-all"
                          >
                            {expandedId === error.id ? (
                              <ChevronDown className="w-3 h-3 inline mr-1" />
                            ) : (
                              <ChevronRight className="w-3 h-3 inline mr-1" />
                            )}
                            {error.message || "—"}
                          </button>
                        </td>
                        <td className="px-2 py-2.5">
                          <span className="text-[8px] font-bold text-slate-500 max-w-[100px] truncate block">
                            {error.page || "—"}
                          </span>
                        </td>
                        <td className="px-2 py-2.5">
                          <span className="text-[8px] font-bold text-slate-500">
                            {error.user_name || error.user_role || "—"}
                          </span>
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          {(parseInt(error.occurrence_count) || 1) > 1 ? (
                            <span className="text-[8px] font-black text-orange-400">
                              x{error.occurrence_count}
                            </span>
                          ) : (
                            <span className="text-[8px] text-slate-500">1</span>
                          )}
                        </td>
                        <td className="px-2 py-2.5">
                          <span className="text-[8px] font-bold text-slate-500 whitespace-nowrap">
                            {error.created_at
                              ? new Date(error.created_at).toLocaleString()
                              : "—"}
                          </span>
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          {error.resolved ? (
                            <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
                              Resolved
                            </span>
                          ) : error.task_id ? (
                            <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400">
                              Task
                            </span>
                          ) : (
                            <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400">
                              New
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          {!error.resolved && (
                            <button
                              onClick={() =>
                                handleToggleResolved(error.id, false)
                              }
                              className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-emerald-500/10 transition-all"
                              title="Mark Resolved"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            </button>
                          )}
                        </td>
                      </tr>
                      {/* Expanded detail */}
                      {expandedId === error.id && (
                        <tr>
                          <td
                            colSpan={9}
                            className="px-5 py-4 bg-tertiary/30 border-b border-[var(--border-primary)]"
                          >
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                              {error.page && (
                                <Field label="Page" value={error.page} />
                              )}
                              {error.action_attempted && (
                                <Field
                                  label="Action"
                                  value={error.action_attempted}
                                />
                              )}
                              {error.user_name && (
                                <Field label="User" value={error.user_name} />
                              )}
                              {error.user_role && (
                                <Field label="Role" value={error.user_role} />
                              )}
                              {error.method && (
                                <Field label="Method" value={error.method} />
                              )}
                              {error.endpoint && (
                                <Field
                                  label="Endpoint"
                                  value={error.endpoint}
                                />
                              )}
                              {error.status_code && (
                                <Field
                                  label="Status"
                                  value={String(error.status_code)}
                                />
                              )}
                              {error.category && (
                                <Field
                                  label="Category"
                                  value={
                                    CATEGORY_CONFIG[error.category]?.label ||
                                    error.category
                                  }
                                />
                              )}
                            </div>
                            {error.stack && (
                              <div className="mb-3">
                                <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-1">
                                  Stack
                                </p>
                                <pre className="text-[7px] font-mono text-[var(--text-secondary)] bg-primary rounded-lg p-2.5 overflow-x-auto whitespace-pre-wrap max-h-24 border border-[var(--border-primary)]">
                                  {error.stack}
                                </pre>
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() =>
                                  handleToggleResolved(
                                    error.id,
                                    !!error.resolved,
                                  )
                                }
                                className={`text-[8px] font-black uppercase tracking-widest px-3 py-2 rounded-lg transition-all ${error.resolved ? "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20" : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"}`}
                              >
                                {error.resolved
                                  ? "Mark Unresolved"
                                  : "Mark Resolved"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function Field({ label, value }) {
  return (
    <div className="p-2.5 rounded-lg bg-primary border border-[var(--border-primary)]">
      <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest">
        {label}
      </p>
      <p className="text-[9px] font-bold mt-0.5 text-[var(--text-primary)] break-all">
        {value}
      </p>
    </div>
  );
}

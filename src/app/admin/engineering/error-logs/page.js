"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Bug,
  RefreshCw,
  Search,
  ChevronRight,
  ChevronDown,
  AlertCircle,
  CheckCircle2,
  User,
  Calendar,
  Wrench,
  ArrowRight,
  AlertTriangle,
  X,
  Loader2,
  Copy,
  CheckSquare,
  Square,
  Shield,
  FileText,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useRouter } from "next/navigation";

const SEVERITY_CONFIG = {
  critical: { color: "#ef4444", bg: "rgba(239,68,68,0.1)", label: "Critical" },
  fatal: { color: "#ef4444", bg: "rgba(239,68,68,0.15)", label: "Fatal" },
  error: { color: "#f59e0b", bg: "rgba(245,158,11,0.1)", label: "Error" },
  warning: { color: "#3b82f6", bg: "rgba(59,130,246,0.1)", label: "Warning" },
  info: { color: "#6b7280", bg: "rgba(107,114,128,0.1)", label: "Info" },
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

function formatErrorForAI(error) {
  return `---
Error ID: #${error.id}
Occurrences: ${error.occurrence_count || 1}x
Category: ${error.category || "uncategorized"}
Severity: ${error.severity}
User: ${error.user_name || "Unknown"} (Role: ${error.user_role || "N/A"})
Page: ${error.page || "N/A"}
Action: ${error.action_attempted || "N/A"}
Method: ${error.method || "N/A"}
Endpoint: ${error.endpoint || "N/A"}
Status Code: ${error.status_code || "N/A"}
Time: ${error.created_at ? new Date(error.created_at).toLocaleString() : "N/A"}
Message: ${error.message || "N/A"}
Stack: ${error.stack || "N/A"}
`;
}

export default function EngineeringErrorLogs() {
  const router = useRouter();
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
      if (data.success) {
        setErrors(data.errors || []);
      }
    } catch (e) {
      console.error("Failed to fetch errors", e);
    } finally {
      setLoading(false);
    }
  }, [filterSeverity, filterResolved, filterCategory, search]);

  useEffect(() => {
    fetchErrors();
  }, [fetchErrors]);

  // Selection
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

  // Copy selected
  const copySelected = async () => {
    const selected = errors.filter((e) => selectedIds.has(e.id));
    if (selected.length === 0) return;
    const header = `Error Report — ${selected.length} error(s)\nGenerated: ${new Date().toLocaleString()}\n\n`;
    const body = selected.map(formatErrorForAI).join("\n");
    const full = header + body;
    try {
      await navigator.clipboard.writeText(full);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = full;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const toggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const handleToggleResolved = async (id, currentlyResolved) => {
    try {
      await fetch("/api/errors", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, resolved: !currentlyResolved }),
      });
      fetchErrors();
    } catch (e) {
      console.error("Failed to update error", e);
    }
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
                Engineering Operations
              </span>
            </div>
            <h1 className="text-4xl font-black text-[var(--text-primary)] uppercase tracking-tighter">
              Error Logs
            </h1>
            <p className="text-xs font-bold text-[var(--text-secondary)] opacity-60">
              {errors.length} unique errors · {totalOccurrences} total
              occurrences
            </p>
          </div>
          <div className="flex items-center gap-3">
            {selectedIds.size > 0 && (
              <button
                onClick={copySelected}
                className="flex items-center gap-2 px-4 py-2.5 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:opacity-90 transition-all"
              >
                <Copy className="w-3.5 h-3.5" />{" "}
                {copied ? "Copied!" : `Copy ${selectedIds.size} to AI`}
              </button>
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
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-3 rounded-xl bg-secondary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none"
          >
            <option value="all">All Categories</option>
            <option value="server_error">Server</option>
            <option value="runtime_error">Runtime</option>
            <option value="api_error">API</option>
            <option value="auth_error">Auth</option>
            <option value="network_error">Network</option>
            <option value="validation_error">Validation</option>
            <option value="database_error">Database</option>
            <option value="not_found">Not Found</option>
            <option value="timeout">Timeout</option>
            <option value="build_error">Build</option>
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
              {search ||
              filterSeverity !== "all" ||
              filterResolved !== "all" ||
              filterCategory !== "all"
                ? "No matches"
                : "No errors captured"}
            </p>
            <p className="text-xs font-bold text-slate-500 mt-1">
              Errors will appear here when something goes wrong.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Select All row */}
            <div className="flex items-center gap-2 px-2 py-1">
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

            {errors.map((error) => (
              <div
                key={error.id}
                className={`ios-card !p-0 overflow-hidden border-[var(--border-primary)] hover:border-[var(--brand-orange)]/30 transition-all ${!error.resolved && !error.task_id ? "border-l-4 border-l-amber-500" : ""} ${selectedIds.has(error.id) ? "ring-2 ring-[var(--brand-orange)]" : ""}`}
              >
                {/* Summary Row */}
                <div className="flex items-stretch">
                  {/* Checkbox */}
                  <div className="flex items-center pl-4 pr-2">
                    <button
                      onClick={() => toggleSelect(error.id)}
                      className="p-1 hover:bg-tertiary rounded transition-all"
                    >
                      {selectedIds.has(error.id) ? (
                        <CheckSquare className="w-4 h-4 text-[var(--brand-orange)]" />
                      ) : (
                        <Square className="w-4 h-4 text-[var(--text-secondary)]" />
                      )}
                    </button>
                  </div>

                  <button
                    onClick={() => toggleExpand(error.id)}
                    className="flex-1 flex flex-col lg:flex-row items-stretch text-left py-3 pr-4"
                  >
                    <div className="flex-1 flex items-center gap-3 min-w-0">
                      <div className="flex-shrink-0">
                        {expandedId === error.id ? (
                          <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                          {/* Occurrence count badge */}
                          {(parseInt(error.occurrence_count) || 1) > 1 && (
                            <span className="text-[7px] font-black px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400 uppercase tracking-wider">
                              x{error.occurrence_count}
                            </span>
                          )}
                          {/* Severity badge */}
                          <span
                            className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded"
                            style={{
                              color:
                                SEVERITY_CONFIG[error.severity]?.color ||
                                "#6b7280",
                              background:
                                SEVERITY_CONFIG[error.severity]?.bg ||
                                "rgba(107,114,128,0.1)",
                            }}
                          >
                            {error.severity}
                          </span>
                          {/* Category badge */}
                          {error.category && (
                            <span
                              className="text-[7px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                              style={{
                                color:
                                  CATEGORY_CONFIG[error.category]?.color ||
                                  "#64748b",
                                background:
                                  CATEGORY_CONFIG[error.category]?.bg ||
                                  "rgba(100,116,139,0.05)",
                              }}
                            >
                              {CATEGORY_CONFIG[error.category]?.label ||
                                error.category}
                            </span>
                          )}
                          {/* Status badge */}
                          {error.resolved ? (
                            <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 className="w-2.5 h-2.5" /> Resolved
                            </span>
                          ) : error.task_id ? (
                            <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 flex items-center gap-1">
                              <Wrench className="w-2.5 h-2.5" /> Task #
                              {error.task_id}
                            </span>
                          ) : (
                            <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 flex items-center gap-1">
                              <AlertCircle className="w-2.5 h-2.5" /> New
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] font-bold text-[var(--text-primary)] truncate leading-tight">
                          {error.message || "No message"}
                        </p>
                      </div>
                    </div>
                    <div className="hidden lg:flex items-center gap-3 flex-shrink-0 ml-3 mt-1 lg:mt-0">
                      {error.page && (
                        <span className="text-[8px] font-bold text-slate-500 max-w-[120px] truncate">
                          {error.page}
                        </span>
                      )}
                      {error.user_name && (
                        <span className="text-[8px] font-bold text-slate-500 flex items-center gap-1 whitespace-nowrap">
                          <User className="w-3 h-3" /> {error.user_name}
                        </span>
                      )}
                      <span className="text-[8px] font-bold text-slate-500 flex items-center gap-1 whitespace-nowrap">
                        <Calendar className="w-3 h-3" />{" "}
                        {error.created_at
                          ? new Date(error.created_at).toLocaleString()
                          : "—"}
                      </span>
                    </div>
                  </button>
                </div>

                {/* Expanded Detail */}
                {expandedId === error.id && (
                  <div className="border-t border-[var(--border-primary)] bg-tertiary/50">
                    <div className="p-4 space-y-4">
                      {/* Rich context grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {error.page && (
                          <div className="p-3 rounded-xl bg-primary border border-[var(--border-primary)]">
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">
                              Page
                            </p>
                            <p className="text-[11px] font-bold mt-0.5 text-[var(--text-primary)] break-all">
                              {error.page}
                            </p>
                          </div>
                        )}
                        {error.action_attempted && (
                          <div className="p-3 rounded-xl bg-primary border border-[var(--border-primary)]">
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">
                              Action Attempted
                            </p>
                            <p className="text-[11px] font-bold mt-0.5 text-[var(--text-primary)]">
                              {error.action_attempted}
                            </p>
                          </div>
                        )}
                        {error.user_name && (
                          <div className="p-3 rounded-xl bg-primary border border-[var(--border-primary)]">
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">
                              User
                            </p>
                            <p className="text-[11px] font-bold mt-0.5 text-[var(--text-primary)]">
                              {error.user_name}
                            </p>
                          </div>
                        )}
                        {error.user_role && (
                          <div className="p-3 rounded-xl bg-primary border border-[var(--border-primary)]">
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">
                              User Role
                            </p>
                            <p className="text-[11px] font-bold mt-0.5 text-[var(--text-primary)]">
                              {error.user_role}
                            </p>
                          </div>
                        )}
                        {error.method && (
                          <div className="p-3 rounded-xl bg-primary border border-[var(--border-primary)]">
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">
                              Method
                            </p>
                            <p className="text-[11px] font-bold mt-0.5 text-[var(--text-primary)]">
                              {error.method}
                            </p>
                          </div>
                        )}
                        {error.endpoint && (
                          <div className="p-3 rounded-xl bg-primary border border-[var(--border-primary)]">
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">
                              Endpoint
                            </p>
                            <p className="text-[11px] font-bold mt-0.5 text-[var(--text-primary)] break-all">
                              {error.endpoint}
                            </p>
                          </div>
                        )}
                        {error.status_code && (
                          <div className="p-3 rounded-xl bg-primary border border-[var(--border-primary)]">
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">
                              Status Code
                            </p>
                            <p className="text-[11px] font-bold mt-0.5 text-[var(--text-primary)]">
                              {error.status_code}
                            </p>
                          </div>
                        )}
                        {error.category && (
                          <div className="p-3 rounded-xl bg-primary border border-[var(--border-primary)]">
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">
                              Category
                            </p>
                            <p
                              className="text-[11px] font-bold mt-0.5"
                              style={{
                                color: CATEGORY_CONFIG[error.category]?.color,
                              }}
                            >
                              {CATEGORY_CONFIG[error.category]?.label ||
                                error.category}
                            </p>
                          </div>
                        )}
                        {error.created_at && (
                          <div className="p-3 rounded-xl bg-primary border border-[var(--border-primary)]">
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">
                              Date & Time
                            </p>
                            <p className="text-[11px] font-bold mt-0.5 text-[var(--text-primary)]">
                              {new Date(error.created_at).toLocaleString()}
                            </p>
                          </div>
                        )}
                        {parseInt(error.occurrence_count) > 1 && (
                          <div className="p-3 rounded-xl bg-primary border border-[var(--border-primary)]">
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">
                              Occurrences
                            </p>
                            <p className="text-[11px] font-bold mt-0.5 text-orange-400">
                              {error.occurrence_count}x
                            </p>
                          </div>
                        )}
                        {error.url && (
                          <div className="p-3 rounded-xl bg-primary border border-[var(--border-primary)] md:col-span-2">
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">
                              URL
                            </p>
                            <p className="text-[11px] font-bold mt-0.5 text-[var(--text-primary)] break-all">
                              {error.url}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Stack trace */}
                      {error.stack && (
                        <div>
                          <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2">
                            Stack Trace
                          </p>
                          <pre className="text-[8px] font-mono text-[var(--text-secondary)] bg-primary rounded-xl p-3 overflow-x-auto whitespace-pre-wrap max-h-32 overflow-y-auto border border-[var(--border-primary)]">
                            {error.stack}
                          </pre>
                        </div>
                      )}

                      {/* Linked task */}
                      {error.task_id && (
                        <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/10">
                          <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-1">
                            Linked Development Task
                          </p>
                          <p className="text-[11px] font-bold text-[var(--text-primary)]">
                            Development Task #{error.task_id} has been created
                            for this error.
                          </p>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-3 flex-wrap">
                        {!error.task_id && !error.resolved && (
                          <button
                            onClick={() => {
                              /* Navigate to create task */
                            }}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-[var(--brand-orange)] text-black hover:opacity-90 transition-all"
                          >
                            <Wrench className="w-3.5 h-3.5" /> Create
                            Development Task
                          </button>
                        )}
                        <button
                          onClick={() =>
                            handleToggleResolved(error.id, !!error.resolved)
                          }
                          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all"
                          style={{
                            background: error.resolved
                              ? "rgba(239,68,68,0.15)"
                              : "rgba(100,100,100,0.1)",
                            color: error.resolved
                              ? "#ef4444"
                              : "var(--text-secondary)",
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

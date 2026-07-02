"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Bug,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Copy,
  CheckSquare,
  Square,
  User,
  Calendar,
  AlertCircle,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import DashboardLayout from "@/components/layout/DashboardLayout";

// ─── Constants ───
const SEV = {
  critical: { color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
  error: { color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  warning: { color: "#3b82f6", bg: "rgba(59,130,246,0.1)" },
  info: { color: "#10b981", bg: "rgba(16,185,129,0.1)" },
};

const CAT = {
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
  network_error: {
    color: "#06b6d4",
    bg: "rgba(6,182,212,0.1)",
    label: "Network",
  },
  auth_error: { color: "#8b5cf6", bg: "rgba(139,92,246,0.1)", label: "Auth" },
  database_error: { color: "#ec4899", bg: "rgba(236,72,153,0.1)", label: "DB" },
  not_found: { color: "#64748b", bg: "rgba(100,116,139,0.1)", label: "404" },
  uncategorized: {
    color: "#64748b",
    bg: "rgba(100,116,139,0.05)",
    label: "Other",
  },
  validation_error: {
    color: "#a855f7",
    bg: "rgba(168,85,247,0.1)",
    label: "Validation",
  },
};

// ─── Sub-components ───
function SeverityBadge({ severity }) {
  const c = SEV[severity?.toLowerCase()] || {
    color: "#64748b",
    bg: "rgba(100,116,139,0.05)",
  };
  return (
    <span
      className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded"
      style={{ color: c.color, background: c.bg }}
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

function FieldChip({ label, value }) {
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

// ─── Main Component ───
export default function ErrorLogsView({
  role = "developer",
  activeTab = "error_logs",
}) {
  const { t } = useI18n();
  const isAdmin = role === "super_admin" || role === "admin";

  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("unresolved");
  const [sev, setSev] = useState("all");
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [sel, setSel] = useState(new Set());
  const [copied, setCopied] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState({});
  const [actionLoading, setActionLoading] = useState(false);
  const [dashboardRole, setDashboardRole] = useState(role);

  // Read user role from localStorage so DashboardLayout gets the right role
  useEffect(() => {
    try {
      const saved = localStorage.getItem("user");
      if (saved) {
        const u = JSON.parse(saved);
        setDashboardRole(u.role || role);
      }
    } catch (_) {}
  }, [role]);

  const fetchErrors = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (sev !== "all") p.set("severity", sev);
      if (tab === "resolved") p.set("resolved", "true");
      else if (tab === "unresolved") p.set("resolved", "false");
      if (cat !== "all") p.set("category", cat);
      if (q) p.set("search", q);
      const res = await fetch(`/api/errors?${p.toString()}`);
      const d = await res.json();
      if (d.success) setErrors(d.errors || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [sev, tab, cat, q]);

  useEffect(() => {
    fetchErrors();
  }, [fetchErrors]);

  const allSel = errors.length > 0 && sel.size === errors.length;

  const totalOcc = errors.reduce(
    (s, e) => s + (parseInt(e.occurrence_count) || 1),
    0,
  );

  // ─── Actions ───
  const copySelected = async () => {
    const items = errors.filter((e) => sel.has(e.id));
    if (!items.length) return;
    const body = items
      .map(
        (e) =>
          `---\nID: #${e.id}\nSev: ${e.severity}\nUser: ${e.user_name || "?"} (${e.user_role || "?"})\nPage: ${e.page || "?"}\nAction: ${e.action_attempted || "?"}\nStatus: ${e.status_code || "?"}\nWhen: ${e.created_at ? new Date(e.created_at).toLocaleString() : "?"}\nMsg: ${e.message || "?"}\nStack: ${e.stack || "?"}\n`,
      )
      .join("\n");
    const full = `${items.length} error(s) - ${new Date().toLocaleString()}\n${body}`;
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

  const bulkResolve = async () => {
    for (const id of sel) {
      await fetch("/api/errors", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, resolved: true }),
      }).catch(() => {});
    }
    setSel(new Set());
    fetchErrors();
  };

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
    <DashboardLayout role={dashboardRole} activeTab={activeTab}>
      <div className="space-y-8 pb-20">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-[var(--border-primary)] pb-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Bug className="w-4 h-4 text-[var(--brand-orange)]" />
              <span className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-[0.4em]">
                {isAdmin ? "Error Logs" : "Developer Console"}
              </span>
            </div>
            <h1 className="text-4xl font-black text-[var(--text-primary)] uppercase tracking-tighter">
              Error Logs
            </h1>
            <p className="text-xs font-bold text-[var(--text-secondary)] opacity-60">
              {errors.length} unique &middot; {totalOcc} total
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isAdmin && sel.size > 0 && (
              <>
                <button
                  onClick={bulkResolve}
                  className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-500/20 transition-all"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Resolve {sel.size}
                </button>
                <button
                  onClick={copySelected}
                  className="flex items-center gap-2 px-4 py-2.5 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:opacity-90 transition-all"
                >
                  <Copy className="w-3.5 h-3.5" />{" "}
                  {copied ? "Copied!" : `Copy ${sel.size}`}
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

        {/* Status tabs */}
        <div className="flex gap-1 bg-secondary rounded-xl p-1 border border-[var(--border-primary)] w-fit">
          <button
            onClick={() => setTab("unresolved")}
            className={`px-5 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${tab === "unresolved" ? "bg-[var(--brand-orange)] text-black" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400" /> Open
          </button>
          <button
            onClick={() => setTab("resolved")}
            className={`px-5 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${tab === "resolved" ? "bg-[var(--brand-orange)] text-black" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400" /> Resolved
          </button>
          <button
            onClick={() => setTab("all")}
            className={`px-5 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${tab === "all" ? "bg-[var(--brand-orange)] text-black" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
          >
            All
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search..."
              className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl pl-10 pr-4 py-3 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/50 transition-all"
            />
          </div>
          <select
            value={sev}
            onChange={(e) => setSev(e.target.value)}
            className="px-3 py-3 rounded-xl bg-secondary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none"
          >
            <option value="all">Severity</option>
            <option value="critical">Critical</option>
            <option value="error">Error</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>
          <select
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            className="px-3 py-3 rounded-xl bg-secondary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none"
          >
            <option value="all">Category</option>
            {Object.entries(CAT).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </div>

        {/* Select all bar (admin only) */}
        {isAdmin && errors.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3 bg-tertiary/30 border border-[var(--border-primary)] rounded-xl">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (allSel) setSel(new Set());
                  else setSel(new Set(errors.map((e) => e.id)));
                }}
                className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
              >
                {allSel ? (
                  <CheckSquare className="w-4 h-4" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
                {allSel ? "Deselect" : "Select All"}
              </button>
              {sel.size > 0 && (
                <span className="text-[9px] font-bold text-[var(--brand-orange)]">
                  {sel.size} selected
                </span>
              )}
            </div>
          </div>
        )}

        {/* Loading / Empty / List */}
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
              {sev !== "all" || cat !== "all" || q
                ? "No matches"
                : tab === "resolved"
                  ? "No resolved errors"
                  : "No errors captured"}
            </p>
            <p className="text-xs font-bold text-slate-500 mt-1">
              {sev !== "all" || cat !== "all" || q
                ? "Try different filters"
                : "Errors will appear here when something goes wrong."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {errors.map((error) => (
              <div
                key={error.id}
                className={`ios-card !p-0 overflow-hidden border-[var(--border-primary)] hover:border-[var(--brand-orange)]/30 transition-all ${!error.resolved ? "border-l-4 border-l-amber-500" : ""} ${sel.has(error.id) ? "bg-[var(--brand-orange)]/5" : ""}`}
              >
                {/* Summary Row */}
                <div className="w-full flex flex-col lg:flex-row items-stretch">
                  <button
                    onClick={() => toggleExpand(error.id)}
                    className="flex-1 p-4 flex items-center gap-4 text-left"
                  >
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
                        {error.category && (
                          <span
                            className="text-[7px] font-bold px-1 py-0.5 rounded uppercase tracking-wider"
                            style={{
                              color: CAT[error.category]?.color,
                              background: CAT[error.category]?.bg,
                            }}
                          >
                            {CAT[error.category]?.label}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-[var(--text-primary)] truncate">
                        {error.message || "No message"}
                      </p>
                    </div>
                    <div className="hidden lg:flex items-center gap-4 flex-shrink-0">
                      {error.page && (
                        <span className="text-[8px] font-bold text-slate-500 max-w-[160px] truncate">
                          {error.page}
                        </span>
                      )}
                      {error.user_name && (
                        <span className="text-[8px] font-bold text-slate-500 flex items-center gap-1">
                          <User className="w-3 h-3" /> {error.user_name}
                        </span>
                      )}
                      {(parseInt(error.occurrence_count) || 1) > 1 && (
                        <span className="text-[8px] font-black text-orange-400">
                          x{error.occurrence_count}
                        </span>
                      )}
                      <span className="text-[8px] font-bold text-slate-500 flex items-center gap-1 whitespace-nowrap">
                        <Calendar className="w-3 h-3" />{" "}
                        {error.created_at
                          ? new Date(error.created_at).toLocaleString()
                          : "\u2014"}
                      </span>
                    </div>
                  </button>

                  {/* Admin checkbox column */}
                  {isAdmin && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const n = new Set(sel);
                        if (n.has(error.id)) n.delete(error.id);
                        else n.add(error.id);
                        setSel(n);
                      }}
                      className="p-4 hover:bg-tertiary/30 transition-all flex-shrink-0 border-l border-[var(--border-primary)]"
                    >
                      {sel.has(error.id) ? (
                        <CheckSquare className="w-4 h-4 text-[var(--brand-orange)]" />
                      ) : (
                        <Square className="w-4 h-4 text-[var(--text-secondary)]" />
                      )}
                    </button>
                  )}
                </div>

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

                      {/* Request Details Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {error.page && (
                          <FieldChip label="Page" value={error.page} />
                        )}
                        {error.action_attempted && (
                          <FieldChip
                            label="Action"
                            value={error.action_attempted}
                          />
                        )}
                        {error.user_name && (
                          <FieldChip label="User" value={error.user_name} />
                        )}
                        {error.user_role && (
                          <FieldChip label="Role" value={error.user_role} />
                        )}
                        {error.method && (
                          <FieldChip label="Method" value={error.method} />
                        )}
                        {error.endpoint && (
                          <FieldChip label="Endpoint" value={error.endpoint} />
                        )}
                        {error.status_code && (
                          <FieldChip
                            label="Status"
                            value={String(error.status_code)}
                          />
                        )}
                        {error.user_agent && (
                          <FieldChip
                            label="User Agent"
                            value={error.user_agent}
                          />
                        )}
                        {error.url && (
                          <div className="p-2.5 rounded-lg bg-primary border border-[var(--border-primary)] md:col-span-2">
                            <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest">
                              URL
                            </p>
                            <p className="text-[9px] font-bold mt-0.5 text-[var(--text-primary)] truncate">
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
                              {new Date(error.resolved_at).toLocaleDateString()}
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

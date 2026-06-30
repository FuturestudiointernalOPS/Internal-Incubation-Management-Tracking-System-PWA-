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
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";

const SEV = {
  critical: { color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
  error: { color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  warning: { color: "#3b82f6", bg: "rgba(59,130,246,0.1)" },
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
};

export default function EngineeringErrorLogs() {
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("unresolved");
  const [sev, setSev] = useState("all");
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [sel, setSel] = useState(new Set());
  const [copied, setCopied] = useState(false);

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

  const toggleResolve = async (id, now) => {
    await fetch("/api/errors", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, resolved: !now }),
    }).catch(() => {});
    fetchErrors();
  };

  const totalOcc = errors.reduce(
    (s, e) => s + (parseInt(e.occurrence_count) || 1),
    0,
  );

  return (
    <DashboardLayout role="super_admin" activeTab="engineering">
      <div className="space-y-8 pb-20">
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
              {errors.length} unique · {totalOcc} total
            </p>
          </div>
          <div className="flex items-center gap-3">
            {sel.size > 0 && (
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
              No {tab} errors
            </p>
          </div>
        ) : (
          <div className="ios-card !p-0 border-[var(--border-primary)] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 bg-tertiary/30 border-b border-[var(--border-primary)]">
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

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border-primary)]">
                    <th className="w-8 px-2 py-3"></th>
                    <th className="text-left px-2 py-3 text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
                      Sev
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
                      Fix
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {errors.map((error) => (
                    <React.Fragment key={error.id}>
                      <tr
                        className={`border-b border-[var(--border-primary)]/50 hover:bg-tertiary/20 transition-all ${sel.has(error.id) ? "bg-[var(--brand-orange)]/5" : ""} ${tab !== "resolved" ? "border-l-2 border-l-amber-500" : ""}`}
                      >
                        <td className="px-2 py-2.5">
                          <button
                            onClick={() => {
                              const n = new Set(sel);
                              if (n.has(error.id)) n.delete(error.id);
                              else n.add(error.id);
                              setSel(n);
                            }}
                            className="p-1 hover:bg-tertiary rounded transition-all"
                          >
                            {sel.has(error.id) ? (
                              <CheckSquare className="w-3.5 h-3.5 text-[var(--brand-orange)]" />
                            ) : (
                              <Square className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                            )}
                          </button>
                        </td>
                        <td className="px-2 py-2.5">
                          <span
                            className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded"
                            style={{
                              color: SEV[error.severity]?.color,
                              background: SEV[error.severity]?.bg,
                            }}
                          >
                            {error.severity}
                          </span>
                          {error.category && (
                            <span
                              className="text-[7px] font-bold px-1 py-0.5 rounded uppercase tracking-wider ml-1 hidden lg:inline"
                              style={{
                                color: CAT[error.category]?.color,
                                background: CAT[error.category]?.bg,
                              }}
                            >
                              {CAT[error.category]?.label}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-2.5 max-w-[240px]">
                          <button
                            onClick={() =>
                              setExpandedId((p) =>
                                p === error.id ? null : error.id,
                              )
                            }
                            className="text-[9px] font-bold text-[var(--text-primary)] truncate block w-full text-left hover:text-[var(--brand-orange)] transition-all"
                          >
                            {expandedId === error.id ? (
                              <ChevronDown className="w-3 h-3 inline mr-1" />
                            ) : (
                              <ChevronRight className="w-3 h-3 inline mr-1" />
                            )}
                            {error.message || "\u2014"}
                          </button>
                        </td>
                        <td className="px-2 py-2.5">
                          <span className="text-[8px] font-bold text-slate-500 max-w-[100px] truncate block">
                            {error.page || "\u2014"}
                          </span>
                        </td>
                        <td className="px-2 py-2.5">
                          <span className="text-[8px] font-bold text-slate-500">
                            {error.user_name || error.user_role || "\u2014"}
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
                              : "\u2014"}
                          </span>
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          {tab !== "resolved" ? (
                            <button
                              onClick={() => toggleResolve(error.id, false)}
                              className="p-1.5 rounded-lg hover:bg-emerald-500/10 transition-all"
                              title="Resolve"
                            >
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            </button>
                          ) : (
                            <button
                              onClick={() => toggleResolve(error.id, true)}
                              className="p-1.5 rounded-lg hover:bg-amber-500/10 transition-all"
                              title="Reopen"
                            >
                              <span className="text-[10px] font-black text-amber-400">
                                \u21BA
                              </span>
                            </button>
                          )}
                        </td>
                      </tr>
                      {expandedId === error.id && (
                        <tr>
                          <td
                            colSpan={9}
                            className="px-5 py-4 bg-tertiary/30 border-b border-[var(--border-primary)]"
                          >
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                              {error.page && <F label="Page" v={error.page} />}
                              {error.action_attempted && (
                                <F label="Action" v={error.action_attempted} />
                              )}
                              {error.user_name && (
                                <F label="User" v={error.user_name} />
                              )}
                              {error.user_role && (
                                <F label="Role" v={error.user_role} />
                              )}
                              {error.method && (
                                <F label="Method" v={error.method} />
                              )}
                              {error.endpoint && (
                                <F label="Endpoint" v={error.endpoint} />
                              )}
                              {error.status_code && (
                                <F
                                  label="Status"
                                  v={String(error.status_code)}
                                />
                              )}
                            </div>
                            {error.stack && (
                              <pre className="text-[7px] font-mono text-[var(--text-secondary)] bg-primary rounded-lg p-2.5 overflow-x-auto whitespace-pre-wrap max-h-24 border border-[var(--border-primary)] mb-3">
                                {error.stack}
                              </pre>
                            )}
                            <button
                              onClick={() =>
                                toggleResolve(error.id, !!error.resolved)
                              }
                              className="text-[8px] font-black uppercase tracking-widest px-3 py-2 rounded-lg transition-all bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                            >
                              {error.resolved ? "Reopen" : "Mark Resolved"}
                            </button>
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

function F({ label, v }) {
  return (
    <div className="p-2.5 rounded-lg bg-primary border border-[var(--border-primary)]">
      <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest">
        {label}
      </p>
      <p className="text-[9px] font-bold mt-0.5 text-[var(--text-primary)] break-all">
        {v}
      </p>
    </div>
  );
}

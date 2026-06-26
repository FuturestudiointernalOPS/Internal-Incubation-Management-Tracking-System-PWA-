"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Shield,
  Search,
  User,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  X,
  AlertTriangle,
  Clock,
  Plus,
  Trash2,
  Loader2,
  RefreshCw,
  Info,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";

const ACCESS_LEVELS = {
  NONE: 0,
  VIEW: 1,
  CREATE: 2,
  EDIT: 3,
  DELETE: 4,
  FULL: 5,
};
const ACCESS_LABELS = {
  0: "None",
  1: "View",
  2: "Create",
  3: "Edit",
  4: "Delete",
  5: "Full",
};
const ACCESS_SHORT = { 0: "—", 1: "V", 2: "C", 3: "E", 4: "D", 5: "All" };

const LEVELS_ORDER = [0, 1, 2, 3, 4, 5];

// Module grouping
const MODULE_CATEGORIES = [
  {
    label: "Content",
    modules: ["projects", "programs", "reports", "contacts"],
  },
  {
    label: "People",
    modules: ["users", "messaging", "internal_comms"],
  },
  {
    label: "System",
    modules: ["permissions", "engineering", "finance", "settings"],
  },
];

export default function PermissionManager() {
  const [activeTab, setActiveTab] = useState("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userPerms, setUserPerms] = useState(null);
  const [loadingPerms, setLoadingPerms] = useState(false);
  const [modules, setModules] = useState({});
  const [expandedModules, setExpandedModules] = useState({});
  const [actionMsg, setActionMsg] = useState("");
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    fetchModules();
  }, []);

  const fetchModules = async () => {
    try {
      const res = await fetch("/api/engineering/permissions");
      const data = await res.json();
      if (data.success) setModules(data.modules || {});
    } catch (e) {
      console.error("Failed to fetch modules", e);
    }
  };

  const searchUsers = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(
        `/api/contacts?search=${encodeURIComponent(searchQuery)}`,
      );
      const data = await res.json();
      if (data.success) setSearchResults(data.contacts || []);
    } catch (e) {
      console.error("Search failed", e);
    } finally {
      setSearching(false);
    }
  };

  const selectUser = async (user) => {
    setSelectedUser(user);
    setLoadingPerms(true);
    setActionMsg("");
    setActionError("");
    try {
      const res = await fetch(
        `/api/engineering/permissions?user_cid=${user.cid}`,
      );
      const data = await res.json();
      if (data.success) {
        setUserPerms(data);
        // Auto-expand all modules
        const expanded = {};
        Object.keys(data.effectivePermissions || {}).forEach((key) => {
          expanded[key] = true;
        });
        setExpandedModules(expanded);
      }
    } catch (e) {
      console.error("Failed to fetch user permissions", e);
    } finally {
      setLoadingPerms(false);
    }
  };

  const getEffectiveLevel = (module, capability) => {
    return userPerms?.effectivePermissions?.[module]?.[capability] ?? 0;
  };

  const getOrigin = (module, capability) => {
    const grants = userPerms?.individualGrants || [];
    const restrictions = userPerms?.individualRestrictions || [];
    if (
      restrictions.some(
        (r) => r.module === module && r.capability === capability,
      )
    )
      return "restricted";
    if (grants.some((g) => g.module === module && g.capability === capability))
      return "granted";
    return "inherited";
  };

  const handleQuickAction = async (action, module, capability, level) => {
    setActionMsg("");
    setActionError("");
    try {
      const res = await fetch("/api/engineering/permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          user_cid: selectedUser.cid,
          module,
          capability,
          access_level: level ?? 1,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg(`${action} successful`);
        selectUser(selectedUser);
      } else {
        setActionError(data.error || "Action failed");
      }
    } catch (e) {
      setActionError("Network error");
    }
  };

  return (
    <DashboardLayout role="super_admin" activeTab="engineering">
      <div className="space-y-8 pb-20">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-[var(--border-primary)] pb-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[var(--brand-orange)]" />
              <span className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-[0.4em]">
                Authorization
              </span>
            </div>
            <h1 className="text-4xl font-black text-[var(--text-primary)] uppercase tracking-tighter">
              Permission Manager
            </h1>
            <p className="text-xs font-bold text-[var(--text-secondary)] opacity-60">
              Manage roles, groups, capabilities, and individual permissions
            </p>
          </div>
        </header>

        {/* Tabs */}
        <div className="flex gap-1 bg-secondary rounded-xl p-1 border border-[var(--border-primary)] w-fit">
          <button
            onClick={() => setActiveTab("search")}
            className={`px-5 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === "search" ? "bg-[var(--brand-orange)] text-black" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
          >
            User Search
          </button>
          <button
            onClick={() => setActiveTab("roles")}
            className={`px-5 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === "roles" ? "bg-[var(--brand-orange)] text-black" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
          >
            Role Defaults
          </button>
          <button
            onClick={() => setActiveTab("seed")}
            className={`px-5 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === "seed" ? "bg-[var(--brand-orange)] text-black" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
          >
            Initialize
          </button>
        </div>

        {activeTab === "search" && (
          <div className="space-y-6">
            {/* Search */}
            <div className="flex gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchUsers()}
                  placeholder="Search by name, email, or CID..."
                  className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl pl-10 pr-4 py-3 text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/50 font-bold text-xs transition-all"
                />
              </div>
              <button
                onClick={searchUsers}
                disabled={searching}
                className="px-6 py-3 rounded-xl bg-[var(--brand-orange)] text-black text-[9px] font-black uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50"
              >
                {searching ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Search"
                )}
              </button>
            </div>

            {/* Results */}
            {searchResults.length > 0 && !selectedUser && (
              <div className="space-y-1">
                {searchResults.map((u) => (
                  <button
                    key={u.cid}
                    onClick={() => selectUser(u)}
                    className="w-full ios-card !p-4 border-[var(--border-primary)] hover:border-[var(--brand-orange)]/30 transition-all text-left flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                        <User className="w-5 h-5 text-[var(--brand-orange)]" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight">
                          {u.name}
                        </p>
                        <p className="text-[10px] font-bold text-[var(--text-secondary)]">
                          {u.email} · {u.role} · {u.status}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
                  </button>
                ))}
              </div>
            )}

            {/* User Permission Panel */}
            {selectedUser && userPerms && (
              <div className="space-y-6">
                {/* User info bar */}
                <div className="ios-card !p-5 border-[var(--border-primary)] flex items-center justify-between bg-secondary/50">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-orange-500/10 flex items-center justify-center">
                      <User className="w-7 h-7 text-[var(--brand-orange)]" />
                    </div>
                    <div>
                      <p className="text-lg font-black text-[var(--text-primary)] uppercase tracking-tight">
                        {userPerms.user.name}
                      </p>
                      <p className="text-[10px] font-bold text-[var(--text-secondary)]">
                        {userPerms.user.email}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[8px] font-bold px-2 py-0.5 rounded bg-orange-500/10 text-[var(--brand-orange)] uppercase tracking-wider">
                          {userPerms.user.role}
                        </span>
                        {(userPerms.groups || []).map((g) => (
                          <span
                            key={g}
                            className="text-[8px] font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 uppercase tracking-wider"
                          >
                            {g}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {userPerms.user.role !== "super_admin" ? (
                      <button
                        onClick={async () => {
                          setActionMsg("");
                          setActionError("");
                          try {
                            const res = await fetch(
                              "/api/engineering/permissions",
                              {
                                method: "PUT",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  action: "promote_super_admin",
                                  user_cid: selectedUser.cid,
                                }),
                              },
                            );
                            const data = await res.json();
                            if (data.success) {
                              setActionMsg("Promoted to Super Admin");
                              selectUser(selectedUser);
                            } else setActionError(data.error || "Failed");
                          } catch (e) {
                            setActionError("Network error");
                          }
                        }}
                        className="px-3 py-2 rounded-xl bg-purple-500/10 text-purple-400 text-[8px] font-black uppercase tracking-widest hover:bg-purple-500/20 transition-all"
                      >
                        <Shield className="w-3 h-3 inline mr-1" />
                        Make Super Admin
                      </button>
                    ) : (
                      <button
                        onClick={async () => {
                          setActionMsg("");
                          setActionError("");
                          try {
                            const res = await fetch(
                              "/api/engineering/permissions",
                              {
                                method: "PUT",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  action: "remove_super_admin",
                                  user_cid: selectedUser.cid,
                                }),
                              },
                            );
                            const data = await res.json();
                            if (data.success) {
                              setActionMsg("Super Admin status removed");
                              selectUser(selectedUser);
                            } else setActionError(data.error || "Failed");
                          } catch (e) {
                            setActionError("Network error");
                          }
                        }}
                        className="px-3 py-2 rounded-xl bg-red-500/10 text-red-400 text-[8px] font-black uppercase tracking-widest hover:bg-red-500/20 transition-all"
                      >
                        <Shield className="w-3 h-3 inline mr-1" />
                        Remove Super Admin
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setSelectedUser(null);
                        setUserPerms(null);
                      }}
                      className="p-2 hover:bg-tertiary rounded-lg transition-all"
                    >
                      <X className="w-4 h-4 text-[var(--text-secondary)]" />
                    </button>
                  </div>
                </div>

                {/* Status messages */}
                {actionMsg && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <p className="text-[10px] font-bold text-emerald-400">
                      {actionMsg}
                    </p>
                  </div>
                )}
                {actionError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                    <p className="text-[10px] font-bold text-red-400">
                      {actionError}
                    </p>
                  </div>
                )}

                {/* Legend */}
                <div className="flex items-center gap-4 text-[8px] font-bold text-slate-500 uppercase tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-slate-400" />{" "}
                    Inherited
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />{" "}
                    Individual Grant
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-400" />{" "}
                    Restricted
                  </span>
                </div>

                {/* Permission Tables */}
                {loadingPerms ? (
                  <div className="flex items-center justify-center py-20">
                    <div
                      className="w-6 h-6 border-2 border-t-[var(--brand-orange)] rounded-full animate-spin"
                      style={{
                        borderColor: "rgba(255,102,0,0.1)",
                        borderTopColor: "var(--brand-orange)",
                      }}
                    />
                  </div>
                ) : (
                  <div className="space-y-8">
                    {MODULE_CATEGORIES.map((category) => (
                      <div key={category.label} className="space-y-3">
                        <h3 className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-[0.3em] opacity-50 pl-1">
                          {category.label}
                        </h3>
                        {category.modules.map((modKey) => {
                          const mod = modules[modKey];
                          if (!mod) return null;
                          const caps = mod.capabilities || [];
                          const isExpanded = expandedModules[modKey] !== false;

                          return (
                            <div
                              key={modKey}
                              className="ios-card !p-0 border-[var(--border-primary)] overflow-hidden"
                            >
                              {/* Module header */}
                              <button
                                onClick={() =>
                                  setExpandedModules((prev) => ({
                                    ...prev,
                                    [modKey]: !prev[modKey],
                                  }))
                                }
                                className="w-full flex items-center justify-between px-5 py-4 bg-tertiary/30 hover:bg-tertiary/50 transition-all border-b border-[var(--border-primary)]"
                              >
                                <div className="flex items-center gap-3">
                                  {isExpanded ? (
                                    <ChevronDown className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                                  ) : (
                                    <ChevronRight className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                                  )}
                                  <span className="text-xs font-black text-[var(--text-primary)] uppercase tracking-wider">
                                    {mod.name}
                                  </span>
                                </div>
                                <span className="text-[8px] font-bold text-slate-500">
                                  {caps.length} capabilities
                                </span>
                              </button>

                              {isExpanded && (
                                <div className="overflow-x-auto">
                                  <table className="w-full border-collapse">
                                    <thead>
                                      <tr className="border-b border-[var(--border-primary)]">
                                        <th className="text-left px-5 py-3 text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest w-40">
                                          Capability
                                        </th>
                                        {LEVELS_ORDER.map((level) => (
                                          <th
                                            key={level}
                                            className="px-3 py-3 text-center text-[8px] font-black uppercase tracking-widest whitespace-nowrap"
                                            style={{
                                              color:
                                                level === 0
                                                  ? "var(--text-secondary)"
                                                  : ACCESS_COLORS[level],
                                            }}
                                          >
                                            {ACCESS_LABELS[level]}
                                          </th>
                                        ))}
                                        <th className="px-3 py-3 text-center text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest w-24">
                                          Actions
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {caps.map((cap) => {
                                        const effectiveLevel =
                                          getEffectiveLevel(modKey, cap);
                                        const origin = getOrigin(modKey, cap);

                                        return (
                                          <tr
                                            key={cap}
                                            className="group border-b border-[var(--border-primary)]/50 last:border-b-0 hover:bg-tertiary/20 transition-all"
                                          >
                                            {/* Capability name */}
                                            <td className="px-5 py-3">
                                              <div className="flex items-center gap-2">
                                                {origin === "granted" && (
                                                  <span
                                                    className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"
                                                    title="Individual grant"
                                                  />
                                                )}
                                                {origin === "restricted" && (
                                                  <span
                                                    className="w-2 h-2 rounded-full bg-red-400 shrink-0"
                                                    title="Restricted"
                                                  />
                                                )}
                                                {origin === "inherited" && (
                                                  <span
                                                    className="w-2 h-2 rounded-full bg-slate-400 shrink-0"
                                                    title="Inherited from role/group"
                                                  />
                                                )}
                                                <span className="text-[9px] font-bold text-[var(--text-primary)] uppercase tracking-wider">
                                                  {cap.replace(/_/g, " ")}
                                                </span>
                                              </div>
                                            </td>

                                            {/* Access level radio cells */}
                                            {LEVELS_ORDER.map((level) => {
                                              const isActive =
                                                effectiveLevel === level;
                                              const isClickable =
                                                level !== effectiveLevel;
                                              return (
                                                <td
                                                  key={level}
                                                  className={`px-3 py-3 text-center ${isClickable ? "cursor-pointer" : ""}`}
                                                  onClick={() => {
                                                    if (
                                                      origin === "restricted"
                                                    ) {
                                                      handleQuickAction(
                                                        "unrestrict",
                                                        modKey,
                                                        cap,
                                                      );
                                                    } else if (
                                                      level === 0 &&
                                                      effectiveLevel > 0
                                                    ) {
                                                      handleQuickAction(
                                                        "restrict",
                                                        modKey,
                                                        cap,
                                                        0,
                                                      );
                                                    } else if (level > 0) {
                                                      handleQuickAction(
                                                        "grant",
                                                        modKey,
                                                        cap,
                                                        level,
                                                      );
                                                    }
                                                  }}
                                                >
                                                  {origin === "restricted" &&
                                                  level === 0 ? (
                                                    <div
                                                      className="w-6 h-6 rounded-lg bg-red-500/20 border border-red-500/40 flex items-center justify-center mx-auto cursor-pointer hover:bg-red-500/30 transition-all"
                                                      title="Restricted — click to unrestrict"
                                                    >
                                                      <X className="w-3 h-3 text-red-400" />
                                                    </div>
                                                  ) : isActive &&
                                                    origin === "granted" ? (
                                                    <div className="w-6 h-6 rounded-lg bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center mx-auto">
                                                      <span className="text-[8px] font-black text-emerald-400">
                                                        {ACCESS_SHORT[level]}
                                                      </span>
                                                    </div>
                                                  ) : isActive &&
                                                    origin === "inherited" ? (
                                                    <div className="w-6 h-6 rounded-lg bg-slate-500/20 border border-slate-500/40 flex items-center justify-center mx-auto">
                                                      <span className="text-[8px] font-black text-slate-400">
                                                        {ACCESS_SHORT[level]}
                                                      </span>
                                                    </div>
                                                  ) : isActive ? (
                                                    <div
                                                      className="w-6 h-6 rounded-lg border-2 flex items-center justify-center mx-auto"
                                                      style={{
                                                        borderColor:
                                                          ACCESS_COLORS[level],
                                                        background: `${ACCESS_COLORS[level]}15`,
                                                      }}
                                                    >
                                                      <span
                                                        className="text-[8px] font-black"
                                                        style={{
                                                          color:
                                                            ACCESS_COLORS[
                                                              level
                                                            ],
                                                        }}
                                                      >
                                                        {ACCESS_SHORT[level]}
                                                      </span>
                                                    </div>
                                                  ) : level === 0 ? (
                                                    <button
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleQuickAction(
                                                          "restrict",
                                                          modKey,
                                                          cap,
                                                          0,
                                                        );
                                                      }}
                                                      className="w-6 h-6 rounded-lg border border-dashed border-slate-600/30 flex items-center justify-center mx-auto hover:border-red-400/40 hover:bg-red-500/5 transition-all opacity-0 group-hover:opacity-100 hover:opacity-100"
                                                      title="Restrict"
                                                    >
                                                      <X className="w-2.5 h-2.5 text-slate-600" />
                                                    </button>
                                                  ) : (
                                                    <button
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleQuickAction(
                                                          "grant",
                                                          modKey,
                                                          cap,
                                                          level,
                                                        );
                                                      }}
                                                      className="w-6 h-6 rounded-lg border border-dashed border-slate-600/30 flex items-center justify-center mx-auto hover:border-emerald-400/40 hover:bg-emerald-500/5 transition-all opacity-0 group-hover:opacity-100 hover:opacity-100"
                                                      title={`Set to ${ACCESS_LABELS[level]}`}
                                                    >
                                                      <Plus className="w-2.5 h-2.5 text-slate-600" />
                                                    </button>
                                                  )}
                                                </td>
                                              );
                                            })}

                                            {/* Actions column */}
                                            <td className="px-3 py-3 text-center">
                                              <div className="flex items-center justify-center gap-1">
                                                {origin === "granted" && (
                                                  <button
                                                    onClick={() =>
                                                      handleQuickAction(
                                                        "revoke",
                                                        modKey,
                                                        cap,
                                                      )
                                                    }
                                                    className="p-1.5 rounded-lg hover:bg-red-500/10 transition-all"
                                                    title="Revoke grant"
                                                  >
                                                    <Trash2 className="w-3 h-3 text-red-400" />
                                                  </button>
                                                )}
                                                {origin === "restricted" && (
                                                  <button
                                                    onClick={() =>
                                                      handleQuickAction(
                                                        "unrestrict",
                                                        modKey,
                                                        cap,
                                                      )
                                                    }
                                                    className="p-1.5 rounded-lg hover:bg-emerald-500/10 transition-all"
                                                    title="Remove restriction"
                                                  >
                                                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                                  </button>
                                                )}
                                              </div>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "roles" && <RoleDefaultsView />}
        {activeTab === "seed" && <SeedView />}
      </div>
    </DashboardLayout>
  );
}

function RoleDefaultsView() {
  const [roleDefaults, setRoleDefaults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      try {
        const res = await fetch("/api/engineering/permissions");
        const data = await res.json();
        if (data.success) setRoleDefaults(data.roleDefaults || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, []);

  if (loading)
    return (
      <div className="flex items-center justify-center py-10">
        <div
          className="w-6 h-6 border-2 border-t-[var(--brand-orange)] rounded-full animate-spin"
          style={{
            borderColor: "rgba(255,102,0,0.1)",
            borderTopColor: "var(--brand-orange)",
          }}
        />
      </div>
    );

  const roles = [...new Set(roleDefaults.map((r) => r.role))];

  if (roles.length === 0) {
    return (
      <div className="py-10 text-center opacity-40">
        <Shield className="w-12 h-12 text-slate-500 mx-auto mb-3" />
        <p className="text-sm font-black text-[var(--text-primary)] uppercase">
          No defaults seeded
        </p>
        <p className="text-[10px] font-bold text-slate-500 mt-1">
          Go to Initialize tab to seed default role capabilities
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-xs font-bold text-[var(--text-secondary)]">
        Baseline permissions per role. These apply to every user with that role.
      </p>
      {roles.map((role) => {
        const caps = roleDefaults.filter((r) => r.role === role);
        const modules = [...new Set(caps.map((c) => c.module))];
        return (
          <div
            key={role}
            className="ios-card !p-0 border-[var(--border-primary)] overflow-hidden"
          >
            <div className="px-5 py-4 bg-tertiary/30 border-b border-[var(--border-primary)]">
              <h3 className="text-xs font-black text-[var(--brand-orange)] uppercase tracking-wider">
                {role}
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border-primary)]">
                    <th className="text-left px-5 py-3 text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
                      Module
                    </th>
                    <th className="text-left px-5 py-3 text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
                      Capability
                    </th>
                    <th className="text-left px-5 py-3 text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
                      Access Level
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {modules.map((mod) =>
                    caps
                      .filter((c) => c.module === mod)
                      .map((c, i) => (
                        <tr
                          key={`${mod}-${c.capability}`}
                          className="border-b border-[var(--border-primary)]/50 last:border-b-0 hover:bg-tertiary/20 transition-all"
                        >
                          {i === 0 && (
                            <td
                              className="px-5 py-3 text-[9px] font-black text-[var(--text-primary)] uppercase tracking-wider"
                              rowSpan={
                                caps.filter((c) => c.module === mod).length
                              }
                            >
                              {mod}
                            </td>
                          )}
                          <td className="px-5 py-3 text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                            {c.capability.replace(/_/g, " ")}
                          </td>
                          <td className="px-5 py-3">
                            <span
                              className={`text-[9px] font-black ${ACCESS_COLORS[c.access_level] || "text-slate-500"}`}
                            >
                              {ACCESS_LABELS[c.access_level] || "None"}
                            </span>
                          </td>
                        </tr>
                      )),
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SeedView() {
  const [actionMsg, setActionMsg] = useState("");
  const [actionError, setActionError] = useState("");

  return (
    <div className="max-w-md space-y-6">
      <p className="text-xs font-bold text-[var(--text-secondary)]">
        Seeds default capabilities for core roles (super_admin, staff,
        participant). Safe to run multiple times.
      </p>
      <button
        onClick={async () => {
          setActionMsg("");
          setActionError("");
          try {
            const res = await fetch("/api/engineering/permissions/seed", {
              method: "POST",
            });
            const data = await res.json();
            if (data.success) setActionMsg("Defaults seeded successfully!");
            else setActionError(data.error || "Seed failed");
          } catch (e) {
            setActionError("Network error");
          }
        }}
        className="px-6 py-3 rounded-xl bg-[var(--brand-orange)] text-black text-[9px] font-black uppercase tracking-widest hover:opacity-90 transition-all"
      >
        Seed Default Role Capabilities
      </button>
      {actionMsg && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <p className="text-[10px] font-bold text-emerald-400">{actionMsg}</p>
        </div>
      )}
      {actionError && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
          <p className="text-[10px] font-bold text-red-400">{actionError}</p>
        </div>
      )}
    </div>
  );
}

const ACCESS_COLORS = {
  0: "text-slate-500",
  1: "text-blue-400",
  2: "text-emerald-400",
  3: "text-amber-400",
  4: "text-red-400",
  5: "text-purple-400",
};


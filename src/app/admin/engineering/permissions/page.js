"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Shield,
  Search,
  RefreshCw,
  User,
  ChevronRight,
  CheckCircle2,
  X,
  AlertTriangle,
  Clock,
  Plus,
  Trash2,
  Loader2,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";

const ACCESS_LEVELS = { NONE: 0, VIEW: 1, CREATE: 2, EDIT: 3, DELETE: 4, FULL: 5 };
const ACCESS_LABELS = { 0: "None", 1: "View", 2: "Create", 3: "Edit", 4: "Delete", 5: "Full" };
const ACCESS_COLORS = {
  0: "text-slate-500",
  1: "text-blue-400",
  2: "text-emerald-400",
  3: "text-amber-400",
  4: "text-red-400",
  5: "text-purple-400",
};

export default function PermissionManager() {
  const [activeTab, setActiveTab] = useState("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userPerms, setUserPerms] = useState(null);
  const [loadingPerms, setLoadingPerms] = useState(false);
  const [modules, setModules] = useState({});
  const [roleDefaults, setRoleDefaults] = useState([]);
  const [groupDefaults, setGroupDefaults] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [actionMsg, setActionMsg] = useState("");
  const [actionError, setActionError] = useState("");
  const [showGrantModal, setShowGrantModal] = useState(null);
  const [grantModule, setGrantModule] = useState("");
  const [grantCap, setGrantCap] = useState("");
  const [grantLevel, setGrantLevel] = useState(1);
  const [grantExpiry, setGrantExpiry] = useState("");
  const [granting, setGranting] = useState(false);

  useEffect(() => {
    fetchModules();
  }, []);

  const fetchModules = async () => {
    try {
      const res = await fetch("/api/engineering/permissions");
      const data = await res.json();
      if (data.success) {
        setModules(data.modules || {});
        setRoleDefaults(data.roleDefaults || []);
        setGroupDefaults(data.groupDefaults || []);
      }
    } catch (e) {
      console.error("Failed to fetch modules", e);
    }
  };

  const searchUsers = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/contacts?search=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (data.success) {
        setSearchResults((data.contacts || []).filter((c) => c.role !== "participant" || searchQuery.length > 0));
      }
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
      const res = await fetch(`/api/engineering/permissions?user_cid=${user.cid}`);
      const data = await res.json();
      if (data.success) {
        setUserPerms(data);
      }
    } catch (e) {
      console.error("Failed to fetch user permissions", e);
    } finally {
      setLoadingPerms(false);
    }
  };

  const fetchAuditLog = async (cid) => {
    try {
      const res = await fetch(`/api/engineering/permissions/audit?target_cid=${cid}&limit=50`);
      const data = await res.json();
      if (data.success) setAuditLog(data.entries || []);
    } catch (e) {
      console.error("Failed to fetch audit log", e);
    }
  };

  const handlePermissionAction = async (action, module, capability, level, expiry) => {
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
          access_level: level,
          expires_at: expiry || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg(`${action} successful`);
        selectUser(selectedUser);
        setShowGrantModal(null);
      } else {
        setActionError(data.error || "Action failed");
      }
    } catch (e) {
      setActionError("Network error");
    }
  };

  const getEffectiveLevel = (module, capability) => {
    if (!userPerms?.effectivePermissions?.[module]) return 0;
    return userPerms.effectivePermissions[module][capability] || 0;
  };

  const isGranted = (module, capability) => {
    return userPerms?.individualGrants?.some(
      (g) => g.module === module && g.capability === capability
    );
  };

  const isRestricted = (module, capability) => {
    return userPerms?.individualRestrictions?.some(
      (r) => r.module === module && r.capability === capability
    );
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
          <button onClick={() => setActiveTab("search")} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === "search" ? "bg-[var(--brand-orange)] text-black" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}>User Search</button>
          <button onClick={() => setActiveTab("roles")} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === "roles" ? "bg-[var(--brand-orange)] text-black" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}>Role Defaults</button>
          <button onClick={() => setActiveTab("seed")} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === "seed" ? "bg-[var(--brand-orange)] text-black" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}>Initialize</button>
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
              <button onClick={searchUsers} disabled={searching} className="px-6 py-3 rounded-xl bg-[var(--brand-orange)] text-black text-[9px] font-black uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50">
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
              </button>
            </div>

            {/* Results list */}
            {searchResults.length > 0 && !selectedUser && (
              <div className="space-y-2">
                {searchResults.map((u) => (
                  <button key={u.cid} onClick={() => selectUser(u)} className="w-full ios-card !p-4 border-[var(--border-primary)] hover:border-[var(--brand-orange)]/30 transition-all text-left flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                        <User className="w-5 h-5 text-[var(--brand-orange)]" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight">{u.name}</p>
                        <p className="text-[10px] font-bold text-[var(--text-secondary)]">{u.email} · {u.role} · {u.status}</p>
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
                <div className="ios-card !p-4 border-[var(--border-primary)] flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center">
                      <User className="w-6 h-6 text-[var(--brand-orange)]" />
                    </div>
                    <div>
                      <p className="text-base font-black text-[var(--text-primary)] uppercase tracking-tight">{userPerms.user.name}</p>
                      <p className="text-[10px] font-bold text-[var(--text-secondary)]">{userPerms.user.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-orange-500/10 text-[var(--brand-orange)] uppercase tracking-wider">{userPerms.user.role}</span>
                        {userPerms.groups.map((g) => (
                          <span key={g} className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 uppercase tracking-wider">{g}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => fetchAuditLog(selectedUser.cid)} className="px-3 py-2 rounded-xl bg-secondary border border-[var(--border-primary)] text-[8px] font-black uppercase tracking-widest hover:bg-tertiary transition-all">Audit Log</button>
                    <button onClick={() => { setSelectedUser(null); setUserPerms(null); }} className="p-2 hover:bg-tertiary rounded-lg transition-all"><X className="w-4 h-4 text-[var(--text-secondary)]" /></button>
                  </div>
                </div>

                {actionMsg && <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20"><p className="text-[10px] font-bold text-emerald-400">{actionMsg}</p></div>}
                {actionError && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20"><p className="text-[10px] font-bold text-red-400">{actionError}</p></div>}

                {/* Permission Matrix */}
                {loadingPerms ? (
                  <div className="flex items-center justify-center py-10">
                    <div className="w-6 h-6 border-2 border-t-[var(--brand-orange)] rounded-full animate-spin" style={{ borderColor: "rgba(255,102,0,0.1)", borderTopColor: "var(--brand-orange)" }} />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(modules).map(([modKey, mod]) => (
                      <div key={modKey} className="ios-card !p-0 border-[var(--border-primary)] overflow-hidden">
                        <div className="p-4 bg-tertiary/50 border-b border-[var(--border-primary)]">
                          <h3 className="text-[10px] font-black text-[var(--text-primary)] uppercase tracking-wider">{mod.name}</h3>
                        </div>
                        <div className="p-4">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {(mod.capabilities || []).map((cap) => {
                              const level = getEffectiveLevel(modKey, cap);
                              const granted = isGranted(modKey, cap);
                              const restricted = isRestricted(modKey, cap);
                              return (
                                <div key={cap} className={`p-2 rounded-lg border ${restricted ? "border-red-500/30 bg-red-500/5" : granted ? "border-emerald-500/30 bg-emerald-500/5" : "border-[var(--border-primary)] bg-primary"} flex items-center justify-between`}>
                                  <div>
                                    <p className="text-[8px] font-bold text-[var(--text-primary)] uppercase tracking-wider">{cap.replace(/_/g, " ")}</p>
                                    <p className={`text-[8px] font-black ${ACCESS_COLORS[level] || "text-slate-500"}`}>{ACCESS_LABELS[level] || "None"}</p>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    {granted && <span className="text-[7px] text-emerald-400 font-black">+</span>}
                                    {restricted && <span className="text-[7px] text-red-400 font-black">-</span>}
                                    <button onClick={() => { setShowGrantModal({ module: modKey, capability: cap, currentLevel: level }); setGrantModule(modKey); setGrantCap(cap); setGrantLevel(1); setGrantExpiry(""); }} className="p-1 hover:bg-tertiary rounded transition-all">
                                      <Plus className="w-3 h-3 text-[var(--text-secondary)]" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "roles" && (
          <div className="space-y-6">
            <p className="text-xs font-bold text-[var(--text-secondary)]">Role defaults define baseline permissions for each role. Group defaults define permissions for team membership.</p>
            {roleDefaults.length > 0 ? (
              <div className="space-y-4">
                {[...new Set(roleDefaults.map((r) => r.role))].map((role) => (
                  <div key={role} className="ios-card !p-4 border-[var(--border-primary)]">
                    <h3 className="text-xs font-black text-[var(--brand-orange)] uppercase tracking-wider mb-3">{role}</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {roleDefaults.filter((r) => r.role === role).map((r) => (
                        <div key={`${r.module}-${r.capability}`} className="p-2 rounded-lg bg-primary border border-[var(--border-primary)]">
                          <p className="text-[8px] font-bold text-[var(--text-primary)]">{r.module} / {r.capability.replace(/_/g, " ")}</p>
                          <p className={`text-[8px] font-black ${ACCESS_COLORS[r.access_level] || "text-slate-500"}`}>{ACCESS_LABELS[r.access_level] || "None"}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-10 text-center opacity-40">
                <Shield className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                <p className="text-sm font-black text-[var(--text-primary)] uppercase">No defaults seeded</p>
                <p className="text-[10px] font-bold text-slate-500 mt-1">Go to Initialize tab to seed default role capabilities</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "seed" && (
          <div className="max-w-md space-y-6">
            <p className="text-xs font-bold text-[var(--text-secondary)]">This will seed default capabilities for core roles (super_admin, staff, participant). Safe to run multiple times.</p>
            <button onClick={async () => {
              setActionMsg(""); setActionError("");
              try {
                const res = await fetch("/api/engineering/permissions/seed", { method: "POST" });
                const data = await res.json();
                if (data.success) { setActionMsg("Defaults seeded successfully!"); fetchModules(); }
                else setActionError(data.error || "Seed failed");
              } catch (e) { setActionError("Network error"); }
            }} className="px-6 py-3 rounded-xl bg-[var(--brand-orange)] text-black text-[9px] font-black uppercase tracking-widest hover:opacity-90 transition-all">
              Seed Default Role Capabilities
            </button>
            {actionMsg && <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20"><p className="text-[10px] font-bold text-emerald-400">{actionMsg}</p></div>}
            {actionError && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20"><p className="text-[10px] font-bold text-red-400">{actionError}</p></div>}
          </div>
        )}

        {/* Grant Modal */}
        {showGrantModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-md bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-2xl p-6 shadow-2xl space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-[var(--brand-orange)]" />
                  <h2 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider">Manage Permission</h2>
                </div>
                <button onClick={() => setShowGrantModal(null)} className="p-2 hover:bg-tertiary rounded-lg transition-all"><X className="w-4 h-4 text-[var(--text-secondary)]" /></button>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-bold text-[var(--text-secondary)]">Module: <strong className="text-[var(--text-primary)]">{modules[grantModule]?.name || grantModule}</strong></p>
                <p className="text-[10px] font-bold text-[var(--text-secondary)]">Capability: <strong className="text-[var(--text-primary)]">{grantCap.replace(/_/g, " ")}</strong></p>
                <p className="text-[10px] font-bold text-[var(--text-secondary)]">Current effective level: <strong className={ACCESS_COLORS[showGrantModal.currentLevel]}>{ACCESS_LABELS[showGrantModal.currentLevel]}</strong></p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest block mb-1.5">Access Level</label>
                  <select value={grantLevel} onChange={(e) => setGrantLevel(parseInt(e.target.value))} className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-xs font-bold text-[var(--text-primary)] outline-none">
                    {Object.entries(ACCESS_LABELS).map(([level, label]) => (
                      <option key={level} value={level}>{label} ({level})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest block mb-1.5">Expires At (optional)</label>
                  <input type="datetime-local" value={grantExpiry} onChange={(e) => setGrantExpiry(e.target.value)} className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-xs font-bold text-[var(--text-primary)] outline-none" />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button onClick={() => handlePermissionAction("grant", grantModule, grantCap, grantLevel, grantExpiry)} className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-500/10 text-emerald-400 text-[9px] font-black uppercase tracking-widest hover:bg-emerald-500/20 transition-all">
                  <Plus className="w-3.5 h-3.5" /> Grant
                </button>
                <button onClick={() => handlePermissionAction("revoke", grantModule, grantCap)} className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 text-red-400 text-[9px] font-black uppercase tracking-widest hover:bg-red-500/20 transition-all">
                  <Trash2 className="w-3.5 h-3.5" /> Revoke Grant
                </button>
                <button onClick={() => handlePermissionAction("restrict", grantModule, grantCap, 0, grantExpiry)} className="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-500/10 text-amber-400 text-[9px] font-black uppercase tracking-widest hover:bg-amber-500/20 transition-all">
                  <X className="w-3.5 h-3.5" /> Restrict
                </button>
                <button onClick={() => handlePermissionAction("unrestrict", grantModule, grantCap)} className="px-4 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] hover:bg-tertiary transition-all">
                  Unrestrict
                </button>
              </div>

              <button onClick={() => setShowGrantModal(null)} className="w-full py-3 rounded-xl text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] hover:bg-tertiary transition-all">
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

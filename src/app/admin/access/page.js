"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Search,
  User,
  Shield,
  ChevronRight,
  X,
  Loader2,
  Layers,
  Award,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";

const ACCESS_LABELS = {
  0: "None",
  1: "View",
  2: "Create",
  3: "Edit",
  4: "Delete",
  5: "Full",
};

const ACCESS_SHORT = { 0: "—", 1: "V", 2: "C", 3: "E", 4: "D", 5: "All" };

const ACCESS_COLORS = {
  0: "text-slate-500",
  1: "text-blue-400",
  2: "text-emerald-400",
  3: "text-amber-400",
  4: "text-red-400",
  5: "text-purple-400",
};

const MODULE_CATEGORIES = [
  { label: "Content", modules: ["projects", "programs", "reports", "contacts"] },
  { label: "People", modules: ["users", "messaging", "internal_comms"] },
  { label: "System", modules: ["permissions", "engineering", "finance", "settings"] },
];

export default function UserAccessSummary() {
  const [searchQuery, setSearchQuery] = useState("");
  const [allUsers, setAllUsers] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modules, setModules] = useState({});

  useEffect(() => {
    fetchUsers();
    fetchModules();
  }, []);

  const fetchModules = async () => {
    try {
      const res = await fetch("/api/engineering/permissions");
      const data = await res.json();
      if (data.success) setModules(data.modules || {});
    } catch (_) {}
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/contacts");
      const data = await res.json();
      if (data.success) {
        const sorted = (data.contacts || []).sort((a, b) => {
          if (a.status === "active" && b.status !== "active") return -1;
          if (a.status !== "active" && b.status === "active") return 1;
          return (a.name || "").localeCompare(b.name || "");
        });
        setAllUsers(sorted);
        setSearchResults(sorted);
      }
    } catch (_) {} finally {
      setLoading(false);
    }
  };

  const searchUsers = (query) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults(allUsers);
      return;
    }
    const q = query.toLowerCase();
    setSearchResults(
      allUsers.filter(
        (u) =>
          (u.name || "").toLowerCase().includes(q) ||
          (u.email || "").toLowerCase().includes(q) ||
          (u.cid || "").toLowerCase().includes(q),
      ),
    );
  };

  const fetchUserSummary = async (user) => {
    setSelectedUser(user);
    setLoading(true);
    try {
      // Fetch permissions + profile + groups in parallel
      const [permsRes, groupsRes, respRes, profileRes] = await Promise.all([
        fetch(`/api/engineering/permissions?user_cid=${user.cid}`),
        fetch(`/api/user-groups?user_cid=${user.cid}`),
        fetch(`/api/responsibilities?user_cid=${user.cid}`),
        fetch(`/api/access-profiles/assign?user_cid=${user.cid}`),
      ]);

      const permsData = await permsRes.json();
      const groupsData = await groupsRes.json();
      const respData = await respRes.json();
      const profileData = await profileRes.json();

      setUserData({
        user: permsData.user || user,
        groups: groupsData.groups || [],
        responsibilities: respData.responsibilities || [],
        profile: {
          assigned: profileData.assignedProfile || null,
          roleDefault: profileData.roleDefault || null,
          effectiveSource: profileData.effectiveSource || "legacy",
        },
        effectivePermissions: permsData.effectivePermissions || {},
        individualGrants: permsData.individualGrants || [],
        individualRestrictions: permsData.individualRestrictions || [],
      });
    } catch (e) {
      console.error("Failed to fetch user summary", e);
    } finally {
      setLoading(false);
    }
  };

  const getEffectiveLevel = (module, capability) => {
    return userData?.effectivePermissions?.[module]?.[capability] ?? 0;
  };

  // ─── RENDER ───
  return (
    <DashboardLayout role="super_admin" activeTab="access">
      <div className="space-y-8 pb-20">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-[var(--border-primary)] pb-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[var(--brand-orange)]" />
              <span className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-[0.4em]">
                Administration
              </span>
            </div>
            <h1 className="text-4xl font-black text-[var(--text-primary)] uppercase tracking-tighter">
              User Access Summary
            </h1>
            <p className="text-xs font-bold text-[var(--text-secondary)] opacity-60">
              View a user's complete access configuration in one place
            </p>
          </div>
          <button
            onClick={() => { setSelectedUser(null); setUserData(null); fetchUsers(); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-secondary border border-[var(--border-primary)] rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-tertiary transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </header>

        {/* Search */}
        {!selectedUser && (
          <>
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
              <input
                value={searchQuery}
                onChange={(e) => searchUsers(e.target.value)}
                placeholder="Search by name, email, or CID..."
                className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl pl-10 pr-4 py-3 text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/50 font-bold text-xs transition-all"
              />
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-6 h-6 border-2 border-t-[var(--brand-orange)] rounded-full animate-spin"
                  style={{ borderColor: "rgba(255,102,0,0.1)", borderTopColor: "var(--brand-orange)" }} />
              </div>
            ) : (
              <div className="space-y-1 max-w-md">
                {searchResults.map((u) => (
                  <button
                    key={u.cid}
                    onClick={() => fetchUserSummary(u)}
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
          </>
        )}

        {/* User Summary */}
        {selectedUser && userData && (
          <div className="space-y-6">
            {/* User Info Bar */}
            <div className="ios-card !p-5 border-[var(--border-primary)] flex items-center justify-between bg-secondary/50">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-orange-500/10 flex items-center justify-center">
                  <User className="w-7 h-7 text-[var(--brand-orange)]" />
                </div>
                <div>
                  <p className="text-lg font-black text-[var(--text-primary)] uppercase tracking-tight">
                    {userData.user.name}
                  </p>
                  <p className="text-[10px] font-bold text-[var(--text-secondary)]">
                    {userData.user.email}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-[8px] font-bold px-2 py-0.5 rounded bg-orange-500/10 text-[var(--brand-orange)] uppercase tracking-wider">
                      {userData.user.role}
                    </span>
                    {(userData.groups || []).map((g) => (
                      <span key={g} className="text-[8px] font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 uppercase tracking-wider">
                        {g}
                      </span>
                    ))}
                    {/* Access Profile Badge */}
                    {userData.profile.assigned && (
                      <span className="text-[8px] font-bold px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 uppercase tracking-wider">
                        {userData.profile.assigned.name}
                      </span>
                    )}
                    {!userData.profile.assigned && userData.profile.roleDefault && (
                      <span className="text-[8px] font-bold px-2 py-0.5 rounded bg-teal-500/10 text-teal-400 uppercase tracking-wider">
                        {userData.profile.roleDefault.name} (role default)
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => { setSelectedUser(null); setUserData(null); }}
                className="p-2 hover:bg-tertiary rounded-lg transition-all"
              >
                <X className="w-4 h-4 text-[var(--text-secondary)]" />
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-6 h-6 border-2 border-t-[var(--brand-orange)] rounded-full animate-spin"
                  style={{ borderColor: "rgba(255,102,0,0.1)", borderTopColor: "var(--brand-orange)" }} />
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* LEFT COLUMN: Profile + Responsibilities + Overrides */}
                <div className="space-y-6">
                  {/* Access Profile Card */}
                  <div className="ios-card !p-5 border-[var(--border-primary)]">
                    <div className="flex items-center gap-2 mb-4">
                      <Layers className="w-4 h-4 text-[var(--brand-orange)]" />
                      <h3 className="text-[10px] font-black text-[var(--text-primary)] uppercase tracking-wider">
                        Access Profile
                      </h3>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-bold text-[var(--text-secondary)]">Effective Profile</span>
                        <span className={`text-[9px] font-black ${userData.profile.effectiveSource === "user" ? "text-purple-400" : userData.profile.effectiveSource === "role" ? "text-teal-400" : "text-slate-400"}`}>
                          {userData.profile.assigned?.name || userData.profile.roleDefault?.name || "Legacy (role_capabilities)"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-bold text-[var(--text-secondary)]">Source</span>
                        <span className="text-[9px] font-bold text-[var(--text-secondary)]">
                          {userData.profile.effectiveSource === "user" ? "User override" : userData.profile.effectiveSource === "role" ? "Role default" : "Legacy"}
                        </span>
                      </div>
                      {userData.profile.assigned && (
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] font-bold text-[var(--text-secondary)]">Role Default</span>
                          <span className="text-[9px] font-bold text-[var(--text-secondary)]">
                            {userData.profile.roleDefault?.name || "None"}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Responsibilities Card */}
                  <div className="ios-card !p-5 border-[var(--border-primary)]">
                    <div className="flex items-center gap-2 mb-4">
                      <Award className="w-4 h-4 text-[var(--brand-orange)]" />
                      <h3 className="text-[10px] font-black text-[var(--text-primary)] uppercase tracking-wider">
                        Responsibilities
                      </h3>
                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-[var(--brand-orange)]/10 text-[var(--brand-orange)]">
                        {(userData.responsibilities || []).length}
                      </span>
                    </div>
                    {userData.responsibilities.length === 0 ? (
                      <p className="text-[9px] font-bold text-slate-500">No responsibilities assigned</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {userData.responsibilities.map((r) => (
                          <span key={r.id} className="text-[8px] font-bold px-2 py-1 rounded bg-[var(--brand-orange)]/10 text-[var(--brand-orange)] uppercase tracking-wider">
                            {r.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Permission Overrides Card */}
                  <div className="ios-card !p-5 border-[var(--border-primary)]">
                    <div className="flex items-center gap-2 mb-4">
                      <AlertTriangle className="w-4 h-4 text-[var(--brand-orange)]" />
                      <h3 className="text-[10px] font-black text-[var(--text-primary)] uppercase tracking-wider">
                        Permission Overrides
                      </h3>
                    </div>
                    {(userData.individualGrants || []).length === 0 && (userData.individualRestrictions || []).length === 0 ? (
                      <p className="text-[9px] font-bold text-slate-500">No individual overrides</p>
                    ) : (
                      <div className="space-y-3">
                        {(userData.individualGrants || []).length > 0 && (
                          <div>
                            <p className="text-[8px] font-bold text-emerald-400 mb-1.5 uppercase tracking-wider">Grants</p>
                            <div className="space-y-1">
                              {userData.individualGrants.map((g, i) => (
                                <div key={i} className="flex items-center gap-2 text-[8px] font-bold">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                  <span className="text-[var(--text-primary)]">{g.module}.{g.capability.replace(/_/g, " ")}</span>
                                  <span className={ACCESS_COLORS[g.access_level] || "text-slate-500"}>({ACCESS_LABELS[g.access_level]})</span>
                                  {g.expires_at && (
                                    <span className="text-slate-500 flex items-center gap-1">
                                      <Clock className="w-2.5 h-2.5" />
                                      {new Date(g.expires_at).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {(userData.individualRestrictions || []).length > 0 && (
                          <div>
                            <p className="text-[8px] font-bold text-red-400 mb-1.5 uppercase tracking-wider">Restrictions</p>
                            <div className="space-y-1">
                              {userData.individualRestrictions.map((r, i) => (
                                <div key={i} className="flex items-center gap-2 text-[8px] font-bold">
                                  <X className="w-3 h-3 text-red-400" />
                                  <span className="text-[var(--text-primary)]">{r.module}.{r.capability.replace(/_/g, " ")}</span>
                                  {r.expires_at && (
                                    <span className="text-slate-500 flex items-center gap-1">
                                      <Clock className="w-2.5 h-2.5" />
                                      {new Date(r.expires_at).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* RIGHT COLUMN: Accessible Modules */}
                <div className="ios-card !p-5 border-[var(--border-primary)]">
                  <div className="flex items-center gap-2 mb-4">
                    <Shield className="w-4 h-4 text-[var(--brand-orange)]" />
                    <h3 className="text-[10px] font-black text-[var(--text-primary)] uppercase tracking-wider">
                      Accessible Modules
                    </h3>
                  </div>
                  <div className="space-y-4">
                    {MODULE_CATEGORIES.map((category) => {
                      const hasAccess = category.modules.some(
                        (m) => userData.effectivePermissions[m] && Object.keys(userData.effectivePermissions[m]).length > 0,
                      );
                      if (!hasAccess) return null;
                      return (
                        <div key={category.label}>
                          <p className="text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-[0.3em] mb-2 opacity-50">
                            {category.label}
                          </p>
                          {category.modules.map((modKey) => {
                            const modData = modules[modKey];
                            const permissions = userData.effectivePermissions[modKey];
                            if (!permissions || Object.keys(permissions).length === 0) return null;
                            return (
                              <div key={modKey} className="mb-3 last:mb-0">
                                <p className="text-[9px] font-black text-[var(--text-primary)] uppercase tracking-wider mb-1">
                                  {modData?.name || modKey}
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  {Object.entries(permissions).map(([cap, level]) => (
                                    <span key={cap} className={`text-[7px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                                      level > 0
                                        ? "bg-[var(--brand-orange)]/10 text-[var(--brand-orange)]"
                                        : "bg-slate-500/10 text-slate-500"
                                    }`}>
                                      {cap.replace(/_/g, " ")}
                                      <span className={`ml-1 ${ACCESS_COLORS[level] || "text-slate-500"}`}>
                                        {ACCESS_SHORT[level] || "—"}
                                      </span>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

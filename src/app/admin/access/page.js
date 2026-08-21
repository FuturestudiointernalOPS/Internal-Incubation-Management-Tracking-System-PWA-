"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
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
  Briefcase,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";

const ACCESS_LEVEL_KEYS = {
  0: "adminMisc.access.accessLevelNone",
  1: "adminMisc.access.accessLevelView",
  2: "adminMisc.access.accessLevelCreate",
  3: "adminMisc.access.accessLevelEdit",
  4: "adminMisc.access.accessLevelDelete",
  5: "adminMisc.access.accessLevelFull",
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
  { label: "adminMisc.access.categoryContent", modules: ["projects", "programs", "reports", "contacts"] },
  { label: "adminMisc.access.categoryPeople", modules: ["users", "messaging", "internal_comms"] },
  { label: "adminMisc.access.categorySystem", modules: ["permissions", "engineering", "finance", "settings"] },
];

export default function UserAccessSummary() {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState("");
  const [allUsers, setAllUsers] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modules, setModules] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;

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
      // Fetch permissions + profile + groups + assignments in parallel
      const [permsRes, groupsRes, respRes, profileRes, rolesRes] =
        await Promise.all([
          fetch(`/api/engineering/permissions?user_cid=${user.cid}`),
          fetch(`/api/user-groups?user_cid=${user.cid}`),
          fetch(`/api/responsibilities?user_cid=${user.cid}`),
          fetch(`/api/access-profiles/assign?user_cid=${user.cid}`),
          fetch(`/api/contacts/${user.cid}/roles`),
        ]);

      const permsData = await permsRes.json();
      const groupsData = await groupsRes.json();
      const respData = await respRes.json();
      const profileData = await profileRes.json();
      const rolesData = await rolesRes.json();

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
        assignments: rolesData.success ? rolesData.roles || [] : [],
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

  // Pagination
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);
  const totalPages = Math.max(1, Math.ceil(searchResults.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedUsers = searchResults.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

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
                {t("adminMisc.access.administration")}
              </span>
            </div>
            <h1 className="text-4xl font-black text-[var(--text-primary)] uppercase tracking-tighter">
              {t("adminMisc.access.title")}
            </h1>
            <p className="text-xs font-bold text-[var(--text-secondary)] opacity-60">
              {t("adminMisc.access.subtitle")}
            </p>
          </div>
          <button
            onClick={() => { setSelectedUser(null); setUserData(null); fetchUsers(); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-secondary border border-[var(--border-primary)] rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-tertiary transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" /> {t("adminMisc.access.refresh")}
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
                placeholder={t("adminMisc.access.searchPlaceholder")}
                className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl pl-10 pr-4 py-3 text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/50 font-bold text-xs transition-all"
              />
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-6 h-6 border-2 border-t-[var(--brand-orange)] rounded-full animate-spin"
                  style={{ borderColor: "rgba(255,102,0,0.1)", borderTopColor: "var(--brand-orange)" }} />
              </div>
            ) : (
              <>
                <div className="space-y-1 max-w-md">
                  {paginatedUsers.map((u) => (
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

                {totalPages > 1 && (
                  <div className="flex items-center justify-between gap-4 max-w-md pt-2">
                    <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                      {t("crm.contacts.pageOf", { page: safePage, total: totalPages })}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={safePage === 1}
                        className="px-3 py-2 rounded-lg border border-[var(--border-primary)] text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--brand-orange)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                      >
                        {t("common.previous")}
                      </button>
                      <button
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={safePage === totalPages}
                        className="px-3 py-2 rounded-lg border border-[var(--border-primary)] text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--brand-orange)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                      >
                        {t("common.next")}
                      </button>
                    </div>
                  </div>
                )}
              </>
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
                        {userData.profile.roleDefault.name} {t("adminMisc.access.roleDefaultSuffix")}
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
                        {t("adminMisc.access.accessProfile")}
                      </h3>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-bold text-[var(--text-secondary)]">{t("adminMisc.access.effectiveProfile")}</span>
                        <span className={`text-[9px] font-black ${userData.profile.effectiveSource === "user" ? "text-purple-400" : userData.profile.effectiveSource === "role" ? "text-teal-400" : "text-slate-400"}`}>
                          {userData.profile.assigned?.name || userData.profile.roleDefault?.name || t("adminMisc.access.legacyRoleCapabilities")}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-bold text-[var(--text-secondary)]">{t("adminMisc.access.source")}</span>
                        <span className="text-[9px] font-bold text-[var(--text-secondary)]">
                          {userData.profile.effectiveSource === "user" ? t("adminMisc.access.sourceUserOverride") : userData.profile.effectiveSource === "role" ? t("adminMisc.access.sourceRoleDefault") : t("adminMisc.access.sourceLegacy")}
                        </span>
                      </div>
                      {userData.profile.assigned && (
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] font-bold text-[var(--text-secondary)]">{t("adminMisc.access.roleDefault")}</span>
                          <span className="text-[9px] font-bold text-[var(--text-secondary)]">
                            {userData.profile.roleDefault?.name || t("adminMisc.access.none")}
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
                        {t("adminMisc.access.responsibilities")}
                      </h3>
                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-[var(--brand-orange)]/10 text-[var(--brand-orange)]">
                        {(userData.responsibilities || []).length}
                      </span>
                    </div>
                    {userData.responsibilities.length === 0 ? (
                      <p className="text-[9px] font-bold text-slate-500">{t("adminMisc.access.noResponsibilities")}</p>
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

                  {/* Assignments Card (contact_roles — program/venture/form scoped titles) */}
                  <div className="ios-card !p-5 border-[var(--border-primary)]">
                    <div className="flex items-center gap-2 mb-4">
                      <Briefcase className="w-4 h-4 text-[var(--brand-orange)]" />
                      <h3 className="text-[10px] font-black text-[var(--text-primary)] uppercase tracking-wider">
                        {t("adminMisc.access.assignments")}
                      </h3>
                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-[var(--brand-orange)]/10 text-[var(--brand-orange)]">
                        {(userData.assignments || []).length}
                      </span>
                    </div>
                    {(userData.assignments || []).length === 0 ? (
                      <p className="text-[9px] font-bold text-slate-500">{t("adminMisc.access.noAssignments")}</p>
                    ) : (
                      <div className="space-y-2">
                        {(userData.assignments || []).map((a, i) => {
                          let scopeLabel = "";
                          try {
                            const s = typeof a.scope === "string" ? JSON.parse(a.scope) : a.scope;
                            if (s?.type === "program") scopeLabel = "Program";
                            else if (s?.type === "groups") scopeLabel = `Groups (${(s.groupIds || []).length})`;
                            else if (s?.type === "individuals") scopeLabel = `Individuals (${(s.cids || []).length})`;
                          } catch (_) {}
                          const isCurrent = a.is_current !== false;
                          return (
                            <div
                              key={i}
                              className={`rounded-xl border p-3 ${
                                isCurrent
                                  ? "border-[var(--brand-orange)]/20 bg-[var(--brand-orange)]/[0.03]"
                                  : "border-[var(--border-primary)] bg-tertiary/40 opacity-60"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <p className="text-[10px] font-black text-[var(--text-primary)] uppercase tracking-wider">
                                  {a.title || a.role}
                                </p>
                                {isCurrent ? (
                                  <span className="text-[7px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 uppercase tracking-wider">
                                    Current
                                  </span>
                                ) : (
                                  <span className="text-[7px] font-bold px-1.5 py-0.5 rounded bg-slate-500/10 text-slate-400 uppercase tracking-wider">
                                    Ended
                                  </span>
                                )}
                              </div>
                              <div className="mt-1.5 space-y-0.5">
                                <p className="text-[8px] font-bold text-[var(--text-secondary)]">
                                  {a.context_type} · {a.context_id || "global"}
                                  {scopeLabel ? ` · ${scopeLabel}` : ""}
                                </p>
                                {a.status && (
                                  <p className="text-[8px] font-bold text-[var(--text-secondary)] opacity-70">
                                    Status: {a.status}
                                  </p>
                                )}
                                {(a.capability_overrides || a.permissions) &&
                                  typeof (a.capability_overrides || a.permissions) === "object" &&
                                  Object.keys(a.capability_overrides || a.permissions).length > 0 && (
                                    <div className="flex flex-wrap gap-1 pt-1">
                                      {Object.keys(a.capability_overrides || a.permissions).map((k) => (
                                        <span
                                          key={k}
                                          className="text-[7px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 uppercase tracking-wider"
                                        >
                                          {k.replace(/\./g, " ")}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Permission Overrides Card */}
                  <div className="ios-card !p-5 border-[var(--border-primary)]">
                    <div className="flex items-center gap-2 mb-4">
                      <AlertTriangle className="w-4 h-4 text-[var(--brand-orange)]" />
                      <h3 className="text-[10px] font-black text-[var(--text-primary)] uppercase tracking-wider">
                        {t("adminMisc.access.permissionOverrides")}
                      </h3>
                    </div>
                    {(userData.individualGrants || []).length === 0 && (userData.individualRestrictions || []).length === 0 ? (
                      <p className="text-[9px] font-bold text-slate-500">{t("adminMisc.access.noOverrides")}</p>
                    ) : (
                      <div className="space-y-3">
                        {(userData.individualGrants || []).length > 0 && (
                          <div>
                            <p className="text-[8px] font-bold text-emerald-400 mb-1.5 uppercase tracking-wider">{t("adminMisc.access.grants")}</p>
                            <div className="space-y-1">
                              {userData.individualGrants.map((g, i) => (
                                <div key={i} className="flex items-center gap-2 text-[8px] font-bold">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                  <span className="text-[var(--text-primary)]">{g.module}.{g.capability.replace(/_/g, " ")}</span>
                                  <span className={ACCESS_COLORS[g.access_level] || "text-slate-500"}>({t(ACCESS_LEVEL_KEYS[g.access_level] || "adminMisc.access.accessLevelNone")})</span>
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
                            <p className="text-[8px] font-bold text-red-400 mb-1.5 uppercase tracking-wider">{t("adminMisc.access.restrictions")}</p>
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
                      {t("adminMisc.access.accessibleModules")}
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
                            {t(category.label)}
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

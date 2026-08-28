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
  Layers,
  Copy,
  EyeOff,
  UserCheck,
  Settings,
  Award,
  SwitchCamera,
  Pencil,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useI18n } from "@/lib/i18n";
import { capabilityLabel } from "@/lib/authorization/capability-catalog";
import {
  isResponsibilityBlockedForRole,
  normalizeAllowedRoles,
  defaultAllowedRoles,
  ALL_FEATURE_ROLES,
} from "@/lib/featureAccess";

const ACCESS_LEVELS = {
  NONE: 0,
  VIEW: 1,
  CREATE: 2,
  EDIT: 3,
  DELETE: 4,
  FULL: 5,
};
const ACCESS_LEVEL_KEYS = {
  0: "engineering.permissions.accessLevelNone",
  1: "engineering.permissions.accessLevelView",
  2: "engineering.permissions.accessLevelCreate",
  3: "engineering.permissions.accessLevelEdit",
  4: "engineering.permissions.accessLevelDelete",
  5: "engineering.permissions.accessLevelFull",
};
const ACCESS_SHORT = { 0: "—", 1: "V", 2: "C", 3: "E", 4: "D", 5: "All" };

const LEVELS_ORDER = [0, 1, 2, 3, 4, 5];

const ACCESS_COLORS = {
  0: "text-slate-500",
  1: "text-blue-400",
  2: "text-emerald-400",
  3: "text-amber-400",
  4: "text-red-400",
  5: "text-purple-400",
};

// Module grouping
const MODULE_CATEGORIES = [
  {
    label: "engineering.permissions.categoryContent",
    modules: ["projects", "programs", "reports", "contacts"],
  },
  {
    label: "engineering.permissions.categoryPeople",
    modules: ["users", "messaging", "internal_comms"],
  },
  {
    label: "engineering.permissions.categorySystem",
    modules: ["permissions", "engineering", "finance", "settings"],
  },
];

export default function PermissionManager() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [allUsers, setAllUsers] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userPerms, setUserPerms] = useState(null);
  const [loadingPerms, setLoadingPerms] = useState(false);
  const [modules, setModules] = useState({});
  const [expandedModules, setExpandedModules] = useState({});
  const [actionMsg, setActionMsg] = useState("");
  const [actionError, setActionError] = useState("");
  const [pendingCid, setPendingCid] = useState(null);

  // Deep-link support: /admin/engineering/permissions?cid=X preselects a user
  // (used by the Membership Control Center's "View Effective Access").
  useEffect(() => {
    if (typeof window === "undefined") return;
    const cid = new URLSearchParams(window.location.search).get("cid");
    if (cid) setPendingCid(cid);
  }, []);

  useEffect(() => {
    fetchModules();
  }, []);

  // Load all users when search tab is active
  useEffect(() => {
    if (activeTab === "search" && searchResults.length === 0 && !selectedUser) {
      fetchAllUsers();
    }
  }, [activeTab]);

  const fetchModules = async () => {
    try {
      const res = await fetch("/api/engineering/permissions");
      const data = await res.json();
      if (data.success) setModules(data.modules || {});
    } catch (e) {
      console.error("Failed to fetch modules", e);
    }
  };

  const fetchAllUsers = async () => {
    setSearching(true);
    try {
      const res = await fetch("/api/contacts");
      const data = await res.json();
      if (data.success) {
        // Sort: active first, then by name
        const sorted = (data.contacts || []).sort((a, b) => {
          if (a.status === "active" && b.status !== "active") return -1;
          if (a.status !== "active" && b.status === "active") return 1;
          return (a.name || "").localeCompare(b.name || "");
        });
        setAllUsers(sorted);
        setSearchResults(sorted);
        // Deep-link: preselect the user requested via ?cid=
        if (pendingCid) {
          const match = sorted.find((u) => String(u.cid) === String(pendingCid));
          if (match) {
            selectUser(match);
            setPendingCid(null);
          }
        }
      }
    } catch (e) {
      console.error("Failed to fetch users", e);
    } finally {
      setSearching(false);
    }
  };

  const searchUsers = (query) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults(allUsers);
      return;
    }
    const q = query.toLowerCase();
    const filtered = allUsers.filter(
      (u) =>
        (u.name || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q) ||
        (u.cid || "").toLowerCase().includes(q),
    );
    setSearchResults(filtered);
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

    // Optimistic update — apply change immediately to local state
    const prevPerms = { ...userPerms };
    const newPerms = JSON.parse(JSON.stringify(userPerms));

    if (action === "grant") {
      // Add to individual grants
      const existing = newPerms.individualGrants || [];
      const idx = existing.findIndex(
        (g) => g.module === module && g.capability === capability,
      );
      if (idx >= 0) {
        existing[idx].access_level = level;
      } else {
        existing.push({
          module,
          capability,
          access_level: level,
          granted_by: "self",
        });
      }
      newPerms.individualGrants = existing;
      // Update effective permissions
      if (!newPerms.effectivePermissions[module])
        newPerms.effectivePermissions[module] = {};
      newPerms.effectivePermissions[module][capability] = level;
      // Remove from restrictions if present
      newPerms.individualRestrictions = (
        newPerms.individualRestrictions || []
      ).filter((r) => !(r.module === module && r.capability === capability));
    }

    if (action === "revoke") {
      newPerms.individualGrants = (newPerms.individualGrants || []).filter(
        (g) => !(g.module === module && g.capability === capability),
      );
      // Revert effective to 0 (or re-calculate by removing from effective)
      if (newPerms.effectivePermissions[module]) {
        delete newPerms.effectivePermissions[module][capability];
      }
    }

    if (action === "restrict") {
      newPerms.individualRestrictions = newPerms.individualRestrictions || [];
      if (
        !newPerms.individualRestrictions.some(
          (r) => r.module === module && r.capability === capability,
        )
      ) {
        newPerms.individualRestrictions.push({
          module,
          capability,
          restricted_by: "self",
        });
      }
      if (newPerms.effectivePermissions[module]) {
        delete newPerms.effectivePermissions[module][capability];
      }
    }

    if (action === "unrestrict") {
      newPerms.individualRestrictions = (
        newPerms.individualRestrictions || []
      ).filter((r) => !(r.module === module && r.capability === capability));
      // Restore default level (will be corrected by background refresh)
      if (newPerms.effectivePermissions[module]) {
        newPerms.effectivePermissions[module][capability] = level || 1;
      }
    }

    // Apply optimistic update immediately
    setUserPerms(newPerms);
    setActionMsg(t("engineering.permissions.actionUpdating", { action }));

    // Fire API in background
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
        setActionMsg(t("engineering.permissions.actionSuccess", { action }));
        // Quietly refresh in background
        refreshUserPerms();
      } else {
        // Revert on failure
        setUserPerms(prevPerms);
        setActionError(t((data.error || t("engineering.permissions.actionFailed")) || "") || (data.error || t("engineering.permissions.actionFailed")));
      }
    } catch (e) {
      setUserPerms(prevPerms);
      setActionError(t("engineering.permissions.networkError"));
    }
  };

  const refreshUserPerms = async () => {
    try {
      const res = await fetch(
        `/api/engineering/permissions?user_cid=${selectedUser.cid}`,
      );
      const data = await res.json();
      if (data.success) setUserPerms(data);
    } catch (_) {}
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
                {t("engineering.permissions.authorization")}
              </span>
            </div>
            <h1 className="text-4xl font-black text-[var(--text-primary)] uppercase tracking-tighter">
              {t("engineering.permissions.pageTitle")}
            </h1>
            <p className="text-xs font-bold text-[var(--text-secondary)] opacity-60">
              {t("engineering.permissions.pageSubtitle")}
            </p>
          </div>
        </header>

        {/* Tabs */}
        <div className="flex gap-1 bg-secondary rounded-xl p-1 border border-[var(--border-primary)] w-fit flex-wrap">
          <button
            onClick={() => setActiveTab("eligibility")}
            className={`px-5 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === "eligibility" ? "bg-[var(--brand-orange)] text-black" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
          >
            {t("engineering.permissions.tabEligibility")}
          </button>
          <button
            onClick={() => setActiveTab("roles")}
            className={`px-5 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === "roles" ? "bg-[var(--brand-orange)] text-black" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
          >
            {t("engineering.permissions.tabRoleDefaults")}
          </button>
          <button
            onClick={() => setActiveTab("profiles")}
            className={`px-5 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === "profiles" ? "bg-[var(--brand-orange)] text-black" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
          >
            {t("engineering.permissions.tabAccessProfiles")}
          </button>
          <button
            onClick={() => setActiveTab("search")}
            className={`px-5 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === "search" ? "bg-[var(--brand-orange)] text-black" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
          >
            {t("engineering.permissions.tabUserSearch")}
          </button>
          <button
            onClick={() => setActiveTab("responsibilities")}
            className={`px-5 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === "responsibilities" ? "bg-[var(--brand-orange)] text-black" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
          >
            {t("engineering.permissions.tabResponsibilities")}
          </button>
          <button
            onClick={() => setActiveTab("access")}
            className={`px-5 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === "access" ? "bg-[var(--brand-orange)] text-black" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
          >
            {t("engineering.permissions.tabResponsibilityAccess")}
          </button>
        </div>

        {activeTab === "eligibility" && <EligibilityView />}
        {activeTab === "roles" && <RoleDefaultsView onManageProfiles={() => setActiveTab("profiles")} />}
        {activeTab === "profiles" && <AccessProfilesView />}
        {activeTab === "search" && (
          <div className="space-y-6">
            {/* Search */}
            <div className="flex gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
                <input
                  value={searchQuery}
                  onChange={(e) => searchUsers(e.target.value)}
                  placeholder={t("engineering.permissions.searchPlaceholder")}
                  className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl pl-10 pr-4 py-3 text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/50 font-bold text-xs transition-all"
                />
              </div>
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSearchResults(allUsers);
                }}
                className="px-4 py-3 rounded-xl bg-secondary border border-[var(--border-primary)] text-[9px] font-black uppercase tracking-widest hover:bg-tertiary transition-all"
              >
                {t("engineering.permissions.clear")}
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
                        {userPerms.effectiveProfile && (
                          <span
                            className={`text-[8px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                              userPerms.effectiveProfile.source === "user"
                                ? "bg-purple-500/10 text-purple-400"
                                : userPerms.effectiveProfile.source === "role"
                                  ? "bg-teal-500/10 text-teal-400"
                                  : "bg-slate-500/10 text-slate-400"
                            }`}
                            title={`${t("engineering.permissions.sourceLabel")}: ${userPerms.effectiveProfile.source}${userPerms.effectiveProfile.profileName ? ` — ${userPerms.effectiveProfile.profileName}` : ` — ${t("engineering.permissions.legacyRoleCapabilities")}`}`}
                          >
                            {userPerms.effectiveProfile.profileName || t("engineering.permissions.legacy")}
                          </span>
                        )}
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
                              setActionMsg(t("engineering.permissions.promotedToSuperAdmin"));
                              selectUser(selectedUser);
                            } else setActionError(t((data.error || t("engineering.permissions.failed")) || "") || (data.error || t("engineering.permissions.failed")));
                          } catch (e) {
                            setActionError(t("engineering.permissions.networkError"));
                          }
                        }}
                        className="px-3 py-2 rounded-xl bg-purple-500/10 text-purple-400 text-[8px] font-black uppercase tracking-widest hover:bg-purple-500/20 transition-all"
                      >
                        <Shield className="w-3 h-3 inline mr-1" />
                        {t("engineering.permissions.makeSuperAdmin")}
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
                              setActionMsg(t("engineering.permissions.superAdminRemoved"));
                              selectUser(selectedUser);
                            } else setActionError(t((data.error || t("engineering.permissions.failed")) || "") || (data.error || t("engineering.permissions.failed")));
                          } catch (e) {
                            setActionError(t("engineering.permissions.networkError"));
                          }
                        }}
                        className="px-3 py-2 rounded-xl bg-red-500/10 text-red-400 text-[8px] font-black uppercase tracking-widest hover:bg-red-500/20 transition-all"
                      >
                        <Shield className="w-3 h-3 inline mr-1" />
                        {t("engineering.permissions.removeSuperAdmin")}
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
                    {t("engineering.permissions.legendInherited")}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />{" "}
                    {t("engineering.permissions.legendIndividualGrant")}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-400" />{" "}
                    {t("engineering.permissions.restricted")}
                  </span>
                </div>

                {/* Access explanation — who has access and why */}
                {userPerms.explanation && (
                  <AccessExplanationPanel
                    explanation={userPerms.explanation}
                    t={t}
                  />
                )}

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
                          {t(category.label)}
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
                                  {t("engineering.permissions.capabilitiesCount", { count: caps.length })}
                                </span>
                              </button>

                              {isExpanded && (
                                <div className="overflow-x-auto">
                                  <table className="w-full border-collapse">
                                    <thead>
                                      <tr className="border-b border-[var(--border-primary)]">
                                        <th className="text-left px-5 py-3 text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest w-40">
                                          {t("engineering.permissions.capability")}
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
                                            {t(ACCESS_LEVEL_KEYS[level])}
                                          </th>
                                        ))}
                                        <th className="px-3 py-3 text-center text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest w-24">
                                          {t("engineering.permissions.actions")}
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
                                                    title={t("engineering.permissions.titleIndividualGrant")}
                                                  />
                                                )}
                                                {origin === "restricted" && (
                                                  <span
                                                    className="w-2 h-2 rounded-full bg-red-400 shrink-0"
                                                    title={t("engineering.permissions.restricted")}
                                                  />
                                                )}
                                                {origin === "inherited" && (
                                                  <span
                                                    className="w-2 h-2 rounded-full bg-slate-400 shrink-0"
                                                    title={t("engineering.permissions.titleInherited")}
                                                  />
                                                )}
                                                <span className="text-[9px] font-bold text-[var(--text-primary)] uppercase tracking-wider">
                                                  {capabilityLabel(modKey, cap)}
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
                                                      title={t("engineering.permissions.titleRestrictedClick")}
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
                                                      title={t("engineering.permissions.titleRestrict")}
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
                                                      title={t("engineering.permissions.titleSetTo", { level: t(ACCESS_LEVEL_KEYS[level]) })}
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
                                                    title={t("engineering.permissions.titleRevokeGrant")}
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
                                                    title={t("engineering.permissions.titleRemoveRestriction")}
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

        {activeTab === "responsibilities" && <ResponsibilitiesView />}
        {activeTab === "access" && <ResponsibilityAccessView />}
      </div>
    </DashboardLayout>
  );
}

function RoleDefaultsView({ onManageProfiles }) {
  const { t } = useI18n();
  const [roleDefaults, setRoleDefaults] = useState({});
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [profilesRes, eligRes] = await Promise.all([
          fetch("/api/access-profiles"),
          fetch("/api/engineering/permissions/eligibility"),
        ]);
        const profilesData = await profilesRes.json();
        const eligData = await eligRes.json();
        if (profilesData.success) setRoleDefaults(profilesData.roleDefaults || {});
        if (eligData.success) setRoles(eligData.roles || []);
      } catch (e) {
        console.error("Failed to load role defaults:", e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
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

  if (roles.length === 0) {
    return (
      <div className="py-10 text-center opacity-40">
        <Shield className="w-12 h-12 text-slate-500 mx-auto mb-3" />
        <p className="text-sm font-black text-[var(--text-primary)] uppercase">
          {t("engineering.permissions.noDefaultsSeeded")}
        </p>
        <p className="text-[10px] font-bold text-slate-500 mt-1">
          {t("engineering.permissions.noDefaultsHint")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-xs font-bold text-[var(--text-secondary)]">
        {t("engineering.permissions.defaultAccessHint")}
      </p>
      <div
        className="ios-card !p-0 border-[var(--border-primary)] overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[var(--border-primary)]">
                <th className="text-left px-5 py-3 text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
                  {t("engineering.permissions.roleColumn")}
                </th>
                <th className="text-left px-5 py-3 text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
                  {t("engineering.permissions.defaultProfileColumn")}
                </th>
                <th className="text-right px-5 py-3 text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
                  {t("engineering.permissions.actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => {
                const def = roleDefaults[role];
                return (
                  <tr
                    key={role}
                    className="border-b border-[var(--border-primary)]/50 last:border-b-0 hover:bg-tertiary/20 transition-all"
                  >
                    <td className="px-5 py-3.5">
                      <span className="text-[9px] font-black text-[var(--text-primary)] uppercase tracking-wider">
                        {role}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {def ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-teal-500/10 text-teal-400">
                          <Layers className="w-3 h-3" />
                          {def.profileName || def.profileId}
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                          {t("engineering.permissions.noDefaultProfile")}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={onManageProfiles}
                        className="px-3 py-1.5 rounded-lg bg-secondary border border-[var(--border-primary)] text-[8px] font-black uppercase tracking-widest hover:bg-tertiary transition-all"
                      >
                        {t("engineering.permissions.manageProfiles")}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-[9px] font-bold text-[var(--text-secondary)]">
        {t("engineering.permissions.defaultAccessHintTail")}
      </p>
    </div>
  );
}

function AccessProfilesView() {
  const { t } = useI18n();
  const [profiles, setProfiles] = useState([]);
  const [roleDefaults, setRoleDefaults] = useState({});
  const [allRoles, setAllRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [profileCaps, setProfileCaps] = useState([]);
  const [actionMsg, setActionMsg] = useState("");
  const [actionError, setActionError] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [showRoleDefaultForm, setShowRoleDefaultForm] = useState(false);
  const [newProfile, setNewProfile] = useState({ name: "", description: "" });
  const [assignData, setAssignData] = useState({
    user_cid: "",
    profile_id: "",
  });
  const [roleDefaultData, setRoleDefaultData] = useState({
    role_name: "",
    profile_id: "",
  });
  const [editingCap, setEditingCap] = useState(null);
  const [editValue, setEditValue] = useState(0);
  const [safetyAck, setSafetyAck] = useState(false); // confirmed role-bound profile edits
  const [pendingCapEdit, setPendingCapEdit] = useState(null); // { module, capability, level, roles }
  const [renameMode, setRenameMode] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/access-profiles");
      const data = await res.json();
      if (data.success) {
        setProfiles(data.profiles || []);
        setRoleDefaults(data.roleDefaults || {});
        // Collect roles that have defaults
        setAllRoles(Object.keys(data.roleDefaults || {}));
      }
    } catch (e) {
      console.error("Failed to load profiles", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const selectProfile = async (profile) => {
    setSelectedProfile(profile);
    try {
      const res = await fetch(`/api/access-profiles?id=${profile.id}`);
      const data = await res.json();
      if (data.success) {
        setProfileCaps(data.capabilities || []);
      }
    } catch (e) {
      console.error("Failed to load profile capabilities", e);
    }
  };

  const createProfile = async () => {
    if (!newProfile.name.trim()) return;
    setActionMsg("");
    setActionError("");
    try {
      const res = await fetch("/api/access-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newProfile.name.trim(),
          description: newProfile.description,
          capabilities: {},
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg(t("engineering.permissions.profileCreated", { name: newProfile.name }));
        setShowCreateForm(false);
        setNewProfile({ name: "", description: "" });
        fetchProfiles();
      } else {
        setActionError(t((data.error || t("engineering.permissions.failedToCreate")) || "") || (data.error || t("engineering.permissions.failedToCreate")));
      }
    } catch (e) {
      setActionError(t("engineering.permissions.networkError"));
    }
  };

  const duplicateProfile = async (profile) => {
    setActionMsg("");
    setActionError("");
    try {
      // Fetch full profile with capabilities
      const res = await fetch(`/api/access-profiles?id=${profile.id}`);
      const data = await res.json();
      if (!data.success) {
        setActionError(t("engineering.permissions.failedToFetchSourceProfile"));
        return;
      }

      // Build capabilities object from response
      const caps = {};
      for (const c of data.capabilities) {
        if (!caps[c.module]) caps[c.module] = {};
        caps[c.module][c.capability] = c.access_level;
      }

      // Create copy
      const createRes = await fetch("/api/access-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${profile.name} (copy)`,
          description: profile.description,
          capabilities: caps,
        }),
      });
      const createData = await createRes.json();
      if (createData.success) {
        setActionMsg(t("engineering.permissions.profileDuplicated", { name: `${profile.name} (copy)` }));
        fetchProfiles();
      } else {
        setActionError(t((createData.error || t("engineering.permissions.failedToDuplicate")) || "") || (createData.error || t("engineering.permissions.failedToDuplicate")));
      }
    } catch (e) {
      setActionError(t("engineering.permissions.networkError"));
    }
  };

  const toggleProfileActive = async (profile) => {
    try {
      const res = await fetch("/api/access-profiles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: profile.id,
          is_active: !profile.is_active,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg(
          profile.is_active
            ? t("engineering.permissions.profileDisabled")
            : t("engineering.permissions.profileEnabled"),
        );
        fetchProfiles();
      } else {
        setActionError(t((data.error || t("engineering.permissions.failedToToggle")) || "") || (data.error || t("engineering.permissions.failedToToggle")));
      }
    } catch (e) {
      setActionError(t("engineering.permissions.networkError"));
    }
  };

  const updateCapability = async (module, capability, level) => {
    if (!selectedProfile) return;
    try {
      // Fetch current caps
      const currentCaps = {};
      for (const c of profileCaps) {
        if (!currentCaps[c.module]) currentCaps[c.module] = {};
        currentCaps[c.module][c.capability] = c.access_level;
      }

      // Update the specific capability
      if (!currentCaps[module]) currentCaps[module] = {};
      currentCaps[module][capability] = level;

      const res = await fetch("/api/access-profiles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedProfile.id,
          capabilities: currentCaps,
        }),
      });
      const data = await res.json();
      if (data.success) {
        // Refresh caps
        selectProfile(selectedProfile);
        setEditingCap(null);
        setActionMsg(t("engineering.permissions.capabilityUpdated"));
      } else {
        setActionError(t((data.error || t("engineering.permissions.failedToUpdate")) || "") || (data.error || t("engineering.permissions.failedToUpdate")));
      }
    } catch (e) {
      setActionError(t("engineering.permissions.networkError"));
    }
  };

  // Profile safety (Phase 6): editing a profile that is a role default is
  // consequential — require an explicit confirmation on the first change.
  const requestCapabilityEdit = (module, capability, level) => {
    if (!selectedProfile) return;
    const defaultFor = Object.entries(roleDefaults)
      .filter(([, v]) => v.profileId === selectedProfile.id)
      .map(([role]) => role);
    if (defaultFor.length > 0 && !safetyAck) {
      setPendingCapEdit({ module, capability, level, roles: defaultFor });
      return;
    }
    updateCapability(module, capability, level);
  };

  const confirmCapabilityEdit = () => {
    if (!pendingCapEdit) return;
    setSafetyAck(true);
    updateCapability(pendingCapEdit.module, pendingCapEdit.capability, pendingCapEdit.level);
    setPendingCapEdit(null);
  };

  const renameProfile = async () => {
    if (!selectedProfile || !renameValue.trim()) return;
    setActionMsg("");
    setActionError("");
    try {
      const res = await fetch("/api/access-profiles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedProfile.id, name: renameValue.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setSelectedProfile({ ...selectedProfile, name: renameValue.trim() });
        setRenameMode(false);
        setActionMsg(t("engineering.permissions.profileRenamed"));
        fetchProfiles();
      } else {
        setActionError(t((data.error || t("engineering.permissions.failedToUpdate")) || "") || (data.error || t("engineering.permissions.failedToUpdate")));
      }
    } catch (e) {
      setActionError(t("engineering.permissions.networkError"));
    }
  };

  const assignProfileToUser = async () => {
    if (!assignData.user_cid || !assignData.profile_id) return;
    try {
      const res = await fetch("/api/access-profiles/assign", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(assignData),
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg(t(data.message || "") || data.message);
        setShowAssignForm(false);
        setAssignData({ user_cid: "", profile_id: "" });
      } else {
        setActionError(t((data.error || t("engineering.permissions.failedToAssign")) || "") || (data.error || t("engineering.permissions.failedToAssign")));
      }
    } catch (e) {
      setActionError(t("engineering.permissions.networkError"));
    }
  };

  const setRoleDefault = async () => {
    if (!roleDefaultData.role_name || !roleDefaultData.profile_id) return;
    try {
      const res = await fetch("/api/access-profiles/role-defaults", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(roleDefaultData),
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg(t(data.message || "") || data.message);
        setShowRoleDefaultForm(false);
        setRoleDefaultData({ role_name: "", profile_id: "" });
        fetchProfiles();
      } else {
        setActionError(t((data.error || t("engineering.permissions.failedToSetDefault")) || "") || (data.error || t("engineering.permissions.failedToSetDefault")));
      }
    } catch (e) {
      setActionError(t("engineering.permissions.networkError"));
    }
  };

  // Build module/capability list from PERMISSION_MODULES (from API response)
  const availableModules = window.availableModules || {
    projects: {
      name: "Projects",
      capabilities: ["view", "create", "edit", "delete", "archive"],
    },
    programs: {
      name: "Programs",
      capabilities: ["view", "create", "edit", "delete", "publish"],
    },
    users: {
      name: "Users",
      capabilities: [
        "view",
        "create",
        "edit",
        "suspend",
        "delete",
        "assign_roles",
      ],
    },
    reports: {
      name: "Reports",
      capabilities: ["view", "create", "export", "delete"],
    },
    messaging: { name: "Messaging", capabilities: ["view", "send", "delete"] },
    internal_comms: {
      name: "Internal Communication",
      capabilities: ["view", "create_announcements", "moderate"],
    },
    contacts: {
      name: "Contacts",
      capabilities: ["view", "create", "edit", "delete", "import", "export"],
    },
    permissions: {
      name: "Permissions",
      capabilities: [
        "view_matrix",
        "grant",
        "revoke",
        "assign_capabilities",
        "assign_groups",
        "assign_responsibilities",
        "promote_super_admin",
        "remove_super_admin",
      ],
    },
    engineering: {
      name: "Engineering Operations",
      capabilities: [
        "view",
        "manage_tasks",
        "manage_errors",
        "manage_developers",
      ],
    },
    finance: {
      name: "Finance",
      capabilities: ["view", "create", "edit", "delete", "export"],
    },
    settings: { name: "System Settings", capabilities: ["view", "edit"] },
  };

  // Fetch actual modules from API
  useEffect(() => {
    fetch("/api/engineering/permissions")
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.modules) window.availableModules = d.modules;
      })
      .catch(() => {});
  }, []);

  if (loading) {
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
  }

  // ─── DETAIL VIEW ───
  if (selectedProfile) {
    const getLevel = (mod, cap) => {
      const found = profileCaps.find(
        (c) => c.module === mod && c.capability === cap,
      );
      return found ? found.access_level : 0;
    };

    // Roles that use this profile as their default — drives the safety notice.
    const isDefaultFor = Object.entries(roleDefaults)
      .filter(([, v]) => v.profileId === selectedProfile.id)
      .map(([role]) => role);

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setSelectedProfile(null);
                setProfileCaps([]);
                setSafetyAck(false);
              }}
              className="px-3 py-1.5 rounded-lg bg-secondary border border-[var(--border-primary)] text-[9px] font-black uppercase tracking-widest hover:bg-tertiary transition-all"
            >
              {t("engineering.permissions.back")}
            </button>
            <div>
              {renameMode ? (
                <div className="flex items-center gap-2">
                  <input
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    placeholder={t("engineering.permissions.renamePlaceholder")}
                    className="w-56 bg-secondary border border-[var(--border-primary)] rounded-lg px-3 py-1.5 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/50"
                  />
                  <button
                    onClick={renameProfile}
                    disabled={!renameValue.trim()}
                    className="px-3 py-1.5 rounded-lg bg-[var(--brand-orange)] text-black text-[8px] font-black uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-40"
                  >
                    {t("common.save")}
                  </button>
                  <button
                    onClick={() => {
                      setRenameMode(false);
                      setRenameValue("");
                    }}
                    className="px-3 py-1.5 rounded-lg bg-secondary border border-[var(--border-primary)] text-[8px] font-black uppercase tracking-widest hover:bg-tertiary transition-all"
                  >
                    {t("engineering.permissions.cancel")}
                  </button>
                </div>
              ) : (
                <h3 className="text-sm font-black text-[var(--text-primary)] uppercase">
                  {selectedProfile.name}
                </h3>
              )}
              {selectedProfile.description && (
                <p className="text-[9px] font-bold text-[var(--text-secondary)] mt-0.5">
                  {selectedProfile.description}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                setRenameMode(!renameMode);
                setRenameValue(selectedProfile.name);
              }}
              className="p-2 rounded-lg hover:bg-tertiary transition-all text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              title={t("engineering.permissions.renameProfile")}
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <span
              className={`text-[9px] font-black px-2 py-1 rounded ${
                selectedProfile.is_active
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-red-500/10 text-red-400"
              }`}
            >
              {selectedProfile.is_active
                ? t("engineering.permissions.active")
                : t("engineering.permissions.disabled")}
            </span>
          </div>
        </div>

        {isDefaultFor.length > 0 && (
          <div
            className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30"
          >
            <p className="text-[9px] font-bold text-amber-400">
              {t("engineering.permissions.profileInUseWarning", {
                roles: isDefaultFor.join(", "),
              })}
            </p>
          </div>
        )}

        {actionMsg && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <p className="text-[10px] font-bold text-emerald-400">
              {actionMsg}
            </p>
          </div>
        )}
        {actionError && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
            <p className="text-[10px] font-bold text-red-400">{actionError}</p>
          </div>
        )}

        <div className="space-y-4">
          {Object.entries(availableModules).map(([modKey, mod]) => (
            <div
              key={modKey}
              className="ios-card !p-0 border-[var(--border-primary)] overflow-hidden"
            >
              <div className="px-5 py-3 bg-tertiary/30 border-b border-[var(--border-primary)]">
                <h4 className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-wider">
                  {mod.name}
                </h4>
              </div>
              <div className="p-3">
                <div className="flex flex-wrap gap-2">
                  {mod.capabilities.map((cap) => {
                    const level = getLevel(modKey, cap);
                    const isEditing = editingCap === `${modKey}:${cap}`;
                    return (
                      <div key={cap} className="relative group">
                        <button
                          onClick={() => {
                            if (isEditing) {
                              requestCapabilityEdit(modKey, cap, editValue);
                            } else {
                              setEditingCap(`${modKey}:${cap}`);
                              setEditValue(level);
                            }
                          }}
                          className={`px-3 py-2 rounded-lg border text-[8px] font-black uppercase tracking-wider transition-all ${
                            level > 0
                              ? "bg-[var(--brand-orange)]/10 border-[var(--brand-orange)]/30 text-[var(--brand-orange)]"
                              : "bg-secondary border-[var(--border-primary)] text-slate-500 opacity-50 hover:opacity-100"
                          }`}
                        >
                          {capabilityLabel(modKey, cap)}
                          <span
                            className={`ml-1.5 ${ACCESS_COLORS[level] || "text-slate-500"}`}
                          >
                            {ACCESS_SHORT[level] || "—"}
                          </span>
                        </button>
                        {isEditing && (
                          <div className="absolute top-full left-0 mt-2 p-2 bg-secondary border border-[var(--border-primary)] rounded-xl shadow-xl z-10 flex gap-1">
                            {LEVELS_ORDER.map((l) => (
                              <button
                                key={l}
                                onClick={() => {
                                  setEditValue(l);
                                  requestCapabilityEdit(modKey, cap, l);
                                }}
                                className={`w-7 h-7 rounded text-[8px] font-black transition-all ${
                                  editValue === l
                                    ? "bg-[var(--brand-orange)] text-black"
                                    : "bg-tertiary text-[var(--text-secondary)] hover:bg-[var(--brand-orange)]/30"
                                }`}
                              >
                                {ACCESS_SHORT[l]}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Profile-safety confirmation for role-bound profiles */}
        {pendingCapEdit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0"
              style={{ background: "rgba(0,0,0,0.7)" }}
              onClick={() => setPendingCapEdit(null)}
            />
            <div
              className="relative w-full max-w-md rounded-2xl p-6 shadow-2xl"
              style={{ background: "var(--surface-1)", border: "1px solid var(--border-primary)" }}
            >
              <h4 className="text-sm font-black uppercase tracking-tight" style={{ color: "var(--text-primary)" }}>
                {t("engineering.permissions.confirmChanges")}
              </h4>
              <p className="text-[10px] font-bold mt-2" style={{ color: "var(--text-secondary)" }}>
                {t("engineering.permissions.profileInUseWarning", {
                  roles: pendingCapEdit.roles.join(", "),
                })}
              </p>
              <p className="text-[10px] font-bold mt-1" style={{ color: "var(--text-tertiary)" }}>
                {capabilityLabel(pendingCapEdit.module, pendingCapEdit.capability)} → {t(ACCESS_LEVEL_KEYS[pendingCapEdit.level] || "engineering.permissions.accessLevelNone")}
              </p>
              <div className="flex justify-end gap-2 mt-5">
                <button
                  onClick={() => setPendingCapEdit(null)}
                  className="px-4 py-2 rounded-xl bg-secondary border border-[var(--border-primary)] text-[9px] font-black uppercase tracking-widest hover:bg-tertiary transition-all"
                >
                  {t("engineering.permissions.cancel")}
                </button>
                <button
                  onClick={confirmCapabilityEdit}
                  className="px-4 py-2 rounded-xl bg-[var(--brand-orange)] text-black text-[9px] font-black uppercase tracking-widest hover:opacity-90 transition-all"
                >
                  {t("engineering.permissions.confirmChanges")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── LIST VIEW ───
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-[var(--text-secondary)]">
          {t("engineering.permissions.profilesIntro")}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setShowRoleDefaultForm(!showRoleDefaultForm)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-secondary border border-[var(--border-primary)] text-[9px] font-black uppercase tracking-widest hover:bg-tertiary transition-all"
          >
            <Settings className="w-3 h-3" /> {t("engineering.permissions.roleDefault")}
          </button>
          <button
            onClick={() => setShowAssignForm(!showAssignForm)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-secondary border border-[var(--border-primary)] text-[9px] font-black uppercase tracking-widest hover:bg-tertiary transition-all"
          >
            <UserCheck className="w-3 h-3" /> {t("engineering.permissions.assign")}
          </button>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--brand-orange)] text-black text-[9px] font-black uppercase tracking-widest hover:opacity-90 transition-all"
          >
            <Plus className="w-3 h-3" /> {t("engineering.permissions.newProfile")}
          </button>
        </div>
      </div>

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

      {/* Create Form */}
      {showCreateForm && (
        <div className="ios-card !p-5 border-[var(--border-primary)] space-y-4">
          <h4 className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-wider">
            {t("engineering.permissions.newAccessProfile")}
          </h4>
          <div className="space-y-3">
            <input
              value={newProfile.name}
              onChange={(e) =>
                setNewProfile({ ...newProfile, name: e.target.value })
              }
              placeholder={t("engineering.permissions.profileNamePlaceholder")}
              className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/50 transition-all"
            />
            <input
              value={newProfile.description}
              onChange={(e) =>
                setNewProfile({ ...newProfile, description: e.target.value })
              }
              placeholder={t("engineering.permissions.descriptionOptional")}
              className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/50 transition-all"
            />
            <div className="flex gap-2">
              <button
                onClick={createProfile}
                disabled={!newProfile.name.trim()}
                className="px-4 py-2 rounded-xl bg-[var(--brand-orange)] text-black text-[9px] font-black uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50"
              >
                {t("engineering.permissions.create")}
              </button>
              <button
                onClick={() => {
                  setShowCreateForm(false);
                  setNewProfile({ name: "", description: "" });
                }}
                className="px-4 py-2 rounded-xl bg-secondary border border-[var(--border-primary)] text-[9px] font-black uppercase tracking-widest hover:bg-tertiary transition-all"
              >
                {t("engineering.permissions.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Form */}
      {showAssignForm && (
        <div className="ios-card !p-5 border-[var(--border-primary)] space-y-4">
          <h4 className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-wider">
            {t("engineering.permissions.assignProfileTitle")}
          </h4>
          <p className="text-[9px] font-bold text-[var(--text-secondary)]">
            {t("engineering.permissions.assignHint")}
          </p>
          <div className="space-y-3">
            <input
              value={assignData.user_cid}
              onChange={(e) =>
                setAssignData({ ...assignData, user_cid: e.target.value })
              }
              placeholder={t("engineering.permissions.userCid")}
              className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/50 transition-all"
            />
            <select
              value={assignData.profile_id}
              onChange={(e) =>
                setAssignData({ ...assignData, profile_id: e.target.value })
              }
              className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/50 transition-all"
            >
              <option value="">
                {t("engineering.permissions.selectProfileRemoveOverride")}
              </option>
              {profiles
                .filter((p) => p.is_active)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              <option value="">{t("engineering.permissions.clearOverride")}</option>
            </select>
            <div className="flex gap-2">
              <button
                onClick={assignProfileToUser}
                disabled={!assignData.user_cid}
                className="px-4 py-2 rounded-xl bg-[var(--brand-orange)] text-black text-[9px] font-black uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50"
              >
                {t("engineering.permissions.assign")}
              </button>
              <button
                onClick={() => {
                  setShowAssignForm(false);
                  setAssignData({ user_cid: "", profile_id: "" });
                }}
                className="px-4 py-2 rounded-xl bg-secondary border border-[var(--border-primary)] text-[9px] font-black uppercase tracking-widest hover:bg-tertiary transition-all"
              >
                {t("engineering.permissions.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role Default Form */}
      {showRoleDefaultForm && (
        <div className="ios-card !p-5 border-[var(--border-primary)] space-y-4">
          <h4 className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-wider">
            {t("engineering.permissions.setRoleDefaultTitle")}
          </h4>
          <p className="text-[9px] font-bold text-[var(--text-secondary)]">
            {t("engineering.permissions.roleDefaultHint")}
          </p>
          <div className="space-y-3">
            <select
              value={roleDefaultData.role_name}
              onChange={(e) =>
                setRoleDefaultData({
                  ...roleDefaultData,
                  role_name: e.target.value,
                })
              }
              className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/50 transition-all"
            >
              <option value="">{t("engineering.permissions.selectRole")}</option>
              {[
                "super_admin",
                "staff",
                "participant",
                "developer",
                "intern",
                "program_manager",
                "teacher",
                "admin",
                "investor",
                "mentor",
              ].map((r) => (
                <option key={r} value={r}>
                  {r.replace(/_/g, " ")}
                  {roleDefaults[r]
                    ? t("engineering.permissions.currentSuffix", {
                        name: roleDefaults[r].profileName,
                      })
                    : ""}
                </option>
              ))}
            </select>
            <select
              value={roleDefaultData.profile_id}
              onChange={(e) =>
                setRoleDefaultData({
                  ...roleDefaultData,
                  profile_id: e.target.value,
                })
              }
              className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/50 transition-all"
            >
              <option value="">{t("engineering.permissions.selectProfile")}</option>
              {profiles
                .filter((p) => p.is_active)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={setRoleDefault}
                disabled={
                  !roleDefaultData.role_name || !roleDefaultData.profile_id
                }
                className="px-4 py-2 rounded-xl bg-[var(--brand-orange)] text-black text-[9px] font-black uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50"
              >
                {t("engineering.permissions.setDefault")}
              </button>
              <button
                onClick={() => {
                  setShowRoleDefaultForm(false);
                  setRoleDefaultData({ role_name: "", profile_id: "" });
                }}
                className="px-4 py-2 rounded-xl bg-secondary border border-[var(--border-primary)] text-[9px] font-black uppercase tracking-widest hover:bg-tertiary transition-all"
              >
                {t("engineering.permissions.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile List */}
      {profiles.length === 0 ? (
        <div className="py-10 text-center opacity-40">
          <Layers className="w-12 h-12 text-slate-500 mx-auto mb-3" />
          <p className="text-sm font-black text-[var(--text-primary)] uppercase">
            {t("engineering.permissions.noAccessProfiles")}
          </p>
          <p className="text-[10px] font-bold text-slate-500 mt-1">
            {t("engineering.permissions.noAccessProfilesHint")}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {profiles.map((profile) => {
            const isDefaultFor = Object.entries(roleDefaults)
              .filter(([, v]) => v.profileId === profile.id)
              .map(([role]) => role);

            return (
              <div
                key={profile.id}
                className={`ios-card !p-0 border-[var(--border-primary)] overflow-hidden transition-all ${
                  !profile.is_active ? "opacity-50" : ""
                }`}
              >
                <div className="p-4 flex items-center justify-between">
                  <button
                    onClick={() => selectProfile(profile)}
                    className="flex-1 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <Layers className="w-4 h-4 text-[var(--brand-orange)]" />
                      <div>
                        <h4 className="text-xs font-black text-[var(--text-primary)] uppercase">
                          {profile.name}
                        </h4>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-[8px] font-bold text-[var(--text-secondary)]">
                            {t("engineering.permissions.capabilitiesCount", { count: profile.capability_count || 0 })}
                          </span>
                          {isDefaultFor.length > 0 && (
                            <span className="text-[8px] font-bold text-blue-400">
                              {t("engineering.permissions.defaultFor", { roles: isDefaultFor.join(", ") })}
                            </span>
                          )}
                          {profile.description && (
                            <span className="text-[8px] font-bold text-slate-500 truncate max-w-[200px]">
                              {profile.description}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => duplicateProfile(profile)}
                      title={t("engineering.permissions.duplicateProfileTitle")}
                      className="p-2 rounded-lg hover:bg-tertiary transition-all text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => toggleProfileActive(profile)}
                      title={
                        profile.is_active
                          ? t("engineering.permissions.disableProfile")
                          : t("engineering.permissions.enableProfile")
                      }
                      className="p-2 rounded-lg hover:bg-tertiary transition-all text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    >
                      {profile.is_active ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ResponsibilitiesView() {
  const { t } = useI18n();
  const [selectedUser, setSelectedUser] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [responsibilities, setResponsibilities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const [actionError, setActionError] = useState("");

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/contacts");
      const data = await res.json();
      if (data.success) {
        const sorted = (data.contacts || []).sort((a, b) =>
          (a.name || "").localeCompare(b.name || ""),
        );
        setAllUsers(sorted);
        setSearchResults(sorted);
      }
    } catch (e) {
      console.error("Failed to fetch users", e);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const selectUser = async (user) => {
    setSelectedUser(user);
    setLoading(true);
    setActionMsg("");
    setActionError("");
    try {
      const res = await fetch(
        `/api/responsibilities/assign?user_cid=${user.cid}`,
      );
      const data = await res.json();
      if (data.success) {
        setResponsibilities(data.responsibilities || []);
      }
    } catch (e) {
      console.error("Failed to fetch responsibilities", e);
    } finally {
      setLoading(false);
    }
  };

  const toggleResponsibility = async (resp) => {
    setActionMsg("");
    setActionError("");
    const action = resp.assigned ? "remove" : "assign";

    // Optimistic update
    setResponsibilities((prev) =>
      prev.map((r) => (r.id === resp.id ? { ...r, assigned: !r.assigned } : r)),
    );

    try {
      const res = await fetch("/api/responsibilities/assign", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_cid: selectedUser.cid,
          responsibility_id: resp.id,
          action,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg(t(data.message || "") || data.message);
      } else {
        // Revert
        setResponsibilities((prev) =>
          prev.map((r) =>
            r.id === resp.id ? { ...r, assigned: !r.assigned } : r,
          ),
        );
        setActionError(t((data.error || t("engineering.permissions.actionFailed")) || "") || (data.error || t("engineering.permissions.actionFailed")));
      }
    } catch (e) {
      setResponsibilities((prev) =>
        prev.map((r) =>
          r.id === resp.id ? { ...r, assigned: !r.assigned } : r,
        ),
      );
      setActionError(t("engineering.permissions.networkError"));
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

  return (
    <div className="space-y-6">
      <p className="text-xs font-bold text-[var(--text-secondary)]">
        {t("engineering.permissions.responsibilitiesIntro")}
      </p>

      {/* User Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
        <input
          value={searchQuery}
          onChange={(e) => searchUsers(e.target.value)}
          placeholder={t("engineering.permissions.responsibilitiesSearchPlaceholder")}
          className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl pl-10 pr-4 py-3 text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/50 font-bold text-xs transition-all"
        />
      </div>

      {/* User List */}
      {!selectedUser && (
        <div className="space-y-1 max-w-md">
          {searchResults.slice(0, 20).map((u) => (
            <button
              key={u.cid}
              onClick={() => selectUser(u)}
              className="w-full ios-card !p-3 border-[var(--border-primary)] hover:border-[var(--brand-orange)]/30 transition-all text-left flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                  <User className="w-4 h-4 text-[var(--brand-orange)]" />
                </div>
                <div>
                  <p className="text-[11px] font-black text-[var(--text-primary)] uppercase">
                    {u.name}
                  </p>
                  <p className="text-[8px] font-bold text-[var(--text-secondary)]">
                    {u.role}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
            </button>
          ))}
          {searchResults.length === 0 && (
            <p className="text-[10px] font-bold text-slate-500 py-4 text-center">
              {t("engineering.permissions.noUsersFound")}
            </p>
          )}
        </div>
      )}

      {/* Selected User Responsibilities */}
      {selectedUser && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setSelectedUser(null);
                  setResponsibilities([]);
                }}
                className="px-3 py-1.5 rounded-lg bg-secondary border border-[var(--border-primary)] text-[9px] font-black uppercase tracking-widest hover:bg-tertiary transition-all"
              >
                {t("engineering.permissions.back")}
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                  <User className="w-5 h-5 text-[var(--brand-orange)]" />
                </div>
                <div>
                  <p className="text-sm font-black text-[var(--text-primary)] uppercase">
                    {selectedUser.name}
                  </p>
                  <p className="text-[9px] font-bold text-[var(--text-secondary)]">
                    {selectedUser.role} · {selectedUser.email}
                  </p>
                </div>
              </div>
            </div>
          </div>

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

          {(() => {
            const blockedAssigned = responsibilities.filter(
              (r) =>
                r.assigned &&
                isResponsibilityBlockedForRole(
                  selectedUser.role,
                  r.key,
                  r.allowed_roles,
                ),
            );
            if (blockedAssigned.length === 0) return null;
            return (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
                <p className="text-[10px] font-bold text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {t("engineering.permissions.responsibilityRoleWarningTitle")}
                </p>
                <p className="text-[9px] font-bold text-amber-400/90 mt-1">
                  {t("engineering.permissions.responsibilityRoleWarningBody", {
                    role: selectedUser.role,
                    features: blockedAssigned.map((r) => r.name).join(", "),
                  })}
                </p>
              </div>
            );
          })()}

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div
                className="w-6 h-6 border-2 border-t-[var(--brand-orange)] rounded-full animate-spin"
                style={{
                  borderColor: "rgba(255,102,0,0.1)",
                  borderTopColor: "var(--brand-orange)",
                }}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {responsibilities.map((resp) => (
                <button
                  key={resp.id}
                  onClick={() => toggleResponsibility(resp)}
                  className={`ios-card !p-4 border transition-all text-left ${
                    resp.assigned
                      ? "border-[var(--brand-orange)]/40 bg-[var(--brand-orange)]/5"
                      : "border-[var(--border-primary)] opacity-60 hover:opacity-100"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Award
                        className={`w-4 h-4 ${
                          resp.assigned
                            ? "text-[var(--brand-orange)]"
                            : "text-slate-500"
                        }`}
                      />
                      <div>
                        <p
                          className={`text-[10px] font-black uppercase tracking-wider ${
                            resp.assigned
                              ? "text-[var(--brand-orange)]"
                              : "text-[var(--text-primary)]"
                          }`}
                        >
                          {resp.name}
                        </p>
                        {resp.description && (
                          <p className="text-[8px] font-bold text-[var(--text-secondary)] mt-0.5">
                            {resp.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0 ${
                        resp.assigned
                          ? "bg-[var(--brand-orange)] border-[var(--brand-orange)]"
                          : "border-slate-500"
                      }`}
                    >
                      {resp.assigned && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-black" />
                      )}
                    </div>
                  </div>
                  {isResponsibilityBlockedForRole(
                    selectedUser.role,
                    resp.key,
                    resp.allowed_roles,
                  ) && (
                    <p className="mt-2 flex items-start gap-1 text-[8px] font-bold text-amber-400">
                      <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                      <span>
                        {t("engineering.permissions.responsibilityRoleWarning", {
                          role: selectedUser.role,
                          feature: resp.name,
                          roles: (normalizeAllowedRoles(resp.allowed_roles) ??
                            defaultAllowedRoles(resp.key) ??
                            []
                          ).join(", "),
                        })}
                      </span>
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ResponsibilityAccessView() {
  const { t } = useI18n();
  const [responsibilities, setResponsibilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [saveMsg, setSaveMsg] = useState("");
  const [saveError, setSaveError] = useState("");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/responsibilities");
      const data = await res.json();
      if (data.success) setResponsibilities(data.responsibilities || []);
    } catch (e) {
      console.error("Failed to fetch responsibilities", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const effectiveRoles = (resp) =>
    normalizeAllowedRoles(resp.allowed_roles) ??
    defaultAllowedRoles(resp.key) ??
    [];

  const saveAccess = async (resp, allowedRoles) => {
    setSavingId(resp.id);
    setSaveMsg("");
    setSaveError("");
    // Optimistic update
    setResponsibilities((prev) =>
      prev.map((r) =>
        r.id === resp.id ? { ...r, allowed_roles: [...allowedRoles] } : r,
      ),
    );
    try {
      const res = await fetch("/api/responsibilities/access", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: resp.id, allowed_roles: allowedRoles }),
      });
      const data = await res.json();
      if (data.success) {
        setSaveMsg(t("engineering.permissions.accessSaved"));
        setTimeout(() => setSaveMsg(""), 2500);
      } else {
        setSaveError(t((data.error || t("engineering.permissions.accessSaveFailed")) || "") || (data.error || t("engineering.permissions.accessSaveFailed")));
        fetchAll();
      }
    } catch (e) {
      setSaveError(t("engineering.permissions.networkError"));
      fetchAll();
    } finally {
      setSavingId(null);
    }
  };

  const toggleRole = (resp, role) => {
    const current = effectiveRoles(resp);
    const next = current.includes(role)
      ? current.filter((r) => r !== role)
      : [...current, role];
    saveAccess(resp, next);
  };

  const resetAccess = async (resp) => {
    setSavingId(resp.id);
    setSaveMsg("");
    setSaveError("");
    try {
      const res = await fetch("/api/responsibilities/access", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: resp.id, allowed_roles: null }),
      });
      const data = await res.json();
      if (data.success) {
        setResponsibilities((prev) =>
          prev.map((r) =>
            r.id === resp.id ? { ...r, allowed_roles: null } : r,
          ),
        );
        setSaveMsg(t("engineering.permissions.accessReset"));
        setTimeout(() => setSaveMsg(""), 2500);
      } else {
        setSaveError(t((data.error || t("engineering.permissions.accessSaveFailed")) || "") || (data.error || t("engineering.permissions.accessSaveFailed")));
      }
    } catch (e) {
      setSaveError(t("engineering.permissions.networkError"));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-xs font-bold text-[var(--text-secondary)]">
        {t("engineering.permissions.responsibilityAccessIntro")}
      </p>

      {saveMsg && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <p className="text-[10px] font-bold text-emerald-400">{saveMsg}</p>
        </div>
      )}
      {saveError && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
          <p className="text-[10px] font-bold text-red-400">{saveError}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div
            className="w-6 h-6 border-2 border-t-[var(--brand-orange)] rounded-full animate-spin"
            style={{
              borderColor: "rgba(255,102,0,0.1)",
              borderTopColor: "var(--brand-orange)",
            }}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {responsibilities.map((resp) => {
            const effective = effectiveRoles(resp);
            const isCustom = resp.allowed_roles !== null;
            return (
              <div
                key={resp.id}
                className="ios-card !p-5 border-[var(--border-primary)]"
              >
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] font-black text-[var(--text-primary)] uppercase tracking-wider">
                        {resp.name}
                      </p>
                      <span
                        className={`text-[7px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                          isCustom
                            ? "bg-[var(--brand-orange)]/10 text-[var(--brand-orange)]"
                            : "bg-slate-500/10 text-slate-400"
                        }`}
                      >
                        {isCustom
                          ? t("engineering.permissions.accessCustom")
                          : t("engineering.permissions.accessDefaults")}
                      </span>
                    </div>
                    {resp.description && (
                      <p className="text-[8px] font-bold text-[var(--text-secondary)] mt-0.5">
                        {resp.description}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => resetAccess(resp)}
                    disabled={savingId === resp.id}
                    className="shrink-0 px-2.5 py-1.5 rounded-lg bg-secondary border border-[var(--border-primary)] text-[8px] font-black uppercase tracking-widest hover:bg-tertiary transition-all disabled:opacity-40"
                  >
                    {t("engineering.permissions.accessReset")}
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {ALL_FEATURE_ROLES.map((role) => {
                    const active = effective.includes(role);
                    const saving = savingId === resp.id;
                    return (
                      <button
                        key={role}
                        onClick={() => toggleRole(resp, role)}
                        disabled={saving}
                        title={role}
                        className={`text-[8px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-lg border transition-all disabled:opacity-50 ${
                          active
                            ? "bg-[var(--brand-orange)]/10 border-[var(--brand-orange)]/40 text-[var(--brand-orange)]"
                            : "bg-primary border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] opacity-70 hover:opacity-100"
                        }`}
                      >
                        {role}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Eligibility configuration (Phase A — Permissions control center) ───────
// Membership/Identity → Feature → Eligible / Not Eligible / Unset.
// Persisted in feature_eligibility; consumed by the same resolver that
// enforces every API route. Read = permissions.view_matrix; write =
// permissions.configure_eligibility (a dedicated authority, deliberately
// separate from assign_capabilities).

function EligibilityView() {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [identityType, setIdentityType] = useState("role");
  const [identityValue, setIdentityValue] = useState("");
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [viewMode, setViewMode] = useState("identity"); // identity | matrix

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/engineering/permissions/eligibility");
      const d = await res.json();
      if (d.success) {
        setData(d);
        setErr("");
      } else {
        setErr(t(d.error || "errors.somethingWrong"));
      }
    } catch {
      setErr(t("engineering.permissions.networkError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  // Rebuild the draft whenever the identity changes.
  useEffect(() => {
    if (!data) return;
    const rows = (data.rows || []).filter(
      (r) =>
        r.identity_type === identityType &&
        r.identity_value === identityValue,
    );
    const next = {};
    for (const r of rows) next[r.feature_key] = Number(r.eligible);
    setDraft(next);
    setMsg("");
    setErr("");
  }, [identityType, identityValue, data]);

  const identities =
    (identityType === "role" ? data?.roles : data?.groups) || [];
  const canConfigure = !!data?.canConfigure;
  const selected = identityValue || null;

  const currentRows = {};
  if (data && selected) {
    for (const r of data.rows || []) {
      if (
        r.identity_type === identityType &&
        r.identity_value === selected
      ) {
        currentRows[r.feature_key] = Number(r.eligible);
      }
    }
  }

  const hasChanges = (data?.features || []).some((f) => {
    const cur = currentRows[f] ?? null;
    const next = draft[f] ?? null;
    return cur !== next;
  });

  const setFeature = (featureKey, value) => {
    setDraft((prev) => ({ ...prev, [featureKey]: value }));
  };

  const save = async () => {
    if (!selected || !hasChanges) return;
    setSaving(true);
    const changes = [];
    for (const f of data.features || []) {
      const cur = currentRows[f] ?? null;
      const next = draft[f] ?? null;
      if (cur !== next) {
        changes.push({
          feature_key: f,
          identity_type: identityType,
          identity_value: selected,
          eligible: next,
        });
      }
    }
    try {
      const res = await fetch("/api/engineering/permissions/eligibility", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes }),
      });
      const d = await res.json();
      if (d.success) {
        setData((prev) => ({ ...prev, rows: d.rows }));
        setMsg(t("engineering.permissions.eligibilitySaved"));
        setTimeout(() => setMsg(""), 2500);
      } else if (res.status === 403) {
        setErr(t("engineering.permissions.eligibilityNoPermission"));
      } else {
        setErr(t("engineering.permissions.eligibilitySaveFailed"));
      }
    } catch {
      setErr(t("engineering.permissions.networkError"));
    } finally {
      setSaving(false);
    }
  };

  const stateBtn = (featureKey, value, labelKey, activeCls) => {
    const active = draft[featureKey] === value;
    return (
      <button
        onClick={() => setFeature(featureKey, value)}
        disabled={!canConfigure}
        title={t(labelKey)}
        className={`px-2.5 py-1 rounded-lg border text-[8px] font-black uppercase tracking-wider transition-all disabled:opacity-40 ${active ? activeCls : "bg-primary border-[var(--border-primary)] text-[var(--text-secondary)] opacity-60 hover:opacity-100"}`}
      >
        {t(labelKey)}
      </button>
    );
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-[var(--brand-orange)] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* View toggle: identity editor vs roles × features matrix */}
      <div className="flex gap-1 bg-secondary rounded-xl p-1 border border-[var(--border-primary)] w-fit">
        <button
          onClick={() => setViewMode("identity")}
          className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === "identity" ? "bg-[var(--brand-orange)] text-black" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
        >
          {t("engineering.permissions.eligibilityIdentityView")}
        </button>
        <button
          onClick={() => setViewMode("matrix")}
          className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === "matrix" ? "bg-[var(--brand-orange)] text-black" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
        >
          {t("engineering.permissions.eligibilityMatrixView")}
        </button>
      </div>

      {/* Matrix view: roles × features — click a cell to edit that identity */}
      {viewMode === "matrix" && data && (
        <div className="ios-card !p-0 border-[var(--border-primary)] overflow-hidden">
          <div className="p-3 bg-secondary border-b border-[var(--border-primary)]">
            <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-primary)]">
              {t("engineering.permissions.eligibilityMatrixTitle")}
            </p>
            <p className="text-[8px] font-bold text-[var(--text-secondary)] mt-0.5">
              {t("engineering.permissions.eligibilityMatrixHint")}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[var(--border-primary)]">
                  <th className="px-3 py-2 text-[8px] font-black uppercase tracking-widest text-[var(--text-secondary)] sticky left-0 bg-secondary">
                    {t("engineering.permissions.eligibilityIdentity")}
                  </th>
                  {(data.features || []).map((f) => (
                    <th
                      key={f}
                      className="px-2 py-2 text-[8px] font-black uppercase tracking-wider text-[var(--text-secondary)] whitespace-nowrap"
                    >
                      {f}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data.roles || []).map((role) => (
                  <tr
                    key={role}
                    className="border-b border-[var(--border-primary)] last:border-0"
                  >
                    <td className="px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-[var(--text-primary)] sticky left-0 bg-secondary">
                      {role}
                    </td>
                    {(data.features || []).map((f) => {
                      const row = (data.rows || []).find(
                        (r) =>
                          r.identity_type === "role" &&
                          r.identity_value === role &&
                          r.feature_key === f,
                      );
                      const value = row ? Number(row.eligible) : null;
                      return (
                        <td key={f} className="px-2 py-1.5 text-center">
                          <button
                            onClick={() => {
                              setIdentityType("role");
                              setIdentityValue(role);
                              setViewMode("identity");
                            }}
                            title={`${role} → ${f}: ${value === 1 ? t("engineering.permissions.eligibilityEligible") : value === 0 ? t("engineering.permissions.eligibilityNotEligible") : t("engineering.permissions.eligibilityUnset")}`}
                            className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider ${
                              value === 1
                                ? "bg-emerald-500/15 text-emerald-400"
                                : value === 0
                                  ? "bg-red-500/15 text-red-400"
                                  : "bg-primary text-[var(--text-secondary)] opacity-50"
                            }`}
                          >
                            {value === 1
                              ? "E"
                              : value === 0
                                ? "D"
                                : "—"}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex items-start gap-2 p-3 rounded-xl bg-[var(--brand-orange)]/5 border border-[var(--brand-orange)]/20">
        <Info className="w-3.5 h-3.5 text-[var(--brand-orange)] shrink-0 mt-0.5" />
        <p className="text-[9px] font-bold text-[var(--text-secondary)]">
          {t("engineering.permissions.eligibilityHint")}
        </p>
      </div>

      {!canConfigure && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
          <p className="text-[9px] font-bold text-amber-400">
            {t("engineering.permissions.eligibilityReadOnly")}
          </p>
        </div>
      )}

      {/* Identity selector */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] mb-1.5">
            {t("engineering.permissions.eligibilityIdentityType")}
          </p>
          <div className="flex gap-1 bg-secondary rounded-xl p-1 border border-[var(--border-primary)] w-fit">
            {["role", "group"].map((type) => (
              <button
                key={type}
                onClick={() => {
                  setIdentityType(type);
                  setIdentityValue("");
                }}
                className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${identityType === type ? "bg-[var(--brand-orange)] text-black" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
              >
                {type === "role"
                  ? t("engineering.permissions.eligibilityRole")
                  : t("engineering.permissions.eligibilityGroup")}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 min-w-[200px]">
          <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] mb-1.5">
            {t("engineering.permissions.eligibilityIdentity")}
          </p>
          <select
            value={identityValue}
            onChange={(e) => setIdentityValue(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-orange)]"
          >
            <option value="">
              {t("engineering.permissions.eligibilitySelectIdentity")}
            </option>
            {identities.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selected ? (
        <>
          <div className="ios-card !p-0 border-[var(--border-primary)] overflow-hidden">
            <div className="p-3 bg-secondary border-b border-[var(--border-primary)] flex items-center justify-between gap-3 flex-wrap">
              <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-primary)]">
                {identityType === "role"
                  ? t("engineering.permissions.eligibilityRole")
                  : t("engineering.permissions.eligibilityGroup")}
                : {selected}
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                {msg && (
                  <span className="text-[9px] font-bold text-emerald-400">
                    {msg}
                  </span>
                )}
                {err && (
                  <span className="text-[9px] font-bold text-red-400">
                    {err}
                  </span>
                )}
                <button
                  onClick={save}
                  disabled={!canConfigure || !hasChanges || saving}
                  className="px-4 py-2 rounded-lg bg-[var(--brand-orange)] text-black text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-40"
                >
                  {saving
                    ? t("engineering.permissions.eligibilitySaving")
                    : t("engineering.permissions.eligibilitySave")}
                </button>
              </div>
            </div>
            <div className="divide-y divide-[var(--border-primary)]">
              {(data?.features || []).map((featureKey) => {
                const state = draft[featureKey];
                const cur = currentRows[featureKey] ?? null;
                const dirty = cur !== (state ?? null);
                return (
                  <div
                    key={featureKey}
                    className={`flex items-center justify-between gap-3 px-4 py-2.5 ${dirty ? "bg-[var(--brand-orange)]/5" : ""}`}
                  >
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-primary)]">
                        {featureKey}
                      </p>
                      <p className="text-[8px] font-bold text-[var(--text-secondary)] opacity-60">
                        {state === 1
                          ? t("engineering.permissions.eligibilityEligible")
                          : state === 0
                            ? t("engineering.permissions.eligibilityNotEligible")
                            : t("engineering.permissions.eligibilityUnset")}
                        {dirty
                          ? " • " + t("engineering.permissions.eligibilityDirty")
                          : ""}
                      </p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      {stateBtn(
                        featureKey,
                        1,
                        "engineering.permissions.eligibilityEligible",
                        "bg-emerald-500/15 border-emerald-500/40 text-emerald-400",
                      )}
                      {stateBtn(
                        featureKey,
                        0,
                        "engineering.permissions.eligibilityNotEligible",
                        "bg-red-500/15 border-red-500/40 text-red-400",
                      )}
                      {stateBtn(
                        featureKey,
                        null,
                        "engineering.permissions.eligibilityUnset",
                        "bg-primary border-[var(--border-primary)] text-[var(--text-primary)]",
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <p className="text-[8px] font-bold text-[var(--text-secondary)]">
            {t("engineering.permissions.eligibilityLegend")}
          </p>
        </>
      ) : (
        <div className="py-10 text-center opacity-40">
          <Shield className="w-10 h-10 text-slate-500 mx-auto mb-3" />
          <p className="text-[10px] font-black text-[var(--text-primary)] uppercase">
            {t("engineering.permissions.eligibilityNoIdentity")}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Access explanation (Phase 2 — “who has access and why”) ─────────────────
// Renders the resolver's buildPermissionExplanation output: per-feature
// eligibility (with the identity rows that produced it) + the capability
// inputs (Default Access base, group capabilities, individual grants).

function AccessExplanationPanel({ explanation, t }) {
  const [open, setOpen] = useState(false);
  const eligibility = explanation.eligibility || {};
  const sources = explanation.sources || {};
  const hasEligibility = Object.keys(eligibility).length > 0;
  const hasSources =
    (sources.profile && Object.keys(sources.profile).length > 0) ||
    (sources.groups && Object.keys(sources.groups).length > 0) ||
    (sources.grants && Object.keys(sources.grants).length > 0);

  if (!hasEligibility && !hasSources) return null;

  const sourceBlock = (labelKey, data) => {
    const entries = Object.entries(data || {}).filter(
      ([, caps]) => caps && Object.keys(caps).length > 0,
    );
    if (entries.length === 0) return null;
    return (
      <div>
        <p className="text-[8px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
          {t(labelKey)}
        </p>
        <p className="text-[9px] font-bold text-[var(--text-primary)] mt-0.5">
          {entries
            .map(([mod, caps]) =>
              `${mod}: ${Object.entries(caps)
                .map(([cap, lvl]) => `${cap}=${lvl}`)
                .join(", ")}`,
            )
            .join(" · ")}
        </p>
      </div>
    );
  };

  return (
    <div className="ios-card !p-0 border-[var(--border-primary)] overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-tertiary/30 hover:bg-tertiary/50 transition-all"
      >
        <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-primary)] flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-[var(--brand-orange)]" />
          {t("engineering.permissions.explanationTitle")}
        </span>
        {open ? (
          <ChevronDown className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
        )}
      </button>
      {open && (
        <div className="p-4 space-y-3 divide-y divide-[var(--border-primary)]">
          <div>
            <p className="text-[8px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
              {t("engineering.permissions.explanationEligibility")}
            </p>
            {Object.keys(eligibility).length === 0 ? (
              <p className="text-[9px] font-bold text-slate-500 mt-1">
                {t("engineering.permissions.explanationNone")}
              </p>
            ) : (
              <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                {Object.entries(eligibility).map(([feature, info]) => (
                  <div key={feature} className="flex items-start gap-2">
                    <span
                      className={`mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                        info.eligible ? "bg-emerald-400" : "bg-red-400"
                      }`}
                    />
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-wider text-[var(--text-primary)]">
                        {feature}
                      </p>
                      <p className="text-[8px] font-bold text-[var(--text-secondary)]">
                        {info.eligible
                          ? t("engineering.permissions.eligibilityEligible")
                          : t("engineering.permissions.eligibilityNotEligible")}
                        {(info.sources || []).length > 0 &&
                          ` — ${info.sources
                            .map(
                              (s) => `${s.identity_type}:${s.identity_value}${Number(s.eligible) === 0 ? " (deny)" : ""}`,
                            )
                            .join(", ")}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="pt-3 space-y-2">
            <p className="text-[8px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
              {t("engineering.permissions.explanationSources")}
            </p>
            {sourceBlock(
              "engineering.permissions.explanationDefaultAccess",
              sources.profile,
            )}
            {sourceBlock(
              "engineering.permissions.explanationGroups",
              sources.groups,
            )}
            {sourceBlock(
              "engineering.permissions.explanationGrants",
              sources.grants,
            )}
            {!hasSources && (
              <p className="text-[9px] font-bold text-slate-500">
                {t("engineering.permissions.explanationNone")}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

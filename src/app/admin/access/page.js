"use client";

import React, { useState } from "react";
import { useI18n } from "@/lib/i18n";
import {
  Search,
  User,
  Shield,
  ChevronRight,
  X,
  Layers,
  Award,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  Briefcase,
  UserCheck,
} from "lucide-react";
import { isResponsibilityBlockedForRole } from "@/lib/featureAccess";
import { useApi } from "@/lib/hooks/useApi";

// ─── Module-scope readers ────────────────────────────────────────────────────
// The reading hook keys its internal work on these, so they are made once here
// rather than rebuilt on every render.

const CONTACTS_URL = "/api/contacts";
const PERMISSIONS_URL = "/api/engineering/permissions";

// Stable shapes: the hook keys its internal work on these too.
const EMPTY_MODULES = {};

/**
 * The people list, people who are active first and then by name. The payload is
 * copied before sorting because it comes back through a shared cache: sorting it
 * in place would reorder the cached copy for every other screen reading it.
 */
const pickPeople = (payload) => {
  if (!payload?.success) return [];
  return [...(payload.contacts || [])].sort((first, second) => {
    if (first.status === "active" && second.status !== "active") return -1;
    if (first.status !== "active" && second.status === "active") return 1;
    return (first.name || "").localeCompare(second.name || "");
  });
};

const pickModules = (payload) => (payload?.success ? payload.modules || {} : EMPTY_MODULES);

const filterPeople = (people, query) => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return people;
  return people.filter(
    (person) =>
      (person.name || "").toLowerCase().includes(normalizedQuery) ||
      (person.email || "").toLowerCase().includes(normalizedQuery) ||
      (person.cid || "").toLowerCase().includes(normalizedQuery),
  );
};

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
  const [selectedUser, setSelectedUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(false);
  const PAGE_SIZE = 20;

  // The people and the module catalogue, read through the shared hook: it owns
  // the cache, the cache-first paint and the discarding of a stale answer, so
  // the page keeps no copy of its own and reads its data during render.
  const { data: allUsers, refresh: refreshUsers } = useApi(CONTACTS_URL, {
    defaultValue: [],
    transform: pickPeople,
  });
  const { data: modules } = useApi(PERMISSIONS_URL, {
    defaultValue: EMPTY_MODULES,
    transform: pickModules,
  });

  // The visible list is the whole list filtered by what is typed, so it is
  // derived: held as a second copy it could disagree with the query that made it.
  const searchResults = filterPeople(allUsers, searchQuery);
  const [supervisorQuery, setSupervisorQuery] = useState("");
  const [showSupervisorPicker, setShowSupervisorPicker] = useState(false);
  const [savingSupervisor, setSavingSupervisor] = useState(false);
  const [supervisorMsg, setSupervisorMsg] = useState("");
  const [supervisorError, setSupervisorError] = useState("");

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
    } catch (error) {
      console.error("Failed to fetch user summary", error);
    } finally {
      setLoading(false);
    }
  };

  const currentSupervisor = userData?.user?.supervisor_cid
    ? allUsers.find((person) => person.cid === userData.user.supervisor_cid) || {
        cid: userData.user.supervisor_cid,
        name: userData.user.supervisor_cid,
        email: "",
      }
    : null;

  const filteredSupervisors = (() => {
    if (!supervisorQuery.trim()) return allUsers.slice(0, 8);
    const normalizedQuery = supervisorQuery.toLowerCase();
    return allUsers
      .filter(
        (person) =>
          (person.name || "").toLowerCase().includes(normalizedQuery) ||
          (person.email || "").toLowerCase().includes(normalizedQuery),
      )
      .slice(0, 8);
  })();

  const assignSupervisor = async (supervisor) => {
    setSavingSupervisor(true);
    setSupervisorMsg("");
    setSupervisorError("");
    try {
      const response = await fetch("/api/engineering/permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_supervisor",
          user_cid: selectedUser.cid,
          supervisor_cid: supervisor.cid,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setSupervisorMsg(t("adminMisc.access.supervisorAssigned"));
        setShowSupervisorPicker(false);
        setSupervisorQuery("");
        await fetchUserSummary(selectedUser);
      } else {
        setSupervisorError(
          t((data.error || t("adminMisc.access.supervisorError")) || "") ||
            (data.error || t("adminMisc.access.supervisorError")),
        );
      }
    } catch {
      setSupervisorError(t("adminMisc.access.supervisorError"));
    } finally {
      setSavingSupervisor(false);
    }
  };

  const removeSupervisor = async () => {
    setSavingSupervisor(true);
    setSupervisorMsg("");
    setSupervisorError("");
    try {
      const response = await fetch("/api/engineering/permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "remove_supervisor",
          user_cid: selectedUser.cid,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setSupervisorMsg(t("adminMisc.access.supervisorRemoved"));
        await fetchUserSummary(selectedUser);
      } else {
        setSupervisorError(
          t((data.error || t("adminMisc.access.supervisorError")) || "") ||
            (data.error || t("adminMisc.access.supervisorError")),
        );
      }
    } catch {
      setSupervisorError(t("adminMisc.access.supervisorError"));
    } finally {
      setSavingSupervisor(false);
    }
  };

  // Pagination
  //
  // The page belongs to the query it was chosen under: changing the query starts
  // again at the first page. Kept as an effect this ran after the render, so the
  // list was drawn for one frame under the previous query's page number.
  const [pageChoice, setPageChoice] = useState({ query: "", page: 1 });
  const currentPage = pageChoice.query === searchQuery ? pageChoice.page : 1;
  const totalPages = Math.max(1, Math.ceil(searchResults.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedUsers = searchResults.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );
  const goToPage = (page) => setPageChoice({ query: searchQuery, page });

  // ─── RENDER ───
  return (
    <>
      <div className="space-y-8 pb-20">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-[var(--border-primary)] pb-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[var(--brand-orange)]" />
              <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                {t("adminMisc.access.administration")}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-[var(--text-primary)]">
              {t("adminMisc.access.title")}
            </h1>
            <p className="text-sm text-[var(--text-secondary)]">
              {t("adminMisc.access.subtitle")}
            </p>
          </div>
          <button
            onClick={() => { setSelectedUser(null); setUserData(null); refreshUsers(); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-secondary border border-[var(--border-primary)] rounded-xl text-[10px] font-bold uppercase tracking-wide hover:bg-tertiary transition-all"
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
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={t("adminMisc.access.searchPlaceholder")}
                className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl pl-10 pr-4 py-3 text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/50 text-sm font-bold transition-all"
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
                  {paginatedUsers.map((person) => (
                    <button
                      key={person.cid}
                      onClick={() => fetchUserSummary(person)}
                      className="w-full ios-card !p-4 border-[var(--border-primary)] hover:border-[var(--brand-orange)]/30 transition-all text-left flex items-center justify-between"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                          <User className="w-5 h-5 text-[var(--brand-orange)]" />
                        </div>
                        <div>
                          <p className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide">
                            {person.name}
                          </p>
                          <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                            {person.email} · {person.role} · {person.status}
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
                        onClick={() => goToPage(Math.max(1, safePage - 1))}
                        disabled={safePage === 1}
                        className="px-3 py-2 rounded-lg border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--brand-orange)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                      >
                        {t("common.previous")}
                      </button>
                      <button
                        onClick={() => goToPage(Math.min(totalPages, safePage + 1))}
                        disabled={safePage === totalPages}
                        className="px-3 py-2 rounded-lg border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--brand-orange)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
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
                  <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                    {userData.user.email}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-orange-500/10 text-[var(--brand-orange)] uppercase">
                      {userData.user.role}
                    </span>
                    {(userData.groups || []).map((group) => (
                      <span key={group} className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 uppercase">
                        {group}
                      </span>
                    ))}
                    {/* Access Profile Badge */}
                    {userData.profile.assigned && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 uppercase">
                        {userData.profile.assigned.name}
                      </span>
                    )}
                    {!userData.profile.assigned && userData.profile.roleDefault && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-500/10 text-teal-400 uppercase">
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
                      <h3 className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-primary)]">
                        {t("adminMisc.access.accessProfile")}
                      </h3>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-medium text-[var(--text-secondary)]">{t("adminMisc.access.effectiveProfile")}</span>
                        <span className={`text-[10px] font-bold ${userData.profile.effectiveSource === "user" ? "text-purple-400" : userData.profile.effectiveSource === "role" ? "text-teal-400" : "text-[var(--text-secondary)]"}`}>
                          {userData.profile.assigned?.name || userData.profile.roleDefault?.name || t("adminMisc.access.legacyRoleCapabilities")}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-medium text-[var(--text-secondary)]">{t("adminMisc.access.source")}</span>
                        <span className="text-[10px] font-bold text-[var(--text-primary)]">
                          {userData.profile.effectiveSource === "user" ? t("adminMisc.access.sourceUserOverride") : userData.profile.effectiveSource === "role" ? t("adminMisc.access.sourceRoleDefault") : t("adminMisc.access.sourceLegacy")}
                        </span>
                      </div>
                      {userData.profile.assigned && (
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-medium text-[var(--text-secondary)]">{t("adminMisc.access.roleDefault")}</span>
                          <span className="text-[10px] font-bold text-[var(--text-primary)]">
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
                      <h3 className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-primary)]">
                        {t("adminMisc.access.responsibilities")}
                      </h3>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--brand-orange)]/10 text-[var(--brand-orange)]">
                        {(userData.responsibilities || []).length}
                      </span>
                    </div>
                    {(() => {
                      const userRole = userData.user?.role || selectedUser?.role;
                      const blocked = (userData.responsibilities || []).filter((responsibility) =>
                        isResponsibilityBlockedForRole(userRole, responsibility.key, responsibility.allowed_roles),
                      );
                      if (blocked.length === 0) return null;
                      return (
                        <div className="mb-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
                          <p className="text-sm font-bold text-amber-400 flex items-center gap-1.5">
                            <AlertTriangle className="w-3 h-3" />
                            {t("adminMisc.access.roleIncompatibilityTitle")}
                          </p>
                          <p className="text-sm text-amber-400/90 mt-1">
                            {t("adminMisc.access.roleIncompatibilityBody", {
                              role: userRole,
                              features: blocked.map((responsibility) => responsibility.name).join(", "),
                            })}
                          </p>
                        </div>
                      );
                    })()}
                    {userData.responsibilities.length === 0 ? (
                      <p className="text-sm text-[var(--text-secondary)]">{t("adminMisc.access.noResponsibilities")}</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {userData.responsibilities.map((responsibility) => {
                          const userRole = userData.user?.role || selectedUser?.role;
                          const blocked = isResponsibilityBlockedForRole(userRole, responsibility.key, responsibility.allowed_roles);
                          return (
                            <span
                              key={responsibility.id}
                              title={blocked ? t("adminMisc.access.roleIncompatibilityTitle") : undefined}
                              className={`text-[10px] font-bold px-2 py-1 rounded uppercase flex items-center gap-1 ${
                                blocked
                                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                                  : "bg-[var(--brand-orange)]/10 text-[var(--brand-orange)]"
                              }`}
                            >
                              {blocked && <AlertTriangle className="w-2.5 h-2.5" />}
                              {responsibility.name}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Assignments Card (contact_roles — program/venture/form scoped titles) */}
                  <div className="ios-card !p-5 border-[var(--border-primary)]">
                    <div className="flex items-center gap-2 mb-4">
                      <Briefcase className="w-4 h-4 text-[var(--brand-orange)]" />
                      <h3 className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-primary)]">
                        {t("adminMisc.access.assignments")}
                      </h3>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--brand-orange)]/10 text-[var(--brand-orange)]">
                        {(userData.assignments || []).length}
                      </span>
                    </div>
                    {(userData.assignments || []).length === 0 ? (
                      <p className="text-sm text-[var(--text-secondary)]">{t("adminMisc.access.noAssignments")}</p>
                    ) : (
                      <div className="space-y-2">
                        {(userData.assignments || []).map((assignment, index) => {
                          let scopeLabel = "";
                          try {
                            const scope = typeof assignment.scope === "string" ? JSON.parse(assignment.scope) : assignment.scope;
                            if (scope?.type === "program") scopeLabel = "Program";
                            else if (scope?.type === "groups") scopeLabel = `Groups (${(scope.groupIds || []).length})`;
                            else if (scope?.type === "individuals") scopeLabel = `Individuals (${(scope.cids || []).length})`;
                          } catch (_) {}
                          const isCurrent = assignment.is_current !== false;
                          return (
                            <div
                              key={index}
                              className={`rounded-xl border p-3 ${
                                isCurrent
                                  ? "border-[var(--brand-orange)]/20 bg-[var(--brand-orange)]/[0.03]"
                                  : "border-[var(--border-primary)] bg-tertiary/40 opacity-60"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <p className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide">
                                  {assignment.title || assignment.role}
                                </p>
                                {isCurrent ? (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 uppercase">
                                    Current
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-500/10 text-[var(--text-secondary)] uppercase">
                                    Ended
                                  </span>
                                )}
                              </div>
                              <div className="mt-1.5 space-y-0.5">
                                <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                                  {assignment.context_type} · {assignment.context_id || "global"}
                                  {scopeLabel ? ` · ${scopeLabel}` : ""}
                                </p>
                                {assignment.status && (
                                  <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                                    Status: {assignment.status}
                                  </p>
                                )}
                                {(assignment.capability_overrides || assignment.permissions) &&
                                  typeof (assignment.capability_overrides || assignment.permissions) === "object" &&
                                  Object.keys(assignment.capability_overrides || assignment.permissions).length > 0 && (
                                    <div className="flex flex-wrap gap-1 pt-1">
                                      {Object.keys(assignment.capability_overrides || assignment.permissions).map((capability) => (
                                        <span
                                          key={capability}
                                          className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 uppercase"
                                        >
                                          {capability.replace(/\./g, " ")}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                {(() => {
                                  const blockedFeatures = (userData.responsibilities || [])
                                    .filter((responsibility) => isResponsibilityBlockedForRole(assignment.role, responsibility.key, responsibility.allowed_roles))
                                    .map((responsibility) => responsibility.name);
                                  if (blockedFeatures.length === 0) return null;
                                  return (
                                    <p className="flex items-start gap-1 text-sm font-bold text-amber-400 pt-1">
                                      <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                                      <span>
                                        {t("adminMisc.access.assignmentRoleWarning", {
                                          role: assignment.role,
                                          features: blockedFeatures.join(", "),
                                        })}
                                      </span>
                                    </p>
                                  );
                                })()}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Supervisor Card */}
                  <div className="ios-card !p-5 border-[var(--border-primary)]">
                    <div className="flex items-center gap-2 mb-4">
                      <UserCheck className="w-4 h-4 text-[var(--brand-orange)]" />
                      <h3 className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-primary)]">
                        {t("adminMisc.access.supervisor")}
                      </h3>
                    </div>

                    {supervisorMsg && (
                      <p className="text-sm font-bold text-emerald-400 mb-2">
                        {supervisorMsg}
                      </p>
                    )}
                    {supervisorError && (
                      <p className="text-sm font-bold text-red-400 mb-2">
                        {supervisorError}
                      </p>
                    )}

                    {currentSupervisor ? (
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide truncate">
                            {currentSupervisor.name}
                          </p>
                          {currentSupervisor.email && (
                            <p className="text-[10px] font-medium text-[var(--text-secondary)] truncate">
                              {currentSupervisor.email}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={removeSupervisor}
                          disabled={savingSupervisor}
                          className="shrink-0 px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-[10px] font-bold uppercase tracking-wide hover:bg-red-500/20 transition-all disabled:opacity-40"
                        >
                          {t("adminMisc.access.removeSupervisor")}
                        </button>
                      </div>
                    ) : showSupervisorPicker ? (
                      <div className="space-y-2">
                        <input
                          value={supervisorQuery}
                          onChange={(event) => setSupervisorQuery(event.target.value)}
                          placeholder={t("adminMisc.access.supervisorSearchPlaceholder")}
                          className="w-full bg-secondary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/50"
                        />
                        <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
                          {filteredSupervisors.map((person) => (
                            <button
                              key={person.cid}
                              onClick={() => assignSupervisor(person)}
                              disabled={savingSupervisor}
                              className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg hover:bg-tertiary transition-all text-left"
                            >
                              <div className="min-w-0">
                                <p className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide truncate">
                                  {person.name || person.cid}
                                </p>
                                <p className="text-[10px] font-medium text-[var(--text-secondary)] truncate">
                                  {person.email}
                                </p>
                              </div>
                              <span className="text-[10px] font-bold text-[var(--brand-orange)] shrink-0">
                                {person.role}
                              </span>
                            </button>
                          ))}
                          {filteredSupervisors.length === 0 && (
                            <p className="text-sm text-[var(--text-secondary)] py-2 text-center">
                              {t("adminMisc.access.supervisorNoResults")}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            setShowSupervisorPicker(false);
                            setSupervisorQuery("");
                          }}
                          className="text-[10px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        >
                          {t("common.cancel")}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowSupervisorPicker(true)}
                        className="w-full px-3 py-2 rounded-lg bg-secondary border border-dashed border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)] hover:text-[var(--brand-orange)] hover:border-[var(--brand-orange)]/40 transition-all"
                      >
                        {t("adminMisc.access.assignSupervisor")}
                      </button>
                    )}
                  </div>

                  {/* Permission Overrides Card */}
                  <div className="ios-card !p-5 border-[var(--border-primary)]">
                    <div className="flex items-center gap-2 mb-4">
                      <AlertTriangle className="w-4 h-4 text-[var(--brand-orange)]" />
                      <h3 className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-primary)]">
                        {t("adminMisc.access.permissionOverrides")}
                      </h3>
                    </div>
                    {(userData.individualGrants || []).length === 0 && (userData.individualRestrictions || []).length === 0 ? (
                      <p className="text-sm text-[var(--text-secondary)]">{t("adminMisc.access.noOverrides")}</p>
                    ) : (
                      <div className="space-y-3">
                        {(userData.individualGrants || []).length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 mb-1.5">{t("adminMisc.access.grants")}</p>
                            <div className="space-y-1">
                              {userData.individualGrants.map((grant, index) => (
                                <div key={index} className="flex items-center gap-2 text-[10px] font-medium">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                  <span className="text-[var(--text-primary)]">{grant.module}.{grant.capability.replace(/_/g, " ")}</span>
                                  <span className={ACCESS_COLORS[grant.access_level] || "text-slate-500"}>({t(ACCESS_LEVEL_KEYS[grant.access_level] || "adminMisc.access.accessLevelNone")})</span>
                                  {grant.expires_at && (
                                    <span className="text-[var(--text-secondary)] flex items-center gap-1">
                                      <Clock className="w-2.5 h-2.5" />
                                      {new Date(grant.expires_at).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {(userData.individualRestrictions || []).length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-red-400 mb-1.5">{t("adminMisc.access.restrictions")}</p>
                            <div className="space-y-1">
                              {userData.individualRestrictions.map((restriction, index) => (
                                <div key={index} className="flex items-center gap-2 text-[10px] font-medium">
                                  <X className="w-3 h-3 text-red-400" />
                                  <span className="text-[var(--text-primary)]">{restriction.module}.{restriction.capability.replace(/_/g, " ")}</span>
                                  {restriction.expires_at && (
                                    <span className="text-[var(--text-secondary)] flex items-center gap-1">
                                      <Clock className="w-2.5 h-2.5" />
                                      {new Date(restriction.expires_at).toLocaleDateString()}
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
                    <h3 className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-primary)]">
                      {t("adminMisc.access.accessibleModules")}
                    </h3>
                  </div>
                  <div className="space-y-4">
                    {MODULE_CATEGORIES.map((category) => {
                      const hasAccess = category.modules.some(
                        (moduleKey) => userData.effectivePermissions[moduleKey] && Object.keys(userData.effectivePermissions[moduleKey]).length > 0,
                      );
                      if (!hasAccess) return null;
                      return (
                        <div key={category.label}>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2">
                            {t(category.label)}
                          </p>
                          {category.modules.map((modKey) => {
                            const modData = modules[modKey];
                            const permissions = userData.effectivePermissions[modKey];
                            if (!permissions || Object.keys(permissions).length === 0) return null;
                            return (
                              <div key={modKey} className="mb-3 last:mb-0">
                                <p className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide mb-1">
                                  {modData?.name || modKey}
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  {Object.entries(permissions).map(([capability, level]) => (
                                    <span key={capability} className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                      level > 0
                                        ? "bg-[var(--brand-orange)]/10 text-[var(--brand-orange)]"
                                        : "bg-slate-500/10 text-[var(--text-secondary)]"
                                    }`}>
                                      {capability.replace(/_/g, " ")}
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
    </>
  );
}

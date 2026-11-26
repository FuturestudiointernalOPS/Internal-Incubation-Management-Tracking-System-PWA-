"use client";

import {
  User,
  Shield,
  X,
  Layers,
  Award,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
} from "lucide-react";
import { isResponsibilityBlockedForRole } from "@/lib/featureAccess";
import UserSearchPanel from "./user-access-view/SearchPanel";
import AssignmentsCard from "./user-access-view/AssignmentsCard";
import SupervisorCard from "./user-access-view/SupervisorCard";

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

export default function UserAccessView({ ctx }) {
  const {
    assignSupervisor,
    currentSupervisor,
    fetchUserSummary,
    filteredSupervisors,
    goToPage,
    loading,
    modules,
    paginatedUsers,
    refreshUsers,
    removeSupervisor,
    safePage,
    savingSupervisor,
    searchQuery,
    selectedUser,
    setSearchQuery,
    setSelectedUser,
    setShowSupervisorPicker,
    setSupervisorQuery,
    setUserData,
    showSupervisorPicker,
    summaryError,
    supervisorError,
    supervisorMsg,
    supervisorQuery,
    t,
    totalPages,
    userData,
    usersError,
    usersLoading,
    usersStatus,
  } = ctx;

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
          <UserSearchPanel
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            usersLoading={usersLoading}
            usersError={usersError}
            usersStatus={usersStatus}
            refreshUsers={refreshUsers}
            paginatedUsers={paginatedUsers}
            fetchUserSummary={fetchUserSummary}
            totalPages={totalPages}
            safePage={safePage}
            goToPage={goToPage}
            t={t}
          />
        )}

        {/* User Summary */}
        {selectedUser && (
          <div className="space-y-6">
            {/* User Info Bar */}
            {userData && (
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
                aria-label={t("common.close")}
                className="p-2 hover:bg-tertiary rounded-lg transition-all"
              >
                <X className="w-4 h-4 text-[var(--text-secondary)]" />
              </button>
            </div>
            )}

            {summaryError && !loading ? (
              <div className="card p-10 text-center">
                <AlertTriangle className="w-12 h-12 text-rose-500/40 mx-auto mb-3" />
                <p className="text-sm text-[var(--text-secondary)]">{summaryError}</p>
                <button
                  onClick={() => fetchUserSummary(selectedUser)}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 bg-secondary border border-[var(--border-primary)] rounded-xl text-[10px] font-bold uppercase tracking-wide hover:bg-tertiary transition-all"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> {t("common.retry")}
                </button>
              </div>
            ) : loading || !userData ? (
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
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-brand-orange/10 text-[var(--brand-orange)]">
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
                                  : "bg-brand-orange/10 text-[var(--brand-orange)]"
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
                  <AssignmentsCard userData={userData} t={t} />

                  {/* Supervisor Card */}
                  <SupervisorCard
                    currentSupervisor={currentSupervisor}
                    supervisorMsg={supervisorMsg}
                    supervisorError={supervisorError}
                    removeSupervisor={removeSupervisor}
                    savingSupervisor={savingSupervisor}
                    showSupervisorPicker={showSupervisorPicker}
                    setShowSupervisorPicker={setShowSupervisorPicker}
                    supervisorQuery={supervisorQuery}
                    setSupervisorQuery={setSupervisorQuery}
                    filteredSupervisors={filteredSupervisors}
                    assignSupervisor={assignSupervisor}
                    t={t}
                  />

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
                                        ? "bg-brand-orange/10 text-[var(--brand-orange)]"
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

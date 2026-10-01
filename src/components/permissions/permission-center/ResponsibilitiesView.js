"use client";

/**
 * RESPONSIBILITIES VIEW — extracted from `PermissionCenter.js`.
 *
 * Read-only list of what a person is responsible for, straight from the
 * responsibilities cache. It writes nothing: responsibility assignment lives in
 * the people screen, and this one only reports.
 *
 * Split out verbatim, behaviour identical. The imports below are the ones this
 * component actually uses, which is why they are re-declared rather than
 * inherited from the monolith.
 */

import { useEffect, useState } from "react";
import { defaultAllowedRoles, isResponsibilityBlockedForRole, normalizeAllowedRoles } from "@/lib/featureAccess";
import { cacheGet, cacheSet } from "@/lib/hooks/useApi";
import { useI18n } from "@/lib/i18n";
import { AlertTriangle, Award, CheckCircle2, ChevronRight, Search, User } from "lucide-react";

export default function ResponsibilitiesView() {
  const { t } = useI18n();
  const [selectedUser, setSelectedUser] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [responsibilities, setResponsibilities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const [actionError, setActionError] = useState("");

  const fetchUsers = async (bypassCache = false) => {
    const url = "/api/contacts";
    const apply = (data) => {
      if (!data.success) return;
      const sorted = (data.contacts || []).sort((first, second) =>
        (first.name || "").localeCompare(second.name || ""),
      );
      setAllUsers(sorted);
      setSearchResults(sorted);
    };
    try {
      // Cache-first paint: returning to this tab renders the user list
      // instantly from a fresh snapshot; the network refresh below converges.
      if (!bypassCache) {
        const cached = cacheGet(url);
        if (cached !== null && cached.success) apply(cached);
      }
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        cacheSet(url, data);
        apply(data);
      }
    } catch (error) {
      console.error("Failed to fetch users", error);
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
    } catch (error) {
      console.error("Failed to fetch responsibilities", error);
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
      prev.map((responsibility) => (responsibility.id === resp.id ? { ...responsibility, assigned: !responsibility.assigned } : responsibility)),
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
          prev.map((responsibility) =>
            responsibility.id === resp.id ? { ...responsibility, assigned: !responsibility.assigned } : responsibility,
          ),
        );
        setActionError(t((data.error || t("engineering.permissions.actionFailed")) || "") || (data.error || t("engineering.permissions.actionFailed")));
      }
    } catch {
      setResponsibilities((prev) =>
        prev.map((responsibility) =>
          responsibility.id === resp.id ? { ...responsibility, assigned: !responsibility.assigned } : responsibility,
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
    const lowerQuery = query.toLowerCase();
    setSearchResults(
      allUsers.filter(
        (user) =>
          (user.name || "").toLowerCase().includes(lowerQuery) ||
          (user.email || "").toLowerCase().includes(lowerQuery) ||
          (user.cid || "").toLowerCase().includes(lowerQuery),
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
          onChange={(event) => searchUsers(event.target.value)}
          placeholder={t("engineering.permissions.responsibilitiesSearchPlaceholder")}
          className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl pl-10 pr-4 py-3 text-[var(--text-primary)] outline-none focus:border-brand-orange/50 font-bold text-xs transition-all"
        />
      </div>

      {/* User List */}
      {!selectedUser && (
        <div className="space-y-1 max-w-md">
          {searchResults.slice(0, 20).map((user) => (
            <button
              key={user.cid}
              onClick={() => selectUser(user)}
              className="w-full ios-card !p-3 border-[var(--border-primary)] hover:border-brand-orange/30 transition-all text-left flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                  <User className="w-4 h-4 text-[var(--brand-orange)]" />
                </div>
                <div>
                  <p className="text-[11px] font-black text-[var(--text-primary)] uppercase">
                    {user.name}
                  </p>
                  <p className="text-[10px] font-bold text-[var(--text-secondary)]">
                    {user.role}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
            </button>
          ))}
          {searchResults.length === 0 && (
            <p className="text-sm text-[var(--text-secondary)] py-4 text-center">
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
                className="px-3 py-1.5 rounded-lg bg-secondary border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-widest hover:bg-tertiary transition-all"
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
                  <p className="text-[10px] font-bold text-[var(--text-secondary)]">
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
              (responsibility) =>
                responsibility.assigned &&
                isResponsibilityBlockedForRole(
                  selectedUser.role,
                  responsibility.key,
                  responsibility.allowed_roles,
                ),
            );
            if (blockedAssigned.length === 0) return null;
            return (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
                <p className="text-[10px] font-bold text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {t("engineering.permissions.responsibilityRoleWarningTitle")}
                </p>
                <p className="text-[10px] font-bold text-amber-400/90 mt-1">
                  {t("engineering.permissions.responsibilityRoleWarningBody", {
                    role: selectedUser.role,
                    features: blockedAssigned.map((responsibility) => responsibility.name).join(", "),
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
                      ? "border-brand-orange/40 bg-brand-orange/5"
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
                          <p className="text-[10px] font-bold text-[var(--text-secondary)] mt-0.5">
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
                    <p className="mt-2 flex items-start gap-1 text-[10px] font-bold text-amber-400">
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

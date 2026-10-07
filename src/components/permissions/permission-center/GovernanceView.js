"use client";

import { useEffect, useState } from "react";
import Badge from "@/components/permissions/ui/Badge";
import StatCard from "@/components/permissions/ui/StatCard";
import { cacheGet, cacheSet } from "@/lib/hooks/useApi";
import { useI18n } from "@/lib/i18n";
import { deriveMembershipStatus } from "@/lib/membership-ui";

/* ─── Phase 7: Governance overview ───────────────────────────────────────── */

/*
 * Memberships (formerly the "Governance" / "Advanced" door). Exported because
 * Phase 2 retired that door: the screen now lives under Context & Scope, next
 * to the context-role registry it reads its data from. Exported rather than
 * moved to keep that change reviewable; Phase 3 is where the file move
 * actually happened, and it happened here. The shim keeps re-exporting this
 * name because `ContextScopeView.js` imports it from `./PermissionCenter`,
 * and that file is outside the corridor this phase is allowed to touch.
 */
export default function GovernanceView() {
  const { t } = useI18n();
  const [memberships, setMemberships] = useState(null);
  const [protectedMap, setProtectedMap] = useState({});
  const [recent, setRecent] = useState([]);
  const [roleDefaults, setRoleDefaults] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const urls = [
      "/api/org-membership",
      "/api/engineering/permissions/audit?pageSize=10",
      "/api/engineering/permissions/profiles",
    ];
    const apply = (memData, audData, profData) => {
      if (cancelled) return;
      if (memData.success) {
        setMemberships(memData.memberships || []);
        setProtectedMap(memData.protected || {});
      }
      if (audData.success) setRecent(audData.entries || []);
      if (profData.success) setRoleDefaults(profData.role_defaults || {});
    };
    (async () => {
      try {
        // Cache-first paint: returning to this tab renders instantly from
        // fresh snapshots; the network refresh below converges.
        const cached = urls.map((url) => cacheGet(url));
        if (cached.every((cachedEntry) => cachedEntry !== null && cachedEntry.success)) {
          apply(cached[0], cached[1], cached[2]);
          setLoading(false);
        }
        const [memRes, audRes, profRes] = await Promise.all([
          fetch(urls[0]),
          fetch(urls[1]),
          fetch(urls[2]),
        ]);
        const memData = await memRes.json();
        const audData = await audRes.json();
        const profData = await profRes.json();
        if (!cancelled) {
          if (memData.success) cacheSet(urls[0], memData);
          if (audData.success) cacheSet(urls[1], audData);
          if (profData.success) cacheSet(urls[2], profData);
          apply(memData, audData, profData);
        }
      } catch {
        /* informational view — degrade gracefully */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const futureStudioMemberships = (memberships || []).filter((membership) => membership.group_name === "FUTURE STUDIO");
  const stats = { active: 0, expiringSoon: 0, expired: 0, ended: 0 };
  for (const membership of futureStudioMemberships) {
    const status = deriveMembershipStatus(membership);
    stats[status] = (stats[status] || 0) + 1;
  }

  const protectedGroups = Object.entries(protectedMap)
    .filter(([, isProtected]) => isProtected)
    .map(([name]) => name);
  const defaultProfiles = Object.entries(roleDefaults).map(([role, defaultsEntry]) => ({
    role,
    profileName:
      typeof defaultsEntry === "string"
        ? defaultsEntry
        : defaultsEntry?.profileName || defaultsEntry?.profileId,
  }));

  const statCard = (label, value, tone) => (
    <StatCard label={label} value={value} tone={tone} />
  );

  return (
    <div className="space-y-6">
      <p className="text-xs font-bold text-[var(--text-secondary)]">
        {t("engineering.permissions.governanceIntro")}
      </p>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((index) => (
            <div key={index} className="h-20 rounded-xl animate-pulse" style={{ background: "var(--surface-3)" }} />
          ))}
        </div>
      ) : (
        <>
          {/* Membership status — FUTURE STUDIO */}
          <div className="space-y-2">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
              {t("engineering.permissions.governanceMembership")}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {statCard(t("engineering.permissions.governanceActive"), stats.active, "success")}
              {statCard(t("engineering.permissions.governanceExpiringSoon"), stats.expiringSoon, "warning")}
              {statCard(t("engineering.permissions.governanceExpired"), stats.expired, "denied")}
              {statCard(t("engineering.permissions.governanceEnded"), stats.ended, "neutral")}
            </div>
          </div>

          {/* Recent permission changes */}
          <div className="space-y-2">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
              {t("engineering.permissions.governanceRecent")}
            </h3>
            {recent.length === 0 ? (
              <div
                className="rounded-xl p-4 text-[10px]"
                style={{
                  background: "var(--surface-2)",
                  border: "1px dashed var(--border-primary)",
                  color: "var(--text-tertiary)",
                }}
              >
                {t("engineering.permissions.governanceNoRecent")}
              </div>
            ) : (
              <div
                className="rounded-xl divide-y overflow-hidden"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border-primary)" }}
              >
                {recent.map((entry) => (
                  <div key={entry.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-[var(--text-primary)] truncate">
                        {entry.actor_name || entry.actor_cid} → {entry.target_name || entry.target_cid}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge variant="neutral">{entry.action}</Badge>
                        {entry.module && (
                          <span className="text-[10px] font-bold text-[var(--text-tertiary)]">
                            {entry.module}.{entry.capability || "*"}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-[var(--text-tertiary)] whitespace-nowrap">
                      {entry.created_at ? new Date(entry.created_at).toLocaleDateString("en-GB") : "—"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Protected configuration */}
          <div className="space-y-2">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
              {t("engineering.permissions.governanceProtected")}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div
                className="rounded-xl p-4"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border-primary)" }}
              >
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)] mb-2">
                  {t("engineering.permissions.governanceProtectedGroups")}
                </p>
                {protectedGroups.length === 0 ? (
                  <p className="text-[10px] text-[var(--text-tertiary)]">—</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {protectedGroups.map((group) => (
                      <span
                        key={group}
                        className="px-2 py-1 rounded-md text-[10px] font-bold uppercase bg-amber-500/10 text-amber-400"
                      >
                        {group}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div
                className="rounded-xl p-4"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border-primary)" }}
              >
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)] mb-2">
                  {t("engineering.permissions.governanceDefaultProfiles")}
                </p>
                {defaultProfiles.length === 0 ? (
                  <p className="text-[10px] text-[var(--text-tertiary)]">—</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {defaultProfiles.map((profile) => (
                      <span
                        key={profile.role}
                        className="px-2 py-1 rounded-md text-[10px] font-bold uppercase bg-teal-500/10 text-teal-400"
                      >
                        {profile.role} → {profile.profileName}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

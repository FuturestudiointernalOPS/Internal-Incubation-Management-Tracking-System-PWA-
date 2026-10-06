"use client";

/**
 * CAPABILITY "WHY" MODAL — extracted from `PermissionCenter.js`.
 *
 * When someone asks where a right comes from, this explains ONE capability:
 * which sources hold it, and the membership status behind the row.
 *
 * It explains, it does not decide. `deriveMembershipStatus` labels the context a
 * membership sits in; it is never used to re-derive the effective level, because
 * the report has to mirror the resolver exactly or it will contradict it.
 *
 * Split out verbatim, behaviour identical.
 */

import { useEffect, useState } from "react";
import { ACCESS_LEVEL_KEYS } from "@/components/permissions/levelChips";
import { capabilityLabel } from "@/models/authorization/capability-catalog";
import { deriveMembershipStatus } from "@/lib/membership-ui";
import { X } from "lucide-react";

export default function CapabilityWhyModal({ userPerms, module, capability, t, lang, onClose }) {
  const [memberships, setMemberships] = useState(null);
  const cid = userPerms?.user?.cid;

  useEffect(() => {
    if (!cid) return;
    let cancelled = false;
    fetch(`/api/org-membership?user_cid=${encodeURIComponent(cid)}`)
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled && data.success) setMemberships(data.memberships || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [cid]);

  if (!userPerms) return null;

  const user = userPerms.user || {};
  const feature = userPerms.moduleToFeature?.[module] || module;
  const eligibility = userPerms.explanation?.eligibility?.[feature] || { eligible: false, sources: [] };
  const sources = userPerms.explanation?.sources || {};
  const baseLevel = sources.profile?.[module]?.[capability] || 0;
  const groupLevel = sources.groups?.[module]?.[capability] || 0;
  const grant = (userPerms.individualGrants || []).find((grant) => grant.module === module && grant.capability === capability);
  const restriction = (userPerms.individualRestrictions || []).find(
    (restriction) => restriction.module === module && restriction.capability === capability,
  );
  const effective = userPerms.effectivePermissions?.[module]?.[capability] || 0;
  const allowed = effective > 0;
  const profile = userPerms.effectiveProfile;

  const levelLabel = (lvl) =>
    t(ACCESS_LEVEL_KEYS[lvl] || "engineering.permissions.accessLevelNone");

  const fmtDate = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const memberRows = memberships || [];
  const activeMembers = memberRows.filter((membership) =>
    ["active", "expiringSoon"].includes(deriveMembershipStatus(membership)),
  );
  const inactiveMembers = memberRows.filter((membership) =>
    ["expired", "ended"].includes(deriveMembershipStatus(membership)),
  );

  const row = (label, value, toneClass) => (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] shrink-0">
        {label}
      </span>
      <span
        className={`text-[10px] font-bold text-right ${toneClass || "text-[var(--text-primary)]"}`}
      >
        {value}
      </span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.7)" }} onClick={onClose} />
      <div
        className="relative w-full max-w-lg rounded-2xl p-6 shadow-2xl max-h-[85vh] overflow-y-auto"
        style={{ background: "var(--surface-1)", border: "1px solid var(--border-primary)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-sm font-black uppercase tracking-tight" style={{ color: "var(--text-primary)" }}>
              {capabilityLabel(module, capability)}
            </h4>
            <p className="text-[10px] font-bold text-[var(--text-tertiary)]">
              {module}.{capability} — {feature}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase ${
                allowed ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
              }`}
            >
              {allowed ? t("engineering.permissions.whyAllowed") : t("engineering.permissions.whyDenied")}
            </span>
            <button onClick={onClose} className="p-2 hover:bg-tertiary rounded-lg transition-all">
              <X className="w-4 h-4 text-[var(--text-secondary)]" />
            </button>
          </div>
        </div>

        <div className="divide-y divide-[var(--border-primary)]">
          {/* Identity */}
          <div className="py-2">
            {row(t("engineering.permissions.whyIdentity"), user.role || "—")}
            {(userPerms.groups || []).map((group) => row(t("engineering.permissions.whyMembership"), group))}
          </div>

          {/* Eligibility */}
          <div className="py-2">
            {row(
              t("engineering.permissions.whyEligibility"),
              eligibility.eligible
                ? t("engineering.permissions.whyEligibleFor", { identity: user.role || "—", feature })
                : t("engineering.permissions.whyNotEligible"),
              eligibility.eligible ? "text-emerald-400" : "text-red-400",
            )}
            {(eligibility.sources || []).length > 0 && (
              <p className="text-[10px] font-bold text-[var(--text-tertiary)] text-right">
                {eligibility.sources
                  .map((row) => `${row.identity_type}:${row.identity_value}${Number(row.eligible) === 0 ? " (deny)" : ""}`)
                  .join(", ")}
              </p>
            )}
          </div>

          {/* Membership contribution */}
          <div className="py-2">
            {activeMembers.length === 0 && inactiveMembers.length === 0 ? (
              row(t("engineering.permissions.whyMembership"), "—")
            ) : (
              <>
                {activeMembers.map((membership) => (
                  <div key={`${membership.user_cid}|${membership.group_name}`} className="text-right mb-1">
                    <span className="text-[10px] font-bold text-[var(--text-primary)]">
                      {membership.group_name}{" "}
                      <span className="text-emerald-400">
                        {t("engineering.permissions.whyMembershipActive")}
                      </span>
                    </span>
                    <p className="text-[10px] font-bold text-[var(--text-tertiary)]">
                      {t("engineering.permissions.whyExpires")}: {membership.expires_at ? fmtDate(membership.expires_at) : t("membership.status.never")}
                    </p>
                  </div>
                ))}
                {inactiveMembers.map((membership) => (
                  <div key={`${membership.user_cid}|${membership.group_name}`} className="text-right mb-1">
                    <span className="text-[10px] font-bold text-[var(--text-primary)]">
                      {membership.group_name}{" "}
                      <span className="text-red-400">
                        {t("engineering.permissions.whyMembershipExpired")}
                      </span>
                    </span>
                    <p className="text-[10px] font-bold text-[var(--text-tertiary)]">
                      {t("engineering.permissions.whyMembershipNotContributing")}
                    </p>
                  </div>
                ))}
                {inactiveMembers.length > 0 && (
                  <p className="text-[10px] font-bold text-right mt-1" style={{ color: "var(--text-tertiary)" }}>
                    {t("engineering.permissions.whyAccountIntact")}
                  </p>
                )}
              </>
            )}
          </div>

          {/* Default Access */}
          <div className="py-2">
            {row(
              t("engineering.permissions.whyDefaultAccess"),
              profile?.profileName
                ? `${profile.profileName} (${profile.source === "user" ? t("engineering.permissions.whySourceIndividual") : t("engineering.permissions.whySourceRole")})`
                : "—",
            )}
            {row(
              t("engineering.permissions.whyProfileCapability"),
              baseLevel > 0 ? levelLabel(baseLevel) : t("engineering.permissions.whyNone"),
            )}
          </div>

          {/* Group capabilities */}
          <div className="py-2">
            {row(
              t("engineering.permissions.whyGroupCapabilities"),
              groupLevel > 0 ? levelLabel(groupLevel) : t("engineering.permissions.whyNone"),
            )}
          </div>

          {/* Individual grant */}
          <div className="py-2">
            {row(
              t("engineering.permissions.whyIndividualGrant"),
              grant ? `${levelLabel(Number(grant.access_level))}` : t("engineering.permissions.whyNone"),
            )}
          </div>

          {/* Restriction — strongest block */}
          <div className="py-2">
            {row(
              t("engineering.permissions.whyRestriction"),
              restriction ? t("engineering.permissions.whyRestricted") : t("engineering.permissions.whyNone"),
              restriction ? "text-red-400" : undefined,
            )}
            {restriction && (
              <p className="text-[10px] font-bold text-right text-red-400">
                {t("engineering.permissions.whyRestrictionPrecedence")}
              </p>
            )}
          </div>

          {/* Context / Assignment — deferred layer */}
          <div className="py-2">
            {row(t("engineering.permissions.whyContext"), t("engineering.permissions.whyContextPlaceholder"))}
          </div>

          {/* Final result */}
          <div className="py-2.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">
                {t("engineering.permissions.whyFinal")}
              </span>
              <span
                className={`text-[11px] font-black uppercase ${
                  allowed ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {allowed
                  ? `${t("engineering.permissions.whyAllowed")} (${levelLabel(effective)})`
                  : t("engineering.permissions.whyDenied")}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

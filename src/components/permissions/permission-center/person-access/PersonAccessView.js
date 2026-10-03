"use client";

import AdvancedCapabilities from "@/components/permissions/AdvancedCapabilities";
import RiskConfirmDialog from "@/components/permissions/RiskConfirmDialog";
import { ACCESS_LEVEL_KEYS, ACCESS_SHORT, LEVELS_ORDER, LEVEL_CHIP_ACTIVE, LEVEL_CHIP_BASE, LEVEL_CHIP_IDLE, LEVEL_CHIP_INHERITED } from "@/components/permissions/levelChips";
import { crudCapabilities } from "@/components/permissions/matrixHelpers";
import AccessExplanationPanel from "@/components/permissions/permission-center/AccessExplanationPanel";
import CapabilityWhyModal from "@/components/permissions/permission-center/CapabilityWhyModal";
import { Skeleton } from "@/components/ui/Skeleton";
import { capabilityLabel } from "@/models/authorization/capability-catalog";
import { Ban, ChevronDown, ChevronRight, Info, RefreshCw, RotateCcw, Shield, Trash2 } from "lucide-react";

/**
 * The individual-access editor's markup. It reads everything through `ctx`
 * (state, derived values and handlers built by PersonAccessScreen); this file
 * owns no state and runs no reads.
 */
export default function PersonAccessView({ ctx }) {
  const {
    actionError,
    actionMsg,
    applyQuickAction,
    assignBusy,
    assignErr,
    assignMsg,
    assignProfileId,
    assignProfiles,
    availableModules,
    exceptionSpecialCaps,
    expandedModules,
    featureLabel,
    fetchModules,
    getEffectiveLevel,
    getOrigin,
    handleQuickAction,
    ineligibleSectionCount,
    lang,
    loadAssignProfiles,
    loadError,
    loadingPerms,
    moduleSections,
    moduleToFeature,
    modulesError,
    originText,
    originsOf,
    personFeatures,
    riskGate,
    saveProfileOverride,
    selectUser,
    selectedUser,
    setActionError,
    setActionMsg,
    setAssignProfileId,
    setExpandedModules,
    setRiskGate,
    setShowAssignForm,
    setWhyTarget,
    showAssignForm,
    t,
    userPerms,
    whyTarget,
  } = ctx;

// Promote / remove Super Admin — one implementation, rendered either inside
  // the full identity bar (standalone screen) or in the compact header of the
  // merged Individual Access screen.
  const superAdminAction = selectedUser && userPerms && (
    userPerms.user.role !== "super_admin" ? (
      <button
        onClick={async () => {
          setActionMsg("");
          setActionError("");
          try {
            const res = await fetch("/api/engineering/permissions", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "promote_super_admin",
                user_cid: selectedUser.cid,
              }),
            });
            const data = await res.json();
            if (data.success) {
              setActionMsg(t("engineering.permissions.promotedToSuperAdmin"));
              selectUser(selectedUser);
            } else
              setActionError(
                t((data.error || t("engineering.permissions.failed")) || "") ||
                  (data.error || t("engineering.permissions.failed")),
              );
          } catch {
            setActionError(t("engineering.permissions.networkError"));
          }
        }}
        className="px-3 py-2 rounded-xl bg-purple-500/10 text-purple-400 text-[10px] font-bold uppercase tracking-widest hover:bg-purple-500/20 transition-all"
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
            const res = await fetch("/api/engineering/permissions", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "remove_super_admin",
                user_cid: selectedUser.cid,
              }),
            });
            const data = await res.json();
            if (data.success) {
              setActionMsg(t("engineering.permissions.superAdminRemoved"));
              selectUser(selectedUser);
            } else
              setActionError(
                t((data.error || t("engineering.permissions.failed")) || "") ||
                  (data.error || t("engineering.permissions.failed")),
              );
          } catch {
            setActionError(t("engineering.permissions.networkError"));
          }
        }}
        className="px-3 py-2 rounded-xl bg-red-500/10 text-red-400 text-[10px] font-bold uppercase tracking-widest hover:bg-red-500/20 transition-all"
      >
        <Shield className="w-3 h-3 inline mr-1" />
        {t("engineering.permissions.removeSuperAdmin")}
      </button>
    )
  );

return (
    <>
      <div className="space-y-8 pb-20">
        <div className="space-y-6">
            {/* Loading, and failing to load, keep this panel in place and say
                what is happening. The area used to render nothing until the
                person's access arrived — and nothing at all when the request
                was refused, which reads exactly like a section removed from
                the screen. */}
            {selectedUser && !userPerms && (
              <div className="space-y-6">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--brand-orange)]">
                  {t("engineering.permissions.accessEditorTitle")}
                </h3>
                {loadingPerms ? (
                  <div
                    role="status"
                    aria-label={t("common.loading")}
                    className="space-y-3"
                  >
                    <Skeleton className="h-10" />
                    <Skeleton className="h-40" />
                  </div>
                ) : (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-red-400">
                      {t("engineering.permissions.personAccessLoadFailed")}
                    </p>
                    <p className="text-[10px] font-bold text-[var(--text-secondary)] break-words">
                      {loadError ||
                        t("engineering.permissions.personAccessUnavailable")}
                    </p>
                    <button
                      type="button"
                      onClick={() => selectUser(selectedUser)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-primary)] text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60"
                    >
                      <RefreshCw className="w-3 h-3" />
                      {t("common.refresh")}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* User Permission Panel */}
            {selectedUser && userPerms && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--brand-orange)]">
                    {t("engineering.permissions.accessEditorTitle")}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2">
                    {superAdminAction}
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

                {/* Profile override — an Individual Access exception (Super
                    Admin uses the bypass, so an override is not applicable) */}
                {userPerms.user.role !== "super_admin" && (
                  <div className="ios-card !p-5 border-[var(--border-primary)] space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-wider">
                        {t("engineering.permissions.assignProfileTitle")}
                      </h4>
                      {userPerms.effectiveProfile?.source === "user" && (
                        <button
                          onClick={() => saveProfileOverride("")}
                          disabled={assignBusy}
                          className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-[10px] font-bold uppercase tracking-widest hover:bg-red-500/20 transition-all disabled:opacity-50"
                        >
                          {t("engineering.permissions.removeOverride")}
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] font-bold text-[var(--text-secondary)]">
                      {userPerms.effectiveProfile?.source === "user"
                        ? t("engineering.permissions.currentOverride", {
                            name:
                              userPerms.effectiveProfile.profileName || "—",
                          })
                        : t("engineering.permissions.noOverride", {
                            name:
                              userPerms.effectiveProfile?.profileName ||
                              t("engineering.permissions.legacyRoleCapabilities"),
                          })}
                    </p>
                    {assignMsg && (
                      <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                        <p className="text-[10px] font-bold text-emerald-400">
                          {assignMsg}
                        </p>
                      </div>
                    )}
                    {assignErr && (
                      <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                        <p className="text-[10px] font-bold text-red-400">
                          {assignErr}
                        </p>
                      </div>
                    )}
                    {showAssignForm ? (
                      <div className="space-y-3">
                        <select
                          value={assignProfileId}
                          onChange={(event) => setAssignProfileId(event.target.value)}
                          className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-brand-orange/50 transition-all"
                        >
                          <option value="">
                            {t("engineering.permissions.selectProfile")}
                          </option>
                          {assignProfiles
                            .filter((profile) => profile.is_active)
                            .map((profile) => (
                              <option key={profile.id} value={profile.id}>
                                {profile.name}
                              </option>
                            ))}
                        </select>
                        <div className="flex gap-2">
                          <button
                            onClick={() => saveProfileOverride(assignProfileId)}
                            disabled={!assignProfileId || assignBusy}
                            className="px-4 py-2 rounded-xl bg-[var(--brand-orange)] text-black text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50"
                          >
                            {t("engineering.permissions.assign")}
                          </button>
                          <button
                            onClick={() => {
                              setShowAssignForm(false);
                              setAssignProfileId("");
                            }}
                            className="px-4 py-2 rounded-xl bg-secondary border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-widest hover:bg-tertiary transition-all"
                          >
                            {t("engineering.permissions.cancel")}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setShowAssignForm(true);
                          setAssignProfileId("");
                          loadAssignProfiles();
                        }}
                        className="px-4 py-2 rounded-xl bg-secondary border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-widest hover:bg-tertiary transition-all"
                      >
                        {t("engineering.permissions.assignProfile")}
                      </button>
                    )}
                  </div>
                )}

                {/* Legend */}
                <div className="flex items-center gap-4 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
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

                <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                  {t("engineering.permissions.personRightsHint")}
                </p>

                {ineligibleSectionCount > 0 && (
                  <p className="text-[10px] font-medium text-[var(--text-secondary)] opacity-80">
                    {t("engineering.permissions.personIneligibleSectionsNote")}
                  </p>
                )}

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
                    {modulesError && (
                      <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 space-y-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-red-400">
                          {t("engineering.permissions.catalogLoadFailed")}
                        </p>
                        <p className="text-[10px] font-bold text-[var(--text-secondary)] break-words">
                          {modulesError}
                        </p>
                        <button
                          type="button"
                          onClick={() => fetchModules()}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-primary)] text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60"
                        >
                          <RefreshCw className="w-3 h-3" />
                          {t("common.refresh")}
                        </button>
                      </div>
                    )}
                    {!modulesError && moduleSections.length === 0 && (
                      <p className="text-xs font-bold text-[var(--text-secondary)]">
                        {t("engineering.permissions.personNoSections")}
                      </p>
                    )}
                    {moduleSections.map((section) => (
                      <div key={section.feature} className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2 pl-1">
                          <h3 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest opacity-50">
                            {featureLabel(section.feature)}
                          </h3>
                          {!section.eligible && (
                            <span className="px-1.5 py-0.5 rounded border border-amber-400/40 bg-amber-400/10 text-[9px] font-black uppercase tracking-widest text-amber-400">
                              {t("engineering.permissions.personSectionNotEligible")}
                            </span>
                          )}
                        </div>
                        {section.modules.map((modKey) => {
                          const mod = availableModules[modKey];
                          if (!mod) return null;
                          // The CRUD grid edits CRUD only; the module's other
                          // capabilities live in the Advanced section below.
                          const caps = crudCapabilities(mod.capabilities || []);
                          if (caps.length === 0) return null;
                          const isExpanded = expandedModules[modKey] !== false;
                          // Eligibility ceiling on the WRITE control only: the
                          // server refuses a grant on an ineligible feature. The
                          // section still shows what the person holds, and a
                          // block can still be undone.
                          const lockLevels = !section.eligible;

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
                                <span className="text-[10px] font-medium text-[var(--text-secondary)]">
                                  {t("engineering.permissions.capabilitiesCount", { count: caps.length })}
                                </span>
                              </button>

                              {isExpanded && (
                                <div className="overflow-x-auto">
                                  <table className="w-full border-collapse">
                                    <thead>
                                      <tr className="border-b border-[var(--border-primary)]">
                                        <th className="text-left px-5 py-3 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                                          {t("engineering.permissions.capability")}
                                        </th>
                                        <th className="px-5 py-3 text-right text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
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
                                            className="group border-b border-divider/50 last:border-b-0 hover:bg-tertiary/20 transition-all"
                                          >
                                            {/* Capability name */}
                                            <td className="px-5 py-3">
                                              <div className="flex flex-wrap items-center gap-2">
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
                                                <span className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide">
                                                  {capabilityLabel(modKey, cap)}
                                                </span>
                                                {origin === "granted" && (
                                                  <span className="shrink-0 px-1.5 py-0.5 rounded border border-emerald-400/30 bg-emerald-400/10 text-[9px] font-black uppercase tracking-widest text-emerald-400">
                                                    {t("engineering.permissions.legendIndividualGrant")}
                                                  </span>
                                                )}
                                                {origin === "restricted" && (
                                                  <span className="shrink-0 px-1.5 py-0.5 rounded border border-red-500/40 bg-red-500/10 text-[9px] font-black uppercase tracking-widest text-red-400">
                                                    {t("engineering.permissions.restricted")}
                                                  </span>
                                                )}
                                              </div>
                                              {/* The state the chips act on: what the
                                                  person has TODAY and where it comes
                                                  from, so a chip is never clicked blind
                                                  (a direct grant of a level the person
                                                  already inherits changes nothing). */}
                                              <p className="mt-1 text-[9px] font-bold text-[var(--text-secondary)] opacity-80">
                                                {t("engineering.permissions.advancedCurrentState")}:{" "}
                                                {originText(modKey, cap)}
                                              </p>
                                            </td>

                                            {/* Controls — the level chips use the same
                                                visual language as the template matrix:
                                                pick a level to grant it personally, block
                                                a right the person would otherwise inherit,
                                                or restore it. */}
                                            <td className="px-5 py-3">
                                              {origin === "restricted" ? (
                                                <div className="flex flex-wrap items-center justify-end gap-2">
                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      handleQuickAction(
                                                        "unrestrict",
                                                        modKey,
                                                        cap,
                                                      )
                                                    }
                                                    title={t("engineering.permissions.titleRemoveRestriction")}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-[9px] font-black uppercase tracking-widest text-emerald-400 hover:bg-emerald-500/20 transition-all"
                                                  >
                                                    <RotateCcw className="w-3 h-3" />
                                                    {t("engineering.permissions.restore")}
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      setWhyTarget({ module: modKey, capability: cap })
                                                    }
                                                    className="p-1.5 rounded-lg hover:bg-blue-500/10 transition-all"
                                                    title={t("engineering.permissions.whyAccess")}
                                                  >
                                                    <Info className="w-3 h-3 text-blue-400" />
                                                  </button>
                                                </div>
                                              ) : (
                                                <div className="flex flex-wrap items-center justify-end gap-1.5">
                                                  {LEVELS_ORDER.filter(
                                                    (level) => level > 0,
                                                  ).map((level) => {
                                                    const isActive =
                                                      effectiveLevel === level;
                                                    return (
                                                      <button
                                                        key={level}
                                                        type="button"
                                                        disabled={isActive || lockLevels}
                                                        aria-pressed={isActive}
                                                        onClick={() =>
                                                          handleQuickAction(
                                                            "grant",
                                                            modKey,
                                                            cap,
                                                            level,
                                                          )
                                                        }
                                                        title={t(
                                                          "engineering.permissions.titleSetTo",
                                                          {
                                                            level: t(
                                                              ACCESS_LEVEL_KEYS[level],
                                                            ),
                                                          },
                                                        )}
                                                        className={`${LEVEL_CHIP_BASE} ${
                                                          isActive
                                                            ? origin === "granted"
                                                              ? LEVEL_CHIP_ACTIVE[level]
                                                              : LEVEL_CHIP_INHERITED
                                                            : LEVEL_CHIP_IDLE
                                                        }`}
                                                      >
                                                        {ACCESS_SHORT[level]}
                                                      </button>
                                                    );
                                                  })}

                                                  {effectiveLevel > 0 && (
                                                    <button
                                                      type="button"
                                                      onClick={() =>
                                                        handleQuickAction(
                                                          "restrict",
                                                          modKey,
                                                          cap,
                                                          0,
                                                        )
                                                      }
                                                      title={t("engineering.permissions.titleRestrict")}
                                                      className="ml-1 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-dashed border-[var(--border-primary)] text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] hover:border-red-400/50 hover:text-red-400 transition-all"
                                                    >
                                                      <Ban className="w-3 h-3" />
                                                      {t("engineering.permissions.block")}
                                                    </button>
                                                  )}

                                                  {origin === "granted" && (
                                                    <button
                                                      type="button"
                                                      onClick={() =>
                                                        handleQuickAction(
                                                          "revoke",
                                                          modKey,
                                                          cap,
                                                        )
                                                      }
                                                      title={t("engineering.permissions.titleRevokeGrant")}
                                                      className="p-1.5 rounded-lg hover:bg-red-500/10 transition-all"
                                                    >
                                                      <Trash2 className="w-3 h-3 text-red-400" />
                                                    </button>
                                                  )}

                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      setWhyTarget({ module: modKey, capability: cap })
                                                    }
                                                    className="p-1.5 rounded-lg hover:bg-blue-500/10 transition-all"
                                                    title={t("engineering.permissions.whyAccess")}
                                                  >
                                                    <Info className="w-3 h-3 text-blue-400" />
                                                  </button>
                                                </div>
                                              )}
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

                    {/* Non-CRUD capabilities (grant, promote_super_admin, send,
                        publish, execute…) — individual grants/blocks. Hidden when
                        the catalogue failed: these controls are built from it, and
                        an empty list would claim there is nothing to grant. */}
                    {!modulesError && (
                      <AdvancedCapabilities
                        availableModules={availableModules}
                        moduleToFeature={moduleToFeature}
                        visibleFeatures={personFeatures}
                        retainedCaps={exceptionSpecialCaps}
                        mode="individual"
                        stateOf={(module, capability) => ({
                          level: getEffectiveLevel(module, capability),
                          origin: getOrigin(module, capability),
                          origins: originsOf(module, capability),
                        })}
                        onAction={handleQuickAction}
                        onWhy={(module, capability) =>
                          setWhyTarget({ module, capability })
                        }
                      />
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

        {whyTarget && (
          <CapabilityWhyModal
            userPerms={userPerms}
            module={whyTarget.module}
            capability={whyTarget.capability}
            t={t}
            lang={lang}
            onClose={() => setWhyTarget(null)}
          />
        )}

        {/* Critical/high-risk confirmation: the write is applied on confirm. */}
        <RiskConfirmDialog
          open={Boolean(riskGate)}
          changes={riskGate?.risky || []}
          subject={selectedUser?.name || selectedUser?.cid || ""}
          onCancel={() => setRiskGate(null)}
          onConfirm={() => {
            const gate = riskGate;
            setRiskGate(null);
            if (gate) {
              applyQuickAction(
                gate.action,
                gate.module,
                gate.capability,
                gate.level,
              );
            }
          }}
        />
      </div>
    </>
  );
}

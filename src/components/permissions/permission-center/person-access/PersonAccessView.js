"use client";

import AdvancedCapabilities from "@/components/permissions/AdvancedCapabilities";
import RiskConfirmDialog from "@/components/permissions/RiskConfirmDialog";
import AccessExplanationPanel from "@/components/permissions/permission-center/AccessExplanationPanel";
import CapabilityWhyModal from "@/components/permissions/permission-center/CapabilityWhyModal";
import PersonFeatureSection from "@/components/permissions/permission-center/person-access/PersonFeatureSection";
import { Skeleton } from "@/components/ui/Skeleton";
import { RefreshCw, Shield } from "lucide-react";

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
                      <PersonFeatureSection
                        key={section.feature}
                        section={section}
                        featureLabel={featureLabel}
                        t={t}
                        availableModules={availableModules}
                        expandedModules={expandedModules}
                        setExpandedModules={setExpandedModules}
                        getEffectiveLevel={getEffectiveLevel}
                        getOrigin={getOrigin}
                        originText={originText}
                        handleQuickAction={handleQuickAction}
                        setWhyTarget={setWhyTarget}
                      />
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

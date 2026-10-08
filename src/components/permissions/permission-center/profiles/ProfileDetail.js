/**
 * The selected profile: its identity, its roles, the review bar and the matrix.
 *
 * Cut out of src/components/permissions/permission-center/AccessProfilesView.js
 * as-is: the panel keeps every state value and every write, and hands this block
 * what it reads through `ctx`. The names it needs are listed in the signature —
 * nothing else.
 */

"use client";
import AdvancedCapabilities from "@/components/permissions/AdvancedCapabilities";
import FeatureMatrixSection from "@/components/permissions/FeatureMatrixSection";
import { buildSubsectionRows } from "@/components/permissions/matrixHelpers";
import { diffCapabilities } from "@/components/permissions/pendingChanges";
import { deriveProfileBadges } from "@/components/permissions/profileBadges";
import Badge from "@/components/permissions/ui/Badge";
import PendingChangesList from "@/components/permissions/ui/PendingChangesList";
import {
  Copy,
  Eye,
  EyeOff,
  Layers,
  Loader2,
  Pencil,
  Trash2,
} from "lucide-react";

export default function ProfileDetail({ ctx }) {
  const {
    availableModules,
    changesCount,
    clearHiddenCaps,
    deleteBusy,
    deleteProfile,
    discardChanges,
    draftCaps,
    duplicateProfile,
    hiddenStoredCaps,
    impactContextBindings,
    impactTotal,
    moduleCatalog,
    moduleToFeature,
    reason,
    renameMode,
    renameProfile,
    renameValue,
    saveChanges,
    savedCaps,
    saving,
    selectedIsDefaultFor,
    selectedProfile,
    setDefaultRoleErr,
    setDefaultRoleMsg,
    setReason,
    setRemoveErr,
    setRemoveMsg,
    setRenameMode,
    setRenameValue,
    setRolesModalOpen,
    t,
    toggleDraftCap,
    toggleDraftFull,
    toggleProfileActive,
    visibleFeatures,
    visibleSections,
  } = ctx;

  return (
    <>
      {selectedProfile ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {renameMode ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        value={renameValue}
                        onChange={(event) => setRenameValue(event.target.value)}
                        placeholder={t("engineering.permissions.renamePlaceholder")}
                        className="w-56 bg-secondary border border-[var(--border-primary)] rounded-lg px-3 py-1.5 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-brand-orange/50"
                      />
                      <button
                        onClick={renameProfile}
                        disabled={!renameValue.trim()}
                        className="px-3 py-1.5 rounded-lg bg-[var(--brand-orange)] text-black text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-40"
                      >
                        {t("common.save")}
                      </button>
                      <button
                        onClick={() => {
                          setRenameMode(false);
                          setRenameValue("");
                        }}
                        className="px-3 py-1.5 rounded-lg bg-secondary border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-widest hover:bg-tertiary transition-all"
                      >
                        {t("engineering.permissions.cancel")}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="text-sm font-black text-[var(--text-primary)] uppercase">
                        {selectedProfile.name}
                      </h3>
                      <button
                        onClick={() => {
                          setRenameMode(true);
                          setRenameValue(selectedProfile.name);
                        }}
                        className="p-1.5 rounded-lg hover:bg-tertiary transition-all text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        title={t("engineering.permissions.renameProfile")}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  {selectedProfile.description && (
                    <p className="text-[10px] font-bold text-[var(--text-secondary)] mt-0.5">
                      {selectedProfile.description}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <span className="text-[10px] font-bold text-[var(--text-secondary)]">
                      {t("engineering.permissions.capabilitiesCount", {
                        count: selectedProfile.capability_count || 0,
                      })}
                    </span>
                    {deriveProfileBadges(selectedProfile, selectedIsDefaultFor).map((badge) => (
                      <span
                        key={badge}
                        title={
                          badge === "roleDefault"
                            ? selectedIsDefaultFor.join(", ")
                            : undefined
                        }
                      >
                        <Badge variant={badge === "roleDefault" ? "verified" : "locked"}>
                          {t(`engineering.permissions.profileBadge_${badge}`)}
                        </Badge>
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span
                    className={`text-[10px] font-bold px-2 py-1 rounded ${
                      selectedProfile.is_active
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-red-500/10 text-red-400"
                    }`}
                  >
                    {selectedProfile.is_active
                      ? t("engineering.permissions.active")
                      : t("engineering.permissions.disabled")}
                  </span>
                  <button
                    onClick={() => duplicateProfile(selectedProfile)}
                    title={t("engineering.permissions.duplicateProfileTitle")}
                    className="p-1.5 rounded-lg hover:bg-tertiary transition-all text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => toggleProfileActive(selectedProfile)}
                    title={
                      selectedProfile.is_active
                        ? t("engineering.permissions.disableProfile")
                        : t("engineering.permissions.enableProfile")
                    }
                    className="p-1.5 rounded-lg hover:bg-tertiary transition-all text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    {selectedProfile.is_active ? (
                      <Eye className="w-3.5 h-3.5" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    onClick={() => deleteProfile(selectedProfile)}
                    disabled={deleteBusy}
                    title={t("engineering.permissions.deleteProfileTitle")}
                    className="p-1.5 rounded-lg hover:bg-tertiary transition-all text-[var(--text-secondary)] hover:text-red-400 disabled:opacity-40"
                  >
                    {deleteBusy ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Rôles attribués — lecture seule, édition via la modale "Modifier" */}
              <div className="ios-card !p-5 border-[var(--border-primary)] space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-primary)]">
                      {t("engineering.permissions.rolesAssignedTitle")}
                    </p>
                    <p className="text-[10px] font-bold text-[var(--text-secondary)] mt-0.5">
                      {t("engineering.permissions.rolesAssignedHint")}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setDefaultRoleMsg("");
                      setDefaultRoleErr("");
                      setRemoveMsg("");
                      setRemoveErr("");
                      setRolesModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-secondary border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-widest hover:bg-tertiary transition-all shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60"
                  >
                    <Pencil className="w-3 h-3" />{" "}
                    {t("engineering.permissions.editRoles")}
                  </button>
                </div>
                {selectedIsDefaultFor.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedIsDefaultFor.map((role) => (
                      <span
                        key={role}
                        className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded bg-brand-orange/10 text-[var(--brand-orange)]"
                      >
                        {role.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] font-bold text-[var(--text-secondary)]">
                    {t("engineering.permissions.defaultForNone")}
                  </p>
                )}
                {selectedIsDefaultFor.length > 0 && (
                  <>
                    <p className="text-[10px] font-bold text-amber-400">
                      {t("engineering.permissions.profileInUseWarning", {
                        roles: selectedIsDefaultFor.join(", "),
                      })}
                    </p>
                    <p className="text-[10px] font-bold text-amber-400/70">
                      {t("engineering.permissions.profileChangeAffectsUsers")}
                    </p>
                  </>
                )}
              </div>

              <div className="rounded-xl border border-[var(--border-primary)] bg-surface-1 p-3 space-y-2 shadow-lg">
                {impactTotal !== null && (
                  <p
                    className={`text-[10px] font-black uppercase tracking-widest ${
                      impactTotal > 0
                        ? "text-[var(--brand-orange)]"
                        : "text-[var(--text-secondary)]"
                    }`}
                  >
                    {t("engineering.permissions.impactAffects", { total: impactTotal })}
                  </p>
                )}
                {impactContextBindings !== null && impactContextBindings > 0 && (
                  <p className="text-[10px] font-bold text-[var(--text-secondary)]">
                    {t("engineering.permissions.impactContextBindings", {
                      count: impactContextBindings,
                    })}
                  </p>
                )}
                {changesCount > 0 && (
                  <PendingChangesList
                    items={diffCapabilities(savedCaps, draftCaps).map((change) => ({
                      label: change.label,
                      level: change.to,
                    }))}
                  />
                )}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-[10px] font-bold text-[var(--text-secondary)]">
                    {changesCount > 0
                      ? t("engineering.permissions.changesPending", {
                          count: changesCount,
                        })
                      : t("engineering.permissions.noPendingChanges")}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={discardChanges}
                      disabled={changesCount === 0 || saving}
                      className="px-4 py-2 rounded-xl bg-secondary border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-widest hover:bg-tertiary transition-all disabled:opacity-40"
                    >
                      {t("engineering.permissions.discardChanges")}
                    </button>
                    <button
                      onClick={saveChanges}
                      disabled={changesCount === 0 || saving}
                      className="px-4 py-2 rounded-xl bg-[var(--brand-orange)] text-black text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-40"
                    >
                      {saving
                        ? t("engineering.permissions.saving")
                        : t("engineering.permissions.saveChanges")}
                    </button>
                  </div>
                </div>
                <input
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder={t("engineering.permissions.reasonPlaceholder")}
                  className="w-full rounded-lg border border-[var(--border-primary)] bg-secondary px-3 py-2 text-xs font-bold text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] placeholder:opacity-60 focus:outline-none focus:border-[var(--brand-orange)]"
                />
              </div>

              {selectedIsDefaultFor.length > 0 ? (
                <div className="p-3 rounded-xl bg-brand-orange/5 border border-brand-orange/20">
                  <p className="text-[10px] font-bold text-[var(--text-secondary)]">
                    {t("engineering.permissions.profileEligibilityFilterHint", {
                      roles: selectedIsDefaultFor.join(", "),
                    })}
                  </p>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-secondary/50 border border-[var(--border-primary)]">
                  <p className="text-[10px] font-bold text-[var(--text-secondary)]">
                    {t("engineering.permissions.profileStandaloneHint")}
                  </p>
                </div>
              )}

              {!moduleCatalog && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
                  <p className="text-[10px] font-bold text-amber-400">
                    {t("engineering.permissions.catalogUnavailable")}
                  </p>
                </div>
              )}

              {moduleCatalog && visibleSections.length === 0 && (
                <div className="py-10 text-center opacity-60">
                  <p className="text-xs font-black text-[var(--text-primary)] uppercase">
                    {t(
                      selectedIsDefaultFor.length === 0
                        ? "engineering.permissions.profileNoConfigurableFeatures"
                        : "engineering.permissions.profileNoEligibleFeatures",
                    )}
                  </p>
                </div>
              )}

              {moduleCatalog && visibleSections.length > 0 && (
                <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                  {t("engineering.permissions.viewBaseHint")}
                </p>
              )}

              <div className="space-y-6">
                {visibleSections.map((section) => (
                  <FeatureMatrixSection
                    key={section.feature}
                    section={section}
                    rows={buildSubsectionRows(section.feature, availableModules, moduleToFeature)}
                    availableModules={availableModules}
                    draftCaps={draftCaps}
                    savedCaps={savedCaps}
                    onToggle={toggleDraftCap}
                    onToggleFull={toggleDraftFull}
                  />
                ))}
              </div>

              {/* Non-CRUD capabilities (grant, promote_super_admin, send,
                  publish, execute…) — editable on the same draft + save flow. */}
              <AdvancedCapabilities
                availableModules={availableModules}
                moduleToFeature={moduleToFeature}
                visibleFeatures={visibleFeatures}
                mode="profile"
                stateOf={(module, capability) => ({
                  level: draftCaps?.[module]?.[capability] ?? 0,
                })}
                onToggle={toggleDraftCap}
              />

              {/* C1 — capabilities still STORED but not shown in the matrix
                  above (their feature is no longer eligible for the template's
                  roles, or the module has no dashboard section). They are still
                  granted to everyone who inherits the profile, so the screen
                  never hides them: it lists them and lets the admin remove
                  them, which is what unblocks the save. */}
              {hiddenStoredCaps.length > 0 && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 space-y-3">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                      {t("engineering.permissions.hiddenStoredTitle")}
                    </p>
                    <p className="text-[10px] font-bold text-[var(--text-secondary)]">
                      {t("engineering.permissions.hiddenStoredHint")}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    {hiddenStoredCaps.map((entry) => (
                      <div
                        key={entry.module}
                        className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2"
                        style={{ borderColor: "var(--border-primary)" }}
                      >
                        <span className="min-w-0 text-[10px] text-[var(--text-primary)]">
                          <span className="font-black uppercase tracking-wide">
                            {entry.module.replace(/_/g, " ")}
                          </span>
                          <span className="ml-2 font-medium text-[var(--text-secondary)] opacity-70">
                            {entry.capabilities.join(", ")}
                          </span>
                        </span>
                        <button
                          onClick={() => clearHiddenCaps(entry)}
                          className="shrink-0 px-2 py-1 rounded-lg bg-red-500/10 text-[10px] font-bold text-red-400 uppercase tracking-widest hover:bg-red-500/20 transition-all"
                        >
                          {t("engineering.permissions.hiddenStoredRemove")}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="ios-card !p-10 border border-[var(--border-primary)] flex flex-col items-center justify-center text-center opacity-60 space-y-2">
              <Layers className="w-10 h-10 text-slate-500" />
              <p className="text-xs font-black text-[var(--text-primary)] uppercase">
                {t("engineering.permissions.selectProfilePromptTitle")}
              </p>
              <p className="text-[10px] font-bold text-[var(--text-secondary)]">
                {t("engineering.permissions.selectProfilePrompt")}
              </p>
            </div>
      )}
    </>
  );
}

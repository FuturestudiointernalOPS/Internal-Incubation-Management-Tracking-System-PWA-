"use client";

import { useEffect, useState } from "react";
import AdvancedCapabilities from "@/components/permissions/AdvancedCapabilities";
import RiskConfirmDialog from "@/components/permissions/RiskConfirmDialog";
import AccessExplanationPanel from "@/components/permissions/permission-center/AccessExplanationPanel";
import CapabilityWhyModal from "@/components/permissions/permission-center/CapabilityWhyModal";
import PersonFeatureSection from "@/components/permissions/permission-center/person-access/PersonFeatureSection";
import AppModal from "@/components/ui/AppModal";
import { Skeleton } from "@/components/ui/Skeleton";
import { useDialogs } from "@/components/ui/DialogProvider";
import { defer } from "@/components/permissions/effectUtils";
import {
  AlertTriangle,
  CheckCircle2,
  MoreHorizontal,
  RefreshCw,
  Shield,
  ShieldOff,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Petits blocs locaux (aucune logique métier, uniquement du rendu)    */
/* ------------------------------------------------------------------ */

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60";

const BTN_BASE = `inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-[11px] font-bold uppercase tracking-wider transition-all disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`;

const BTN = {
  primary: `${BTN_BASE} bg-[var(--brand-orange)] text-black hover:opacity-90`,
  secondary: `${BTN_BASE} border border-[var(--border-primary)] bg-secondary text-[var(--text-primary)] hover:bg-tertiary`,
  danger: `${BTN_BASE} bg-red-500/10 text-red-400 hover:bg-red-500/20`,
  purple: `${BTN_BASE} bg-purple-500/10 text-purple-400 hover:bg-purple-500/20`,
};

const NOTICE_TONES = {
  success: {
    box: "border-emerald-500/20 bg-emerald-500/10",
    text: "text-emerald-400",
    Icon: CheckCircle2,
  },
  error: {
    box: "border-red-500/30 bg-red-500/5",
    text: "text-red-400",
    Icon: AlertTriangle,
  },
};

/** Bandeau de retour (succès / erreur), annoncé aux lecteurs d'écran. */
function Notice({ tone, title, children, action }) {
  const { box, text, Icon } = NOTICE_TONES[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex items-start gap-3 rounded-xl border p-3.5 ${box}`}
    >
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${text}`} aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-1">
        {title && <p className={`text-xs font-bold ${text}`}>{title}</p>}
        {children && (
          <p
            className={`break-words text-xs ${
              title
                ? "font-medium text-[var(--text-secondary)]"
                : `font-semibold ${text}`
            }`}
          >
            {children}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

function RefreshButton({ onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${BTN.secondary} !px-3 !py-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)]`}
    >
      <RefreshCw className="h-3 w-3" aria-hidden="true" />
      {label}
    </button>
  );
}

function PanelTitle({ id, children, actions }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3
        id={id}
        className="scroll-mt-24 text-base font-semibold text-[var(--text-primary)]"
      >
        {children}
      </h3>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** A state key: a glyph AND a word, so the colour is never the only signal. */
function LegendChip({ symbol, tone, label }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-primary)] bg-secondary/40 px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]">
      <span className={`font-black ${tone}`} aria-hidden="true">
        {symbol}
      </span>
      {label}
    </span>
  );
}

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
    setWhyTarget,
    onOverrideClose,
    overrideOpen,
    t,
    userPerms,
    whyTarget,
  } = ctx;

  const { confirm } = useDialogs();
  const [menuOpen, setMenuOpen] = useState(false);

  /* -------------------------------------------------------------- */
  /* Promouvoir / retirer Super Admin — une seule implémentation     */
  /* -------------------------------------------------------------- */
  const isSuperAdmin = userPerms?.user?.role === "super_admin";
  const subject = selectedUser?.name || selectedUser?.cid || "";

  const changeSuperAdmin = async (action, successKey) => {
    setActionMsg("");
    setActionError("");
    try {
      const res = await fetch("/api/engineering/permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, user_cid: selectedUser.cid }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg(t(successKey));
        selectUser(selectedUser);
      } else {
        const raw = data.error || t("engineering.permissions.failed");
        setActionError(t(raw) || raw);
      }
    } catch {
      setActionError(t("engineering.permissions.networkError"));
    }
  };

  const requestSuperAdminChange = async () => {
    setMenuOpen(false);
    const accepted = await confirm({
      title: isSuperAdmin
        ? t("engineering.permissions.superAdminConfirmRemoveTitle", { name: subject })
        : t("engineering.permissions.superAdminConfirmTitle", { name: subject }),
      message: isSuperAdmin
        ? t("engineering.permissions.superAdminConfirmRemoveMessage")
        : t("engineering.permissions.superAdminConfirmMessage"),
      tone: "danger",
      confirmLabel: isSuperAdmin
        ? t("engineering.permissions.superAdminConfirmRemoveAction")
        : t("engineering.permissions.superAdminConfirmAction"),
      cancelLabel: t("common.cancel"),
    });
    if (!accepted) return;
    if (isSuperAdmin) {
      changeSuperAdmin(
        "remove_super_admin",
        "engineering.permissions.superAdminRemoved",
      );
    } else {
      changeSuperAdmin(
        "promote_super_admin",
        "engineering.permissions.promotedToSuperAdmin",
      );
    }
  };

  // The most sensitive action on the screen lives behind an overflow menu and a
  // confirmation that states the impact — never a primary button next to the
  // everyday controls.
  const superAdminAction =
    selectedUser && userPerms ? (
      <div className="relative">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label={t("engineering.permissions.superAdminMenu")}
          onClick={() => setMenuOpen((open) => !open)}
          className={`${BTN.secondary} !px-2.5`}
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">
            {t("engineering.permissions.superAdminMenu")}
          </span>
        </button>
        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setMenuOpen(false)}
              aria-hidden="true"
            />
            <div
              role="menu"
              aria-label={t("engineering.permissions.superAdminMenu")}
              className="absolute right-0 z-20 mt-1 w-64 rounded-xl border border-[var(--border-primary)] bg-surface-1 p-1 shadow-lg"
            >
              <button
                type="button"
                role="menuitem"
                onClick={requestSuperAdminChange}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60"
              >
                {isSuperAdmin ? (
                  <ShieldOff className="h-4 w-4 text-red-400" aria-hidden="true" />
                ) : (
                  <Shield className="h-4 w-4 text-purple-400" aria-hidden="true" />
                )}
                {isSuperAdmin
                  ? t("engineering.permissions.removeSuperAdmin")
                  : t("engineering.permissions.makeSuperAdmin")}
              </button>
            </div>
          </>
        )}
      </div>
    ) : null;

  const hasOverride = userPerms?.effectiveProfile?.source === "user";

  // Opening the override dialog loads the access-profile catalogue it offers.
  useEffect(() => {
    if (overrideOpen) defer(() => loadAssignProfiles());
  }, [overrideOpen, loadAssignProfiles]);

  return (
    <div className="space-y-6">
      {/* Chargement / échec : le panneau reste en place et explique ce qui se
          passe, pour ne jamais ressembler à une section supprimée. */}
      {selectedUser && !userPerms && (
        <section className="space-y-4">
          <PanelTitle>{t("engineering.permissions.accessEditorTitle")}</PanelTitle>
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
            <Notice
              tone="error"
              title={t("engineering.permissions.personAccessLoadFailed")}
              action={
                <RefreshButton
                  onClick={() => selectUser(selectedUser)}
                  label={t("common.refresh")}
                />
              }
            >
              {loadError || t("engineering.permissions.personAccessUnavailable")}
            </Notice>
          )}
        </section>
      )}

      {selectedUser && userPerms && (
        <section className="space-y-6">
          <PanelTitle actions={superAdminAction}>
            {t("engineering.permissions.accessEditorTitle")}
          </PanelTitle>

          {/* Retours d'action */}
          {(actionMsg || actionError) && (
            <div className="space-y-2" aria-live="polite">
              {actionMsg && <Notice tone="success">{actionMsg}</Notice>}
              {actionError && <Notice tone="error">{actionError}</Notice>}
            </div>
          )}

          {/* Remplacement du profil d'accès — un Super Admin passe par le
              bypass, donc aucune exception n'est applicable. Le bouton qui
              l'ouvre vit dans la barre « Profils » du haut ; le flux (et sa
              confirmation de perte de droits) reste ici. */}
          {!isSuperAdmin && (
            <AppModal
              isOpen={overrideOpen}
              onClose={onOverrideClose}
              title={t("engineering.permissions.assignProfileTitle")}
              size="md"
            >
              <div className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <p className="text-xs font-medium text-[var(--text-secondary)]">
                    {t("engineering.permissions.assignHint")}
                  </p>
                  {hasOverride && (
                    <button
                      type="button"
                      onClick={() => saveProfileOverride("")}
                      disabled={assignBusy}
                      className={BTN.danger}
                    >
                      {t("engineering.permissions.removeOverride")}
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2.5 rounded-xl border border-[var(--border-primary)] bg-secondary/30 px-3.5 py-2.5">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      hasOverride ? "bg-emerald-400" : "bg-slate-400"
                    }`}
                    aria-hidden="true"
                  />
                  <p className="min-w-0 break-words text-xs font-semibold text-[var(--text-primary)]">
                    {hasOverride
                      ? t("engineering.permissions.currentOverride", {
                          name: userPerms.effectiveProfile.profileName || "—",
                        })
                      : t("engineering.permissions.noOverride", {
                          name:
                            userPerms.effectiveProfile?.profileName ||
                            t("engineering.permissions.legacyRoleCapabilities"),
                        })}
                  </p>
                </div>

                {assignMsg && <Notice tone="success">{assignMsg}</Notice>}
                {assignErr && <Notice tone="error">{assignErr}</Notice>}

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <select
                    aria-label={t("engineering.permissions.selectProfile")}
                    value={assignProfileId}
                    onChange={(event) => setAssignProfileId(event.target.value)}
                    className="w-full flex-1 rounded-xl border border-[var(--border-primary)] bg-secondary px-4 py-2.5 text-xs font-bold text-[var(--text-primary)] outline-none transition-all focus:border-brand-orange/50"
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
                      type="button"
                      onClick={() => saveProfileOverride(assignProfileId)}
                      disabled={!assignProfileId || assignBusy}
                      className={BTN.primary}
                    >
                      {t("engineering.permissions.assign")}
                    </button>
                    <button
                      type="button"
                      onClick={onOverrideClose}
                      className={BTN.secondary}
                    >
                      {t("engineering.permissions.cancel")}
                    </button>
                  </div>
                </div>
              </div>
            </AppModal>
          )}

          {/* Les profils détenus (registre Phase C) s'affichent en haut de
              l'écran personne (IndividualAccessScreen) : pas de doublon ici. */}

          {/* Légende : chaque état porte un glyphe ET un mot. */}
          {(loadingPerms || modulesError || moduleSections.length > 0) && (
          <div className="space-y-3 rounded-xl border border-[var(--border-primary)] bg-secondary/20 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <LegendChip
                symbol="✓"
                tone="text-slate-300"
                label={t("engineering.permissions.legendInherited")}
              />
              <LegendChip
                symbol="+"
                tone="text-emerald-400"
                label={t("engineering.permissions.legendIndividualGrant")}
              />
              <LegendChip
                symbol="⊘"
                tone="text-red-400"
                label={t("engineering.permissions.restricted")}
              />
            </div>
            <p className="text-xs font-medium text-[var(--text-secondary)]">
              {t("engineering.permissions.personRightsHint")}
            </p>
            {ineligibleSectionCount > 0 && (
              <p className="text-xs font-medium text-[var(--text-secondary)] opacity-80">
                {t("engineering.permissions.personIneligibleSectionsNote")}
              </p>
            )}
          </div>
          )}

          {/* Tableaux de permissions */}
          {loadingPerms ? (
            <div
              role="status"
              aria-label={t("common.loading")}
              className="space-y-3"
            >
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
              <Skeleton className="h-40" />
            </div>
          ) : (
            <div className="space-y-6">
              {modulesError && (
                <Notice
                  tone="error"
                  title={t("engineering.permissions.catalogLoadFailed")}
                  action={
                    <RefreshButton
                      onClick={() => fetchModules()}
                      label={t("common.refresh")}
                    />
                  }
                >
                  {modulesError}
                </Notice>
              )}

              {!modulesError && moduleSections.length === 0 && (
                <p className="text-xs font-medium text-[var(--text-secondary)]">
                  {t("engineering.permissions.personNoSections")}
                </p>
              )}

              {moduleSections.length > 0 && (
                <div className="space-y-4">
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
                </div>
              )}

              {/* Capacités hors CRUD (grant, promote_super_admin, send,
                  publish, execute…). Masquées si le catalogue a échoué : une
                  liste vide laisserait croire qu'il n'y a rien à accorder. */}
              {!modulesError && (
                <div id="person-section-exceptions" className="scroll-mt-24">
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
                </div>
              )}
            </div>
          )}

          {/* Explication d'accès : référence, pas action — placée en dernier
              pour que les contrôles restent l'épine dorsale de l'écran. */}
          {userPerms.explanation && (
            <AccessExplanationPanel explanation={userPerms.explanation} t={t} />
          )}
        </section>
      )}

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

      {/* Confirmation des changements critiques / à haut risque :
          l'écriture est appliquée à la confirmation. */}
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
  );
}

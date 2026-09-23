"use client";

import React, { useState } from "react";
import {
  Scissors,
  Search,
  AlertTriangle,
  CheckCircle2,
  MinusCircle,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import AppButton from "@/components/ui/AppButton";
import AppModal from "@/components/ui/AppModal";

/**
 * Toast via the app-wide listener (src/components/ui/GlobalToast.js). Kept
 * local, like ProgramScopePanel's, so this block needs no cross-feature import.
 */
function notify(type, message) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("impactos:notify", { detail: { type, message } }),
  );
}

/** The endpoint that reports the impact and performs the repoint. */
const URL = "/api/engineering/permissions/program-portfolio-default";

/**
 * The capabilities each half of the flow needs, shown verbatim because they are
 * the identifiers an administrator has to ask for: the write is a
 * permissions-configuration change, the read is a matrix read.
 */
const ASSIGN_CAPABILITY = "permissions.assign_capabilities";
const READ_CAPABILITY = "permissions.view_matrix";

/** What the repoint would stop granting, row by row, from the server's answer. */
function RemovalList({ t, removals, whyLabel }) {
  return (
    <div className="space-y-1 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
      <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-400">
        <MinusCircle className="h-3 w-3" />
        {t("engineering.permissions.programScopeRemovalsTitle")}
      </p>
      {removals.map((removal) => (
        <div
          key={`${removal.module}.${removal.capability}`}
          className="flex flex-wrap items-center gap-2"
        >
          <span className="text-[11px] font-bold text-[var(--text-primary)]">
            {removal.module}.{removal.capability}
          </span>
          <span className="text-[10px] text-[var(--text-secondary)]">
            {whyLabel(removal)}
          </span>
          <span className="text-[10px] font-bold text-amber-400">
            {t("engineering.permissions.programScopeRemovalHolders", {
              n: removal.holders ?? 0,
            })}
          </span>
        </div>
      ))}
    </div>
  );
}

/** A labelled count, so the two decision numbers never sit unlabelled. */
function Count({ label, value }) {
  return (
    <div className="min-w-[8rem] flex-1 rounded-lg border border-[var(--border-primary)] bg-surface-1 px-3 py-2">
      <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
        {label}
      </p>
      <p className="mt-0.5 text-lg font-bold text-[var(--text-primary)]">
        {value}
      </p>
    </div>
  );
}

/**
 * PHASE UI-8d — the deliberate click behind the template split (step 3).
 *
 * ProgramScopePanel measures and explains the split above; this block is the
 * action that finishes it. Three rules it keeps:
 *
 *   1. THE IMPACT IS READ FIRST. Creating the trimmed portfolio template changed
 *      nobody. Pointing the programme-manager role default AT it is what removes
 *      the unrelated powers from everyone who resolves through that identity, so
 *      the read-only half is loaded and shown BEFORE the button that writes it:
 *      what would stop being granted, to how many people.
 *
 *   2. THE WRITE IS CONFIRMED, naming what it removes and how many people it
 *      affects — and the result is a statement of effect (what was removed, who
 *      it affected), never only of success.
 *
 *   3. A REFUSAL IS AN OUTCOME, NOT A CRASH. A 403 names the capability that is
 *      missing, the same way the manager repair above does. A 409 means the
 *      default was customised by hand: a deliberate choice being protected,
 *      reported with the reason the server gave. "already-repointed" says it is
 *      already pointed there instead of claiming a change that did not happen.
 */
export default function ProgramPortfolioDefaultAction({ onRefresh }) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [impact, setImpact] = useState(null);
  // { titleKey, message } — the read's refusal or failure.
  const [readError, setReadError] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  /**
   * The outcome of the write, kept inside the dialog so the answer appears where
   * the click happened. "done", "already", "unchanged" and "customized" are
   * outcomes (the dialog shows the result and offers Close); "forbidden" and
   * "failed" keep the dialog's buttons so the reason can be read and retried
   * once the missing capability is granted.
   */
  const [outcome, setOutcome] = useState(null);

  /**
   * Server errors arrive either as a locale key ("errors.insufficientPermissions")
   * or as a message; a key that resolves nowhere falls back to a local label so
   * this block never shows a raw key.
   */
  function messageFor(raw, fallbackKey) {
    const value = typeof raw === "string" ? raw.trim() : "";
    if (!value) return t(fallbackKey);
    const translated = t(value);
    if (translated !== value) return translated;
    return value.includes(" ") ? value : t(fallbackKey);
  }

  /**
   * The reason a capability is misplaced comes from the server's rows, translated
   * by capability so the line reads in the active language; an unmapped one falls
   * back to the reported reason.
   */
  function whyLabel(removal) {
    const key = `engineering.permissions.programScopeWhy_${removal.module}_${removal.capability}`;
    const value = t(key);
    return value === key ? removal.why || "" : value;
  }

  /** READ-ONLY: what the repoint would remove, and who it would reach. */
  async function readImpact() {
    setLoading(true);
    setReadError(null);
    setOutcome(null);
    try {
      const res = await fetch(URL, {
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json().catch(() => ({}));

      // Reading the impact is a matrix read, so its own capability is named.
      if (res.status === 403) {
        setReadError({
          titleKey:
            "engineering.permissions.programPortfolioDefaultReadForbiddenTitle",
          message: t(
            "engineering.permissions.programPortfolioDefaultReadForbidden",
            { capability: READ_CAPABILITY },
          ),
        });
        return;
      }
      if (!res.ok || data.success === false) {
        setReadError({
          titleKey:
            "engineering.permissions.programPortfolioDefaultFailedTitle",
          message: messageFor(
            data.error,
            "engineering.permissions.programPortfolioDefaultLoadFailed",
          ),
        });
        return;
      }

      setImpact(data.impact || {});
    } catch (error) {
      setReadError({
        titleKey: "engineering.permissions.programPortfolioDefaultFailedTitle",
        message:
          error.message ||
          t("engineering.permissions.programPortfolioDefaultLoadFailed"),
      });
    } finally {
      setLoading(false);
    }
  }

  function openConfirm() {
    setOutcome(null);
    setConfirmOpen(true);
  }

  function closeConfirm() {
    if (applying) return;
    setConfirmOpen(false);
  }

  /** THE WRITE. One action, no body: the repoint is the whole request. */
  async function repoint() {
    setApplying(true);
    setOutcome(null);
    try {
      const res = await fetch(URL, { method: "PUT" });
      const data = await res.json().catch(() => ({}));

      // A refusal is a legitimate answer: this is a permission-configuration
      // change. State which capability is missing instead of presenting a
      // permission decision as a crash.
      if (res.status === 403) {
        setOutcome({
          titleKey:
            "engineering.permissions.programPortfolioDefaultForbiddenTitle",
          message: t(
            "engineering.permissions.programPortfolioDefaultForbidden",
            { capability: ASSIGN_CAPABILITY },
          ),
        });
        return;
      }
      // 409: the default was set by hand. Protecting that choice is the correct
      // behaviour, so it is reported as the outcome it is — with the reason the
      // server gave, never as a generic failure.
      if (res.status === 409) {
        setOutcome({
          kind: "customized",
          profile: data.currentProfileId ?? null,
          reason: data.reason || "role-default-customized",
        });
        return;
      }
      if (!res.ok || data.success === false) {
        setOutcome({
          titleKey:
            "engineering.permissions.programPortfolioDefaultFailedTitle",
          message: messageFor(
            data.error,
            "engineering.permissions.programPortfolioDefaultFailed",
          ),
        });
        return;
      }

      // Nothing was written because there was nothing to write.
      if (data.changed === false) {
        setOutcome(
          !data.reason || data.reason === "already-repointed"
            ? { kind: "already" }
            : { kind: "unchanged", reason: data.reason },
        );
        return;
      }

      setOutcome({
        kind: "done",
        to: data.to || null,
        from: data.from || null,
        removed: Array.isArray(data.removed) ? data.removed : [],
        peopleAffected: data.peopleAffected ?? 0,
      });
      notify(
        "success",
        t("engineering.permissions.programPortfolioDefaultResultPointed", {
          profile: data.to || "—",
        }),
      );
      // The default just moved: re-read the report above so its counts and
      // template rows are the truth after the change.
      onRefresh?.();
    } catch (error) {
      setOutcome({
        titleKey: "engineering.permissions.programPortfolioDefaultFailedTitle",
        message:
          error.message ||
          t("engineering.permissions.programPortfolioDefaultFailed"),
      });
    } finally {
      setApplying(false);
    }
  }

  const removals = impact?.removals || [];
  const templates = impact?.portfolioTemplates || [];
  const peopleAffected = impact?.peopleAffected ?? 0;

  /** Outcomes that end the flow: the dialog states the result and offers Close. */
  const settled =
    outcome &&
    (outcome.kind === "done" ||
      outcome.kind === "already" ||
      outcome.kind === "unchanged" ||
      outcome.kind === "customized");

  /** A refusal or a failure stated inline, never presented as a crash. */
  function errorBlock(error) {
    if (!error) return null;
    return (
      <div className="space-y-1 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
        <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-400">
          <AlertTriangle className="h-3 w-3" />
          {t(error.titleKey)}
        </p>
        <p className="text-[10px] leading-relaxed text-[var(--text-secondary)]">
          {error.message}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 border-t border-[var(--border-primary)] pt-3">
      <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-primary)]">
        <Scissors className="h-3 w-3 text-[var(--brand-orange)]" />
        {t("engineering.permissions.programPortfolioDefaultTitle")}
      </p>
      <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
        {t("engineering.permissions.programPortfolioDefaultBody")}
      </p>

      <AppButton
        variant="secondary"
        size="sm"
        icon={Search}
        loading={loading}
        onClick={readImpact}
      >
        {t("engineering.permissions.programPortfolioDefaultLoad")}
      </AppButton>

      {errorBlock(readError)}

      {impact && (
        <div className="space-y-2 rounded-lg border border-[var(--border-primary)] bg-surface-2 px-3 py-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
            {t("engineering.permissions.programPortfolioDefaultImpactTitle")}
          </p>
          <p className="text-[10px] leading-relaxed text-[var(--text-secondary)]">
            {t("engineering.permissions.programPortfolioDefaultImpactBody")}
          </p>

          {removals.length === 0 ? (
            <p className="text-[10px] leading-relaxed text-[var(--text-secondary)]">
              {t("engineering.permissions.programScopeRemovalsEmpty")}
            </p>
          ) : (
            <RemovalList t={t} removals={removals} whyLabel={whyLabel} />
          )}

          <div className="flex flex-wrap gap-2">
            <Count
              label={t("engineering.permissions.programPortfolioDefaultPeople")}
              value={peopleAffected}
            />
            <Count
              label={t(
                "engineering.permissions.programPortfolioDefaultTemplates",
              )}
              value={templates.length}
            />
          </div>

          <AppButton
            variant="primary"
            size="sm"
            icon={Scissors}
            onClick={openConfirm}
          >
            {t("engineering.permissions.programPortfolioDefaultAction")}
          </AppButton>
        </div>
      )}

      {/* ── Confirmation, then the result, in the same dialog ─────────── */}
      <AppModal
        isOpen={confirmOpen}
        onClose={closeConfirm}
        title={t("engineering.permissions.programPortfolioDefaultConfirmTitle")}
        size="md"
      >
        {settled ? (
          <div className="space-y-3">
            <div className="space-y-2 rounded-lg border border-[var(--border-primary)] bg-surface-2 px-3 py-2">
              {outcome.kind === "done" && (
                <>
                  <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--brand-orange)]">
                    <CheckCircle2 className="h-3 w-3" />
                    {t(
                      "engineering.permissions.programPortfolioDefaultResultTitle",
                    )}
                  </p>
                  <p className="text-[11px] leading-relaxed text-[var(--text-primary)]">
                    {t(
                      "engineering.permissions.programPortfolioDefaultResultPointed",
                      { profile: outcome.to || "—" },
                    )}
                  </p>
                  {outcome.from && (
                    <p className="text-[10px] text-[var(--text-secondary)]">
                      {t(
                        "engineering.permissions.programPortfolioDefaultResultFrom",
                        { profile: outcome.from },
                      )}
                    </p>
                  )}
                  <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                    {t(
                      "engineering.permissions.programPortfolioDefaultResultRemoved",
                    )}
                  </p>
                  {outcome.removed.length === 0 ? (
                    <p className="text-[10px] leading-relaxed text-[var(--text-secondary)]">
                      {t(
                        "engineering.permissions.programPortfolioDefaultResultRemovedNone",
                      )}
                    </p>
                  ) : (
                    <ul className="list-disc space-y-0.5 pl-4">
                      {outcome.removed.map((capability) => (
                        <li
                          key={capability}
                          className="text-[11px] font-bold text-[var(--text-primary)]"
                        >
                          {capability}
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                      {t("engineering.permissions.programPortfolioDefaultPeople")}
                    </span>
                    <span className="text-[11px] font-bold text-[var(--text-primary)]">
                      {outcome.peopleAffected}
                    </span>
                  </p>
                </>
              )}

              {outcome.kind === "already" && (
                <>
                  <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                    <CheckCircle2 className="h-3 w-3" />
                    {t(
                      "engineering.permissions.programPortfolioDefaultAlreadyTitle",
                    )}
                  </p>
                  <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
                    {t("engineering.permissions.programPortfolioDefaultAlready")}
                  </p>
                </>
              )}

              {outcome.kind === "unchanged" && (
                <>
                  <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                    <AlertTriangle className="h-3 w-3" />
                    {t(
                      "engineering.permissions.programPortfolioDefaultUnchangedTitle",
                    )}
                  </p>
                  <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
                    {t(
                      "engineering.permissions.programPortfolioDefaultUnchanged",
                    )}
                  </p>
                  <p className="text-[10px] text-[var(--text-secondary)]">
                    {t("engineering.permissions.programPortfolioDefaultReason", {
                      reason: outcome.reason,
                    })}
                  </p>
                </>
              )}

              {outcome.kind === "customized" && (
                <>
                  <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-400">
                    <AlertTriangle className="h-3 w-3" />
                    {t(
                      "engineering.permissions.programPortfolioDefaultCustomizedTitle",
                    )}
                  </p>
                  <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
                    {t(
                      "engineering.permissions.programPortfolioDefaultCustomized",
                    )}
                  </p>
                  {outcome.profile && (
                    <p className="text-[10px] text-[var(--text-secondary)]">
                      {t(
                        "engineering.permissions.programPortfolioDefaultCustomizedProfile",
                        { profile: outcome.profile },
                      )}
                    </p>
                  )}
                  <p className="text-[10px] text-[var(--text-secondary)]">
                    {t("engineering.permissions.programPortfolioDefaultReason", {
                      reason: outcome.reason,
                    })}
                  </p>
                </>
              )}
            </div>
            <div className="flex justify-end">
              <AppButton
                variant="secondary"
                size="sm"
                onClick={() => setConfirmOpen(false)}
              >
                {t("common.close")}
              </AppButton>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
              {t("engineering.permissions.programPortfolioDefaultConfirmBody", {
                n: peopleAffected,
              })}
            </p>

            {removals.length > 0 && (
              <RemovalList t={t} removals={removals} whyLabel={whyLabel} />
            )}

            {errorBlock(outcome)}

            <div className="flex justify-end gap-2">
              <AppButton
                variant="secondary"
                size="sm"
                onClick={closeConfirm}
                disabled={applying}
              >
                {t("common.cancel")}
              </AppButton>
              <AppButton
                variant="primary"
                size="sm"
                icon={Scissors}
                loading={applying}
                onClick={repoint}
              >
                {t(
                  "engineering.permissions.programPortfolioDefaultConfirmApply",
                )}
              </AppButton>
            </div>
          </div>
        )}
      </AppModal>
    </div>
  );
}

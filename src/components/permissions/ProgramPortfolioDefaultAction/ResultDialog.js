"use client";

import { AlertTriangle, CheckCircle2, MinusCircle, Scissors } from "lucide-react";
import AppButton from "@/components/ui/AppButton";
import AppModal from "@/components/ui/AppModal";
import { useI18n } from "@/lib/i18n";

/**
 * The repoint action's DISPLAY surface, extracted verbatim from
 * ProgramPortfolioDefaultAction.js. It owns no state, runs no reads and calls no
 * endpoint: the parent passes the read impact, the outcome of the write and the
 * two callbacks (confirm / apply). The removal rows and the labelled counts are
 * shared with the impact panel above, so they travel with the modal.
 */

/** What the repoint would stop granting, row by row, from the server's answer. */
export function RemovalList({ t, removals, whyLabel }) {
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
export function Count({ label, value }) {
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

/** A refusal or a failure stated inline, never presented as a crash. */
export function ErrorBlock({ error }) {
  const { t } = useI18n();
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

export default function ResultDialog({
  isOpen,
  onClose,
  onDismiss,
  settled,
  outcome,
  peopleAffected,
  removals,
  whyLabel,
  applying,
  onRepoint,
}) {
  const { t } = useI18n();
  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
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
            <AppButton variant="secondary" size="sm" onClick={onDismiss}>
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

          <ErrorBlock error={outcome} />

          <div className="flex justify-end gap-2">
            <AppButton
              variant="secondary"
              size="sm"
              onClick={onClose}
              disabled={applying}
            >
              {t("common.cancel")}
            </AppButton>
            <AppButton
              variant="primary"
              size="sm"
              icon={Scissors}
              loading={applying}
              onClick={onRepoint}
            >
              {t(
                "engineering.permissions.programPortfolioDefaultConfirmApply",
              )}
            </AppButton>
          </div>
        </div>
      )}
    </AppModal>
  );
}

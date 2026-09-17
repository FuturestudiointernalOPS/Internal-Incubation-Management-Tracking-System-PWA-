"use client";

import React, { useState } from "react";
import {
  ToggleRight,
  AlertTriangle,
  CheckCircle2,
  EyeOff,
  Power,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import AppButton from "@/components/ui/AppButton";
import AppModal from "@/components/ui/AppModal";
import AppBadge from "@/components/ui/AppBadge";
import AppEmptyState from "@/components/ui/AppEmptyState";
import {
  WaveEnableRefusal,
  WaveOverrideConfirm,
} from "./ProgramScopeWaveRefusal";

/**
 * Toast via the app-wide listener (src/components/ui/GlobalToast.js). Kept
 * local, like ProgramScopePanel's and OperationsView's, so this block needs no
 * cross-feature import.
 */
function notify(type, message) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("impactos:notify", { detail: { type, message } }),
  );
}

/**
 * The same compact result tile as ProgramScopePanel's `Stat` — the Operations
 * screen uses this small variant rather than ui/StatCard so a row of four still
 * fits the section.
 */
function Stat({ label, value, tone = "neutral" }) {
  const toneClass =
    tone === "warn"
      ? "text-amber-400"
      : tone === "good"
        ? "text-[var(--brand-orange)]"
        : "text-[var(--text-primary)]";
  return (
    <div className="rounded-lg border border-[var(--border-primary)] bg-surface-1 px-3 py-2">
      <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
        {label}
      </p>
      <p className={`mt-0.5 text-lg font-bold ${toneClass}`}>{value}</p>
    </div>
  );
}

/**
 * The switch itself. There is no ui/Switch primitive and no toggle of this
 * shape elsewhere in the Permission Center, so the one control is defined here:
 * a real `role="switch"` button (keyboard and screen-reader correct by
 * construction) coloured from theme variables only.
 */
function WaveSwitch({ checked, busy = false, label, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={busy}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]/60 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked
          ? "border-[var(--brand-orange)] bg-[var(--brand-orange)]"
          : "border-[var(--border-primary)] bg-surface-3"
      }`}
    >
      <span
        aria-hidden="true"
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-surface-1 transition-transform ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

/**
 * The capability the write needs. It is a permission-configuration change, not
 * a programme write, and it is shown verbatim because it is the identifier an
 * administrator has to ask for.
 */
const ASSIGN_CAPABILITY = "permissions.assign_capabilities";

/** Stable identity for "no remembered answer" — never reallocated per render. */
const NO_OVERRIDES = {};

/**
 * The two findings that make a wave unsafe, printed as the repairs to do first:
 * running programmes nobody is recorded as managing (the rule can match nobody
 * for them) and people who would be left attached to no programme at all.
 */
function blockersFor(t, blockers) {
  const counted = blockers || {};
  const items = [];
  if ((counted.unmanaged ?? 0) > 0) {
    items.push(
      t("engineering.permissions.programScopeWaveBlockerUnmanaged", {
        n: counted.unmanaged,
      }),
    );
  }
  if ((counted.losesEverything ?? 0) > 0) {
    items.push(
      t("engineering.permissions.programScopeWaveBlockerLosesEverything", {
        n: counted.losesEverything,
      }),
    );
  }
  return items;
}

/** The safety verdict of one wave: an affirmation, or exactly what blocks it. */
function WaveVerdict({ t, row }) {
  if (row.safe === true) {
    return (
      <p className="flex items-start gap-1.5 text-[10px] leading-relaxed text-[var(--text-secondary)]">
        <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-[var(--brand-orange)]" />
        <span>{t("engineering.permissions.programScopeWaveSafe")}</span>
      </p>
    );
  }
  return (
    <div className="space-y-1 rounded-lg border border-amber-500/30 bg-amber-500/5 px-2 py-1.5">
      <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-400">
        <AlertTriangle className="h-3 w-3" />
        {t("engineering.permissions.programScopeWaveUnsafe")}
      </p>
      <ul className="list-disc space-y-0.5 pl-4">
        {blockersFor(t, row.blockers).map((item) => (
          <li
            key={item}
            className="text-[10px] leading-relaxed text-[var(--text-secondary)]"
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Partial coverage is a WARNING, not a detail: the exempt surfaces stay open
 * however this switch is set, and an administrator must not read a wave as
 * having closed a door it did not.
 */
function PartialCoverage({ t, row }) {
  const exempt = Array.isArray(row.exempt) ? row.exempt : [];
  return (
    <div className="space-y-1 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2">
      <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-400">
        <EyeOff className="h-3 w-3" />
        {t("engineering.permissions.programScopeWavePartialTitle")}
      </p>
      <p className="text-[10px] leading-relaxed text-[var(--text-secondary)]">
        {t("engineering.permissions.programScopeWavePartialBody")}
      </p>
      <ul className="list-disc space-y-0.5 pl-4">
        {exempt.map((surface) => (
          <li
            key={surface}
            className="text-[10px] font-bold leading-relaxed text-[var(--text-primary)]"
          >
            {surface}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A refusal (or a failure) stated inline, never presented as a crash. */
function WaveError({ t, error }) {
  if (!error) return null;
  return (
    <div className="space-y-1 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
      <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-400">
        <AlertTriangle className="h-3 w-3" />
        {error.kind === "forbidden"
          ? t("engineering.permissions.programScopeWaveForbiddenTitle")
          : t("engineering.permissions.programScopeWaveFailedTitle")}
      </p>
      <p className="text-[10px] leading-relaxed text-[var(--text-secondary)]">
        {error.message}
      </p>
    </div>
  );
}

/**
 * PHASE UI-8c — the rollout switch (Permission Center › Operations, step 4/5).
 *
 * ProgramScopePanel measures and repairs; this block is the decision with a
 * date. Enforcing programme record scope is a REMOVAL, so it is switched on one
 * domain at a time, never by deploying, and each domain can be turned back off
 * in one click.
 *
 * Three things the administrator must not have to infer:
 *
 *   1. THE VERDICT. `safe` is false while any running programme has no manager
 *      recorded, or while anybody would be left attached to no programme. Both
 *      counts are printed, because they are the two jobs to do first — a
 *      refusal to switch on with no reason is not actionable.
 *
 *   2. PARTIAL COVERAGE. A wave that is `partial` does NOT close its whole
 *      domain: the `exempt` surfaces keep working for everyone until their own
 *      counterpart is converted (the legacy V2 routes are reserved by the
 *      project instruction and are left alone). This is stated as a warning
 *      block, not a footnote, so nobody believes a door was closed that was not.
 *
 *   3. THE DIRECTION. Switching ON removes access from people who are not
 *      attached to a programme, so it asks for confirmation. Switching OFF
 *      restores access and needs none — confirmation only ever guards the
 *      harmful direction.
 *
 *   4. THE REFUSAL (./ProgramScopeWaveRefusal). The server refuses (409) to
 *      switch a domain on while it is unsafe, and sends the two findings back
 *      with the refusal. That is its own state, not a generic failure: it is
 *      printed beside the switch with the repairs to do, and it is answered
 *      either by doing those repairs or by an explicit override — a second,
 *      separately confirmed write. Nothing about the refusal is retried on its
 *      own, and nothing about it is automatic.
 *
 * The write needs `permissions.assign_capabilities`, so a 403 is a legitimate
 * answer and is rendered as an inline reason naming the capability, exactly
 * like the manager-assign repair in the parent panel.
 */
export default function ProgramScopeWaves({ report, onRefresh }) {
  const { t } = useI18n();
  const [busyWave, setBusyWave] = useState(null);
  // { kind: "forbidden" | "failed", message }
  const [error, setError] = useState(null);
  // The wave awaiting confirmation before it is switched ON.
  const [pending, setPending] = useState(null);
  /**
   * The 409 refusal: the server declined to switch the wave ON while it is
   * unsafe. Tagged with the report it answered, so a freshly loaded report drops
   * the refusal instead of leaving stale counts on screen.
   */
  const [refusal, setRefusal] = useState(null);
  /**
   * The wave whose safety check the administrator chose to overrule. The
   * override is only ever sent from this wave's own confirmation — never
   * automatically, and never from the refusal itself.
   */
  const [overridePending, setOverridePending] = useState(null);
  /**
   * `waveSafety` as the switch endpoint last reported it, tagged with the report
   * it was applied to. The server stays authoritative: once a freshly loaded
   * report arrives the tag no longer matches, so the remembered answer is dropped
   * rather than masking the new numbers.
   */
  const [patch, setPatch] = useState({ report: null, waves: NO_OVERRIDES });
  const overrides =
    report && patch.report === report ? patch.waves : NO_OVERRIDES;
  /** The refusal, while it still describes the report on screen. */
  const activeRefusal =
    refusal && refusal.report === report ? refusal : null;

  const rows = Array.isArray(report?.waveSafety) ? report.waveSafety : [];
  const summary = report?.summary || {};

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

  /** The wave's own label, in the active language when a translation exists. */
  function waveLabel(row) {
    const key = `engineering.permissions.programScopeWaveLabel_${row.wave}`;
    const value = t(key);
    return value === key ? row.label || row.wave : value;
  }

  /** What the wave covers, in the active language when a translation exists. */
  function waveCovers(row) {
    const key = `engineering.permissions.programScopeWaveCovers_${row.wave}`;
    const value = t(key);
    return value === key ? row.covers || "" : value;
  }

  function isEnabled(row) {
    return overrides[row.wave] ?? row.enabled === true;
  }

  const enabledCount = rows.length
    ? rows.filter((row) => isEnabled(row)).length
    : Number.isFinite(summary.wavesEnabled)
      ? summary.wavesEnabled
      : 0;
  const safeToEnable =
    typeof summary.safeToEnable === "boolean"
      ? summary.safeToEnable
      : rows.length > 0 && rows.every((row) => row.safe === true);

  function requestChange(row, next) {
    setError(null);
    // Only the direction that REMOVES access is confirmed.
    if (next) setPending(row);
    else applyChange(row, false);
  }

  function closePending() {
    if (busyWave) return;
    setPending(null);
    setError(null);
  }

  function closeOverride() {
    if (busyWave) return;
    setOverridePending(null);
    setError(null);
  }

  async function applyChange(row, enabled, { override = false } = {}) {
    if (!row?.wave) return;
    setBusyWave(row.wave);
    setError(null);
    try {
      const res = await fetch(
        "/api/engineering/permissions/program-scope-strictness",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          // The override is an extra, explicit word in the body: the ordinary
          // write is still only the wave and the direction.
          body: override
            ? JSON.stringify({ wave: row.wave, enabled, override: true })
            : JSON.stringify({ wave: row.wave, enabled }),
        },
      );
      const data = await res.json().catch(() => ({}));

      // A refusal is a legitimate answer here: a rollout switch is a
      // permission-configuration change. State which capability is missing
      // instead of presenting a permission decision as a crash. The dialog
      // stays open so the reason appears where the click happened.
      if (res.status === 403) {
        setError({
          kind: "forbidden",
          message: t("engineering.permissions.programScopeWaveForbidden", {
            capability: ASSIGN_CAPABILITY,
          }),
        });
        return;
      }

      // The server REFUSES to switch a domain on while it is unsafe, and sends
      // the two findings back with the refusal. That is its own state, not a
      // generic failure and not something to retry: it says what to repair, and
      // the only other answer is an explicit override in a second, separately
      // confirmed write. The refusal is therefore rendered beside the switch
      // rather than inside a dialog that would invite the same click again.
      if (
        res.status === 409 &&
        enabled &&
        data.reason === "not-safe-to-enable"
      ) {
        setRefusal({
          report,
          wave: row.wave,
          reason: data.reason,
          blockers: data.blockers || {},
        });
        setPending((current) => (current?.wave === row.wave ? null : current));
        return;
      }

      if (!res.ok || data.success === false) {
        setError({
          kind: "failed",
          message: messageFor(
            data.error,
            "engineering.permissions.programScopeWaveFailed",
          ),
        });
        return;
      }

      // The response carries the whole resulting state: take the row from it,
      // then re-read the report so the counts above are the truth after the
      // change instead of the numbers from before it.
      if (data.waves && typeof data.waves === "object") {
        setPatch({ report, waves: { ...overrides, ...data.waves } });
      }
      // The wave moved, so any refusal about it (and any override dialog for it)
      // no longer describes the state on screen.
      setRefusal((current) => (current?.wave === row.wave ? null : current));
      setOverridePending(null);
      setPending(null);
      notify(
        "success",
        // An override is acknowledged as one: the audit record says so, and the
        // toast should not read like an ordinary switch.
        override
          ? t("engineering.permissions.programScopeWaveOverrideDone", {
              wave: waveLabel(row),
            })
          : t(
              enabled
                ? "engineering.permissions.programScopeWaveDoneOn"
                : "engineering.permissions.programScopeWaveDoneOff",
              { wave: waveLabel(row) },
            ),
      );
      onRefresh?.();
    } catch (e) {
      setError({
        kind: "failed",
        message:
          e.message || t("engineering.permissions.programScopeWaveFailed"),
      });
    } finally {
      setBusyWave(null);
    }
  }

  const pendingLabel = pending ? waveLabel(pending) : "";
  const pendingBusy = !!pending && busyWave === pending.wave;
  const overrideLabel = overridePending ? waveLabel(overridePending) : "";
  const overrideBusy = !!overridePending && busyWave === overridePending.wave;

  return (
    <div className="space-y-2 border-t border-[var(--border-primary)] pt-3">
      <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-primary)]">
        <ToggleRight className="h-3 w-3 text-[var(--brand-orange)]" />
        {t("engineering.permissions.programScopeWavesTitle")}
      </p>
      <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
        {t("engineering.permissions.programScopeWavesBody")}
      </p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat
          label={t("engineering.permissions.programScopeWavesEnabled")}
          value={`${enabledCount} / ${rows.length}`}
          tone={enabledCount > 0 ? "good" : "neutral"}
        />
        <Stat
          label={t("engineering.permissions.programScopeWavesSafeToEnable")}
          value={
            safeToEnable
              ? t("engineering.permissions.programScopeWavesReadyYes")
              : t("engineering.permissions.programScopeWavesReadyNo")
          }
          tone={safeToEnable ? "good" : "warn"}
        />
      </div>

      {/* Inline unless a dialog is already showing the same reason. */}
      {error && !pending && !overridePending && <WaveError t={t} error={error} />}

      {rows.length === 0 ? (
        <AppEmptyState
          size="sm"
          icon={ToggleRight}
          title={t("engineering.permissions.programScopeWavesEmpty")}
        />
      ) : (
        <div className="space-y-1.5">
          {rows.map((row) => {
            const enabled = isEnabled(row);
            const busy = busyWave === row.wave;
            return (
              <div
                key={row.wave}
                className={`space-y-2 rounded-lg border px-3 py-2 ${
                  enabled
                    ? "border-[var(--brand-orange)]/40 bg-[var(--brand-orange)]/5"
                    : "border-[var(--border-primary)] bg-surface-2"
                }`}
              >
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-[var(--text-primary)]">
                        {waveLabel(row)}
                      </span>
                      <AppBadge variant={enabled ? "success" : "default"}>
                        {enabled
                          ? t(
                              "engineering.permissions.programScopeWavesRowEnabled",
                            )
                          : t(
                              "engineering.permissions.programScopeWavesRowDisabled",
                            )}
                      </AppBadge>
                      <AppBadge
                        variant={row.safe === true ? "success" : "warning"}
                      >
                        {row.safe === true
                          ? t("engineering.permissions.programScopeWaveSafeBadge")
                          : t(
                              "engineering.permissions.programScopeWaveUnsafeBadge",
                            )}
                      </AppBadge>
                    </div>
                    <p className="text-[10px] leading-relaxed text-[var(--text-secondary)]">
                      {waveCovers(row)}
                    </p>
                  </div>
                  <WaveSwitch
                    checked={enabled}
                    busy={busy}
                    label={
                      enabled
                        ? t(
                            "engineering.permissions.programScopeWaveSwitchOffAria",
                            { wave: waveLabel(row) },
                          )
                        : t(
                            "engineering.permissions.programScopeWaveSwitchOnAria",
                            { wave: waveLabel(row) },
                          )
                    }
                    onChange={(next) => requestChange(row, next)}
                  />
                </div>

                <WaveVerdict t={t} row={row} />

                {/* The server's own refusal, stated where the switch is. */}
                {activeRefusal?.wave === row.wave && (
                  <WaveEnableRefusal
                    t={t}
                    reason={activeRefusal.reason}
                    items={blockersFor(t, activeRefusal.blockers)}
                    onOverride={() => {
                      setError(null);
                      setOverridePending(row);
                    }}
                  />
                )}

                {row.partial === true && <PartialCoverage t={t} row={row} />}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Confirmation — only before a wave is switched ON ───────────── */}
      <AppModal
        isOpen={!!pending}
        onClose={closePending}
        title={t("engineering.permissions.programScopeWaveConfirmTitle", {
          wave: pendingLabel,
        })}
        size="sm"
      >
        <div className="space-y-3">
          <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
            {t("engineering.permissions.programScopeWaveConfirmBody")}
          </p>
          {pending && pending.safe !== true && (
            <WaveVerdict t={t} row={pending} />
          )}
          <WaveError t={t} error={error} />
          <div className="flex justify-end gap-2">
            <AppButton
              variant="secondary"
              size="sm"
              onClick={closePending}
              disabled={pendingBusy}
            >
              {t("common.cancel")}
            </AppButton>
            <AppButton
              variant="primary"
              size="sm"
              icon={Power}
              loading={pendingBusy}
              onClick={() => applyChange(pending, true)}
            >
              {t("engineering.permissions.programScopeWaveConfirmApply")}
            </AppButton>
          </div>
        </div>
      </AppModal>

      {/* ── Override — the deliberate second write, never automatic ───── */}
      <WaveOverrideConfirm
        t={t}
        wave={overrideLabel}
        open={!!overridePending}
        items={blockersFor(
          t,
          activeRefusal?.blockers || overridePending?.blockers,
        )}
        busy={overrideBusy}
        onCancel={closeOverride}
        onConfirm={() => applyChange(overridePending, true, { override: true })}
      >
        <WaveError t={t} error={error} />
      </WaveOverrideConfirm>
    </div>
  );
}

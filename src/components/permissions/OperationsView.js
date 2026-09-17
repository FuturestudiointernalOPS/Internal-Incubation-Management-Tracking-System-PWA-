"use client";

import React, { useState } from "react";
import {
  RefreshCw,
  ShieldAlert,
  Play,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import AppButton from "@/components/ui/AppButton";
import AppModal from "@/components/ui/AppModal";

/**
 * Toast via the app-wide listener (src/components/ui/GlobalToast.js). Kept
 * local instead of importing another feature's helper so this screen has no
 * dependency on the LMS module.
 */
function notify(type, message) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("impactos:notify", { detail: { type, message } }),
  );
}

/**
 * PHASE UI-8 — Operations (Permission Center).
 *
 * The two PORTFOLIO-WIDE jobs. Both change or describe access for many people
 * at once, and before this screen neither had a button anywhere in the product:
 * they were reachable only by typing a URL. The most consequential operations in
 * the system were invisible to the administrator who owns them.
 *
 *   1. RE-DERIVE FROM RELATIONSHIPS
 *      Applies the Context Roles mapping at the relationship boundary: an active
 *      venture founder, program facilitator or program manager receives the
 *      capabilities their relationship justifies, and grants whose relationship
 *      ended are withdrawn. Additive and idempotent — a manual grant and an
 *      administrator's block are never touched (a block is applied by the
 *      resolver AFTER the merge, so it always wins).
 *
 *   2. READINESS / IMPACT REPORT
 *      Read-only. Per person holding a program assignment: what has been applied,
 *      what the next re-derive would change, and — the number that matters —
 *      which capabilities they hold today that their ASSIGNMENT does not
 *      justify. That last list is exactly what disappears the day access becomes
 *      strictly assignment-derived, so it is what you read BEFORE narrowing the
 *      portfolio-wide defaults.
 *
 * Neither action is a security boundary of its own: both call endpoints that
 * require the permission-matrix read capability, and the server decides.
 */

/** One result tile: a label, a value, and whether the value needs attention. */
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

/** A confirmation the admin must accept, naming what is about to happen. */
function ConfirmDialog({ open, title, body, confirmLabel, onCancel, onConfirm, busy }) {
  return (
    <AppModal isOpen={open} onClose={onCancel} title={title} size="sm">
      <p className="text-xs leading-relaxed text-[var(--text-secondary)]">{body}</p>
      <div className="mt-5 flex justify-end gap-2">
        <AppButton variant="secondary" onClick={onCancel} disabled={busy}>
          {confirmLabel.cancel}
        </AppButton>
        <AppButton
          variant="primary"
          onClick={onConfirm}
          loading={busy}
          icon={Play}
        >
          {confirmLabel.run}
        </AppButton>
      </div>
    </AppModal>
  );
}

export default function OperationsView() {
  const { t } = useI18n();
  const [confirmReconcile, setConfirmReconcile] = useState(false);
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState(null);

  const [loadingReadiness, setLoadingReadiness] = useState(false);
  const [readiness, setReadiness] = useState(null);

  async function run(kind) {
    const setBusy = kind === "reconcile" ? setRunning : setLoadingReadiness;
    const url =
      kind === "reconcile"
        ? "/api/engineering/permissions/sync-context-grants"
        : "/api/engineering/permissions/context-grant-readiness";
    setBusy(true);
    try {
      const res = await fetch(url, { headers: { "Content-Type": "application/json" } });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(data.error || t("engineering.permissions.operationsFailed"));
      }
      if (kind === "reconcile") {
        setReport(data);
        notify(
          "success",
          t("engineering.permissions.operationsReconcileDone").replace(
            "{n}",
            String(data.changes ?? 0),
          ),
        );
      } else {
        setReadiness(data);
      }
    } catch (e) {
      notify("error", e.message || t("engineering.permissions.operationsFailed"));
    } finally {
      setBusy(false);
    }
  }

  const contexts = report?.contexts || [];

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-[var(--border-primary)] bg-secondary/40 p-4">
        <p className="text-xs font-bold leading-relaxed text-[var(--text-primary)]">
          {t("engineering.permissions.operationsIntro")}
        </p>
      </div>

      {/* ── 1. Re-derive from relationships ─────────────────────────────── */}
      <section className="rounded-xl border border-[var(--border-primary)] bg-surface-1 p-4 space-y-3">
        <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-primary)]">
          <RefreshCw className="h-3.5 w-3.5 text-[var(--brand-orange)]" />
          {t("engineering.permissions.operationsReconcileTitle")}
        </p>
        <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
          {t("engineering.permissions.operationsReconcileBody")}
        </p>
        <AppButton
          variant="primary"
          size="sm"
          icon={RefreshCw}
          loading={running}
          onClick={() => setConfirmReconcile(true)}
        >
          {t("engineering.permissions.operationsReconcileRun")}
        </AppButton>

        {report && (
          <div className="space-y-3 border-t border-[var(--border-primary)] pt-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat
                label={t("engineering.permissions.operationsPeople")}
                value={report.evaluated ?? 0}
              />
              <Stat
                label={t("engineering.permissions.operationsApplied")}
                value={(report.applied || []).length}
                tone="good"
              />
              <Stat
                label={t("engineering.permissions.operationsWithdrawn")}
                value={(report.revoked || []).length}
              />
              <Stat
                label={t("engineering.permissions.operationsChanges")}
                value={report.changes ?? 0}
                tone={(report.changes ?? 0) > 0 ? "warn" : "neutral"}
              />
            </div>

            {contexts.length > 0 ? (
              <div className="space-y-1.5">
                {contexts.map((c) => (
                  <div
                    key={`${c.context}:${c.roleKey}`}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border-primary)] bg-surface-2 px-3 py-2"
                  >
                    <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                      {c.context} · {c.roleKey}
                    </span>
                    <span className="text-[10px] text-[var(--text-secondary)]">
                      {t("engineering.permissions.operationsEvaluated").replace(
                        "{n}",
                        String(c.evaluated ?? 0),
                      )}
                    </span>
                    {c.changes === 0 ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-[var(--brand-orange)]">
                        <CheckCircle2 className="h-3 w-3" />
                        {t("engineering.permissions.operationsUpToDate")}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-amber-400">
                        +{c.applied?.length ?? 0} / −{c.revoked?.length ?? 0}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              report.context && (
                <p className="text-[10px] text-[var(--text-secondary)]">
                  {report.context} · {report.roleKey}
                </p>
              )
            )}
          </div>
        )}
      </section>

      {/* ── 2. Readiness / impact ───────────────────────────────────────── */}
      <section className="rounded-xl border border-[var(--border-primary)] bg-surface-1 p-4 space-y-3">
        <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-primary)]">
          <ShieldAlert className="h-3.5 w-3.5 text-[var(--brand-orange)]" />
          {t("engineering.permissions.operationsReadinessTitle")}
        </p>
        <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
          {t("engineering.permissions.operationsReadinessBody")}
        </p>
        <AppButton
          variant="secondary"
          size="sm"
          icon={ShieldAlert}
          loading={loadingReadiness}
          onClick={() => run("readiness")}
        >
          {t("engineering.permissions.operationsReadinessRun")}
        </AppButton>

        {readiness && (
          <div className="space-y-3 border-t border-[var(--border-primary)] pt-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat
                label={t("engineering.permissions.operationsPeople")}
                value={readiness.summary?.people ?? 0}
              />
              <Stat
                label={t("engineering.permissions.operationsAssignments")}
                value={readiness.summary?.assignments ?? 0}
              />
              <Stat
                label={t("engineering.permissions.operationsDrift")}
                value={readiness.summary?.drift ?? 0}
                tone={(readiness.summary?.drift ?? 0) > 0 ? "warn" : "neutral"}
              />
              <Stat
                label={t("engineering.permissions.operationsImpacted")}
                value={readiness.summary?.impact ?? 0}
                tone={(readiness.summary?.impact ?? 0) > 0 ? "warn" : "good"}
              />
            </div>

            {(readiness.summary?.wouldLose || []).length > 0 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
                <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-400">
                  <AlertTriangle className="h-3 w-3" />
                  {t("engineering.permissions.operationsWouldLose")}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-secondary)]">
                  {readiness.summary.wouldLose.join(", ")}
                </p>
              </div>
            )}

            {(readiness.rows || []).length === 0 ? (
              <p className="text-xs text-[var(--text-secondary)]">
                {t("engineering.permissions.operationsReadinessEmpty")}
              </p>
            ) : (
              <div className="space-y-1.5">
                {readiness.rows.map((row) => (
                  <div
                    key={`${row.cid}:${row.roleKey}`}
                    className="rounded-lg border border-[var(--border-primary)] bg-surface-2 px-3 py-2"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-[var(--text-primary)]">
                        {row.name || row.cid}
                      </span>
                      <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                        {row.roleKey}
                      </span>
                      <span className="text-[10px] text-[var(--text-secondary)]">
                        {row.programs?.length ?? 0}{" "}
                        {t("engineering.permissions.operationsPrograms")}
                      </span>
                      {row.expiresAt && (
                        <span className="text-[10px] text-[var(--text-secondary)]">
                          {t("engineering.permissions.operationsEnds")} {row.expiresAt}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[10px] leading-relaxed text-[var(--text-secondary)]">
                      <span className="font-bold">
                        {t("engineering.permissions.operationsApplied")}:
                      </span>{" "}
                      {(row.applied || []).join(", ") || "—"}
                    </p>
                    {(row.driftToAdd?.length > 0 || row.driftToRemove?.length > 0) && (
                      <p className="mt-0.5 text-[10px] leading-relaxed text-amber-400">
                        <span className="font-bold">
                          {t("engineering.permissions.operationsDrift")}:
                        </span>{" "}
                        {[
                          ...(row.driftToAdd || []).map((k) => `+${k}`),
                          ...(row.driftToRemove || []).map((k) => `−${k}`),
                        ].join(", ")}
                      </p>
                    )}
                    {row.wouldLose?.length > 0 && (
                      <p className="mt-0.5 text-[10px] leading-relaxed text-amber-400">
                        <span className="font-bold">
                          {t("engineering.permissions.operationsWouldLose")}:
                        </span>{" "}
                        {row.wouldLose.join(", ")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {readiness.truncated && (
              <p className="text-[10px] text-[var(--text-secondary)]">
                {t("engineering.permissions.operationsTruncated")}
              </p>
            )}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={confirmReconcile}
        title={t("engineering.permissions.operationsReconcileTitle")}
        body={t("engineering.permissions.operationsReconcileConfirm")}
        confirmLabel={{
          cancel: t("common.cancel"),
          run: t("engineering.permissions.operationsReconcileRun"),
        }}
        busy={running}
        onCancel={() => setConfirmReconcile(false)}
        onConfirm={() => {
          setConfirmReconcile(false);
          run("reconcile");
        }}
      />
    </div>
  );
}

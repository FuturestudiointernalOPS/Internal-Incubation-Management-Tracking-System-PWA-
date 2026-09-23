"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Target,
  Users,
  Scissors,
  AlertTriangle,
  UserPlus,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import AppButton from "@/components/ui/AppButton";
import AppModal from "@/components/ui/AppModal";
import AppBadge from "@/components/ui/AppBadge";
import AppEmptyState from "@/components/ui/AppEmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import PersonPicker from "./PersonPicker";
import ProgramScopeCoverage from "./ProgramScopeCoverage";
import ProgramPortfolioDefaultAction from "./ProgramPortfolioDefaultAction";
import { PERMISSION_BASE } from "./permissionNav";

/**
 * Toast via the app-wide listener (src/components/ui/GlobalToast.js). Kept
 * local, like OperationsView's, so this screen needs no cross-feature import.
 */
function notify(type, message) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("impactos:notify", { detail: { type, message } }),
  );
}

/**
 * The same compact result tile as OperationsView's `Stat` — the Operations
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
 * The capability the repair action needs. It is a programme change, not a
 * permissions-console write, so it is checked against `programs.edit` — shown
 * verbatim because it is the identifier an administrator has to ask for.
 */
const PROGRAM_EDIT_CAPABILITY = "programs.edit";

/**
 * PHASE UI-8b — Programme access (Permission Center › Operations).
 *
 * The third Operations panel, and the one that makes the programme
 * where-it-applies rule safe to switch on. Enforcing that rule is a REMOVAL:
 * today a person holding the programme-management capability reaches every
 * programme, and the rule would restrict them to the ones they are attached to.
 * Three things are only visible together:
 *
 *   1. UNMANAGED PROGRAMMES (the repair worklist)
 *      The rule matches a person to a programme through the manager
 *      relationship. A running programme with nobody recorded as its manager
 *      therefore matches NOBODY, so enforcing the rule before repairing the data
 *      would quietly make that programme unreachable to everyone except the
 *      portfolio identity. Each row here carries the repair: record a manager.
 *      That write needs `programs.edit`, so a permission administrator may
 *      legitimately be refused — the refusal is stated inline, naming the
 *      capability, rather than surfaced as a failure.
 *
 *   2. WHO THE RULE WOULD AFFECT
 *      Everyone on a template that grants programme management, with the running
 *      programmes they keep. The decision number is how many would keep NOTHING.
 *
 *   3. THE TEMPLATE SPLIT
 *      The seeded template bundles programme management with unrelated powers,
 *      so the rule cannot be narrowed inside it. `removals` names exactly what a
 *      trimmed portfolio template would stop granting; the trimmed template is
 *      already created and stays inert until the role default is repointed.
 *      The repoint itself is a click, not a migration, and it lives in its own
 *      block (./ProgramPortfolioDefaultAction): it reads what would be removed
 *      before it writes, and states what it removed after it wrote.
 *
 *   4. COVERAGE (./ProgramScopeCoverage)
 *      Where the rule does NOT reach. There is no switch to render: the rule is
 *      enforced on every wired write surface, unconditionally, so the only
 *      honest state left to publish is which surfaces still bypass it — and that
 *      is stated prominently, never as a footnote.
 *
 * Read-only until the administrator records a manager. The report is loaded on
 * demand — never on mount — because it is a portfolio-wide scan.
 */
export default function ProgramScopePanel() {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState(null);

  // ── Repair action state ──────────────────────────────────────────────────
  const [assignFor, setAssignFor] = useState(null);
  const [assignPerson, setAssignPerson] = useState(null);
  const [assignBusy, setAssignBusy] = useState(false);
  // { kind: "forbidden" | "failed", message }
  const [assignError, setAssignError] = useState(null);
  const [assignResult, setAssignResult] = useState(null);

  /**
   * Server errors arrive either as a locale key ("errors.insufficientPermissions")
   * or as a message; a key that resolves nowhere falls back to a local label so
   * this panel never shows a raw key.
   */
  function messageFor(raw, fallbackKey) {
    const value = typeof raw === "string" ? raw.trim() : "";
    if (!value) return t(fallbackKey);
    const translated = t(value);
    if (translated !== value) return translated;
    return value.includes(" ") ? value : t(fallbackKey);
  }

  /** Program status is data: translate it when a label exists, else show it. */
  function statusLabel(status) {
    if (!status) return "";
    const key = `status.${String(status).toLowerCase()}`;
    const value = t(key);
    return value === key ? String(status) : value;
  }

  /**
   * The reason a capability is misplaced comes from the report for the
   * template's actual rows. It is translated by capability so the line reads in
   * the active language, and an unmapped one falls back to the reported reason.
   */
  function whyLabel(removal) {
    const key = `engineering.permissions.programScopeWhy_${removal.module}_${removal.capability}`;
    const value = t(key);
    return value === key ? removal.why || "" : value;
  }

  async function load() {
    setBusy(true);
    try {
      const res = await fetch(
        "/api/engineering/permissions/program-scope-readiness",
        { headers: { "Content-Type": "application/json" } },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(
          messageFor(data.error, "engineering.permissions.programScopeFailed"),
        );
      }
      setReport(data);
    } catch (error) {
      notify(
        "error",
        error.message || t("engineering.permissions.programScopeFailed"),
      );
    } finally {
      setBusy(false);
    }
  }

  function openAssign(program) {
    setAssignFor(program);
    setAssignPerson(null);
    setAssignError(null);
    setAssignResult(null);
  }

  function closeAssign() {
    if (assignBusy) return;
    setAssignFor(null);
  }

  async function assignManager() {
    if (!assignFor || !assignPerson?.cid) return;
    setAssignBusy(true);
    setAssignError(null);
    try {
      const res = await fetch(
        `/api/pm/programs/${encodeURIComponent(assignFor.id)}/manager`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ manager_cid: assignPerson.cid }),
        },
      );
      const data = await res.json().catch(() => ({}));

      // A refusal is a legitimate answer here: recording a manager is a
      // programme write. State which capability is missing instead of
      // presenting a permission decision as a crash.
      if (res.status === 403) {
        setAssignError({
          kind: "forbidden",
          message: t("engineering.permissions.programScopeAssignForbidden", {
            capability: PROGRAM_EDIT_CAPABILITY,
          }),
        });
        return;
      }
      if (!res.ok || data.success === false) {
        setAssignError({
          kind: "failed",
          message: messageFor(
            data.error,
            "engineering.permissions.programScopeAssignFailed",
          ),
        });
        return;
      }

      setAssignResult(data);
      notify(
        "success",
        t("engineering.permissions.programScopeAssignDone", {
          program: assignFor.name || assignFor.id,
        }),
      );
      // The programme just left the worklist: re-read it so the counts and the
      // remaining rows are the truth after the repair.
      load();
    } catch (error) {
      setAssignError({
        kind: "failed",
        message:
          error.message || t("engineering.permissions.programScopeAssignFailed"),
      });
    } finally {
      setAssignBusy(false);
    }
  }

  const unmanaged = report?.unmanaged || [];
  const holders = report?.holders || [];
  const removals = report?.removals || [];
  const templates = report?.portfolioTemplates || [];

  /** Access applied / withdrawn by the reconcile that followed the write. */
  const reconciledRows = assignResult?.reconciled || [];
  const appliedCount = reconciledRows.reduce(
    (sum, row) => sum + (row.applied || []).length,
    0,
  );
  const withdrawnCount = reconciledRows.reduce(
    (sum, row) => sum + (row.revoked || []).length,
    0,
  );

  return (
    <section className="rounded-xl border border-[var(--border-primary)] bg-surface-1 p-4 space-y-3">
      <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-primary)]">
        <Target className="h-3.5 w-3.5 text-[var(--brand-orange)]" />
        {t("engineering.permissions.programScopeTitle")}
      </p>
      <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
        {t("engineering.permissions.programScopeBody")}
      </p>
      <AppButton
        variant="secondary"
        size="sm"
        icon={Target}
        loading={busy}
        onClick={load}
      >
        {t("engineering.permissions.programScopeLoad")}
      </AppButton>

      {busy && !report && (
        <div className="space-y-2 border-t border-[var(--border-primary)] pt-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      )}

      {report && (
        <div className="space-y-4 border-t border-[var(--border-primary)] pt-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat
              label={t("engineering.permissions.programScopeRunning")}
              value={report.summary?.runningPrograms ?? 0}
            />
            <Stat
              label={t("engineering.permissions.programScopeUnmanaged")}
              value={report.summary?.unmanaged ?? 0}
              tone={(report.summary?.unmanaged ?? 0) > 0 ? "warn" : "good"}
            />
            <Stat
              label={t("engineering.permissions.programScopePeople")}
              value={report.summary?.holders ?? 0}
            />
            <Stat
              label={t("engineering.permissions.programScopeLosesEverything")}
              value={report.summary?.losesEverything ?? 0}
              tone={(report.summary?.losesEverything ?? 0) > 0 ? "warn" : "good"}
            />
          </div>

          {/* ── 1. Unmanaged programmes — the repair worklist ─────────────── */}
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-primary)]">
              <UserPlus className="h-3 w-3 text-[var(--brand-orange)]" />
              {t("engineering.permissions.programScopeUnmanagedTitle")}
            </p>
            <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
              {t("engineering.permissions.programScopeUnmanagedBody")}
            </p>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat
                label={t(
                  "engineering.permissions.programScopeUnmanagedToRepair",
                )}
                value={unmanaged.length}
                tone={unmanaged.length > 0 ? "warn" : "good"}
              />
            </div>

            {unmanaged.length === 0 ? (
              <AppEmptyState
                size="sm"
                icon={CheckCircle2}
                title={t("engineering.permissions.programScopeUnmanagedEmpty")}
              />
            ) : (
              <div className="space-y-1.5">
                {unmanaged.map((profile) => (
                  <div
                    key={profile.id}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2"
                  >
                    <span className="text-xs font-bold text-[var(--text-primary)]">
                      {profile.name || profile.id}
                    </span>
                    {profile.status && (
                      <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                        {statusLabel(profile.status)}
                      </span>
                    )}
                    {profile.endDate && (
                      <span className="text-[10px] text-[var(--text-secondary)]">
                        {t("engineering.permissions.operationsEnds")} {profile.endDate}
                      </span>
                    )}
                    <span className="ml-auto">
                      <AppButton
                        variant="secondary"
                        size="sm"
                        icon={UserPlus}
                        onClick={() => openAssign(profile)}
                      >
                        {t("engineering.permissions.programScopeAssign")}
                      </AppButton>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── 2. Who the rule would affect ──────────────────────────────── */}
          <div className="space-y-2 border-t border-[var(--border-primary)] pt-3">
            <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-primary)]">
              <Users className="h-3 w-3 text-[var(--brand-orange)]" />
              {t("engineering.permissions.programScopeHoldersTitle")}
            </p>
            <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
              {t("engineering.permissions.programScopeHoldersBody")}
            </p>

            {holders.length === 0 ? (
              <AppEmptyState
                size="sm"
                icon={Users}
                title={t("engineering.permissions.programScopeHoldersEmpty")}
              />
            ) : (
              <div className="space-y-1.5">
                {holders.map((holder) => (
                  <div
                    key={holder.cid}
                    className={`rounded-lg border px-3 py-2 ${
                      holder.losesEverything
                        ? "border-amber-500/40 bg-amber-500/5"
                        : "border-[var(--border-primary)] bg-surface-2"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-[var(--text-primary)]">
                        {holder.name || holder.cid}
                      </span>
                      {holder.role && (
                        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                          {holder.role}
                        </span>
                      )}
                      <span className="text-[10px] text-[var(--text-secondary)]">
                        {holder.viaRole
                          ? t(
                              "engineering.permissions.programScopeProfileDefault",
                              {
                                profile: holder.profile || holder.profileId || "—",
                                role: holder.viaRole,
                              },
                            )
                          : t(
                              "engineering.permissions.programScopeProfileExplicit",
                              { profile: holder.profile || holder.profileId || "—" },
                            )}
                      </span>
                      {holder.losesEverything ? (
                        <AppBadge variant="warning">
                          {t(
                            "engineering.permissions.programScopeKeepsNone",
                          )}
                        </AppBadge>
                      ) : (
                        <AppBadge variant="default">
                          {t("engineering.permissions.programScopeKeeps", {
                            n: holder.keptCount ?? 0,
                          })}
                        </AppBadge>
                      )}
                    </div>
                    {(holder.keptPrograms || []).length > 0 && (
                      <p className="mt-1 text-[10px] leading-relaxed text-[var(--text-secondary)]">
                        <span className="font-bold">
                          {t("engineering.permissions.programScopeKeptIds")}:
                        </span>{" "}
                        {holder.keptPrograms.join(", ")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── 3. The template split ─────────────────────────────────────── */}
          <div className="space-y-2 border-t border-[var(--border-primary)] pt-3">
            <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-primary)]">
              <Scissors className="h-3 w-3 text-[var(--brand-orange)]" />
              {t("engineering.permissions.programScopeSplitTitle")}
            </p>
            <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
              {t("engineering.permissions.programScopeSplitBody")}
            </p>

            {removals.length === 0 ? (
              <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
                {t("engineering.permissions.programScopeRemovalsEmpty")}
              </p>
            ) : (
              <div className="space-y-1.5 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
                <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-400">
                  <AlertTriangle className="h-3 w-3" />
                  {t("engineering.permissions.programScopeRemovalsTitle")}
                </p>
                {removals.map((removal) => (
                  <div
                    key={`${removal.profileId}:${removal.module}.${removal.capability}`}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <span className="text-[11px] font-bold text-[var(--text-primary)]">
                      {removal.module}.{removal.capability}
                    </span>
                    <span className="text-[10px] text-[var(--text-secondary)]">
                      {whyLabel(removal)}
                    </span>
                    {removal.profile && (
                      <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                        {removal.profile}
                      </span>
                    )}
                    <span className="text-[10px] font-bold text-amber-400">
                      {t(
                        "engineering.permissions.programScopeRemovalHolders",
                        { n: removal.holders ?? 0 },
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
              {t("engineering.permissions.programScopeTemplatesTitle")}
            </p>
            {templates.length === 0 ? (
              <AppEmptyState
                size="sm"
                icon={Scissors}
                title={t("engineering.permissions.programScopeTemplatesEmpty")}
              />
            ) : (
              <div className="space-y-1.5">
                {templates.map((tpl) => (
                  <div
                    key={tpl.id}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border-primary)] bg-surface-2 px-3 py-2"
                  >
                    <span className="text-xs font-bold text-[var(--text-primary)]">
                      {tpl.name}
                    </span>
                    <AppBadge variant={tpl.isActive ? "success" : "default"}>
                      {tpl.isActive
                        ? t("engineering.permissions.programScopeTemplateActive")
                        : t(
                            "engineering.permissions.programScopeTemplateInactive",
                          )}
                    </AppBadge>
                    <span className="text-[10px] text-[var(--text-secondary)]">
                      {t(
                        "engineering.permissions.programScopeTemplateCaps",
                        { n: (tpl.capabilities || []).length },
                      )}
                    </span>
                    <span className="text-[10px] text-[var(--text-secondary)]">
                      {t(
                        "engineering.permissions.programScopeTemplateHolders",
                        { n: tpl.holders ?? 0 },
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-lg border border-[var(--border-primary)] bg-surface-2 px-3 py-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                {t("engineering.permissions.programScopeRepointTitle")}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-secondary)]">
                {t("engineering.permissions.programScopeRepointBody")}
              </p>
              <Link
                href={`${PERMISSION_BASE}/profiles`}
                className="mt-1.5 inline-flex items-center gap-1.5 rounded-sm text-[10px] font-black uppercase tracking-widest text-[var(--brand-orange)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]/60"
              >
                <ExternalLink className="h-3 w-3" />
                {t("engineering.permissions.programScopeRepointLink")}
              </Link>
            </div>

            {/* The deliberate click at the end of the walkthrough above. */}
            <ProgramPortfolioDefaultAction onRefresh={load} />
          </div>

          {/* ── 4. Coverage — where the rule does not reach ───────────────── */}
          <ProgramScopeCoverage report={report} />
        </div>
      )}

      {/* ── Repair action — record who manages the programme ──────────── */}
      <AppModal
        isOpen={!!assignFor}
        onClose={closeAssign}
        title={t("engineering.permissions.programScopeAssignTitle")}
        size="md"
      >
        <div className="space-y-3">
          <p className="text-xs font-bold text-[var(--text-primary)]">
            {assignFor?.name || assignFor?.id}
          </p>
          <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
            {t("engineering.permissions.programScopeAssignBody")}
          </p>

          {assignResult ? (
            <div className="space-y-2 rounded-lg border border-[var(--border-primary)] bg-surface-2 px-3 py-2">
              <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--brand-orange)]">
                <CheckCircle2 className="h-3 w-3" />
                {assignResult.unchanged
                  ? t("engineering.permissions.programScopeAssignUnchanged")
                  : t("engineering.permissions.programScopeAssignRecorded")}
              </p>
              <p className="text-[11px] text-[var(--text-primary)]">
                <span className="font-black uppercase tracking-widest text-[10px] text-[var(--text-secondary)]">
                  {t("engineering.permissions.programScopeAssignManager")}:
                </span>{" "}
                {assignPerson?.name || assignResult.manager?.cid || "—"}
                {assignResult.previous?.cid && (
                  <span className="text-[10px] text-[var(--text-secondary)]">
                    {" "}
                    · {t("engineering.permissions.programScopeAssignPrevious")}{" "}
                    {assignResult.previous.cid}
                  </span>
                )}
              </p>
              {!assignResult.unchanged && (
                <>
                  <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                    {t("engineering.permissions.programScopeAssignReconciled")} ·
                    +{appliedCount} / −{withdrawnCount}
                  </p>
                  {reconciledRows.length === 0 ? (
                    <p className="text-[10px] leading-relaxed text-[var(--text-secondary)]">
                      {t(
                        "engineering.permissions.programScopeAssignNoChanges",
                      )}
                    </p>
                  ) : (
                    <div className="space-y-0.5">
                      {reconciledRows.map((row) => {
                        const changes = [
                          ...(row.applied || []).map((capability) => `+${capability}`),
                          ...(row.revoked || []).map((capability) => `−${capability}`),
                        ];
                        return (
                          <p
                            key={row.cid}
                            className="text-[10px] leading-relaxed text-[var(--text-secondary)]"
                          >
                            <span className="font-bold text-[var(--text-primary)]">
                              {String(row.cid) === String(assignPerson?.cid)
                                ? assignPerson?.name || row.cid
                                : row.cid}
                              :
                            </span>{" "}
                            {changes.join(", ") || "—"}
                          </p>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
              <div className="flex justify-end">
                <AppButton variant="secondary" size="sm" onClick={closeAssign}>
                  {t("common.close")}
                </AppButton>
              </div>
            </div>
          ) : (
            <>
              <PersonPicker
                selectedCid={assignPerson?.cid || null}
                onSelect={setAssignPerson}
              />

              {assignError && (
                <div className="space-y-1 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
                  <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-400">
                    <AlertTriangle className="h-3 w-3" />
                    {assignError.kind === "forbidden"
                      ? t(
                          "engineering.permissions.programScopeAssignForbiddenTitle",
                        )
                      : t(
                          "engineering.permissions.programScopeAssignFailedTitle",
                        )}
                  </p>
                  <p className="text-[10px] leading-relaxed text-[var(--text-secondary)]">
                    {assignError.message}
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <AppButton
                  variant="secondary"
                  onClick={closeAssign}
                  disabled={assignBusy}
                >
                  {t("common.cancel")}
                </AppButton>
                <AppButton
                  variant="primary"
                  icon={UserPlus}
                  loading={assignBusy}
                  disabled={!assignPerson}
                  onClick={assignManager}
                >
                  {t("engineering.permissions.programScopeAssignConfirm")}
                </AppButton>
              </div>
            </>
          )}
        </div>
      </AppModal>
    </section>
  );
}

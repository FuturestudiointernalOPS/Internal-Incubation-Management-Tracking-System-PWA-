"use client";

import { useState } from "react";
import { Target } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import AppButton from "@/components/ui/AppButton";
import { Skeleton } from "@/components/ui/Skeleton";
import ProgramScopeCoverage from "./ProgramScopeCoverage";
import { notify } from "./program-scope-panel/notify";
import { messageFor } from "./program-scope-panel/labels";
import ScopeSummaryStats from "./program-scope-panel/ScopeSummaryStats";
import UnmanagedWorklist from "./program-scope-panel/UnmanagedWorklist";
import HoldersPanel from "./program-scope-panel/HoldersPanel";
import TemplateSplitPanel from "./program-scope-panel/TemplateSplitPanel";
import AssignManagerModal from "./program-scope-panel/AssignManagerModal";

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
 * demand — never on mount — because it is a portfolio-wide scan. The report
 * blocks live under ./program-scope-panel/; this panel owns the loads and the
 * repair write.
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
          messageFor(t, data.error, "engineering.permissions.programScopeFailed"),
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
            t,
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
          <ScopeSummaryStats t={t} summary={report.summary} />

          {/* ── 1. Unmanaged programmes — the repair worklist ─────────────── */}
          <UnmanagedWorklist t={t} unmanaged={unmanaged} onAssign={openAssign} />

          {/* ── 2. Who the rule would affect ──────────────────────────────── */}
          <HoldersPanel t={t} holders={holders} />

          {/* ── 3. The template split ─────────────────────────────────────── */}
          <TemplateSplitPanel
            t={t}
            removals={removals}
            templates={templates}
            onRefresh={load}
          />

          {/* ── 4. Coverage — where the rule does not reach ───────────────── */}
          <ProgramScopeCoverage report={report} />
        </div>
      )}

      {/* ── Repair action — record who manages the programme ──────────── */}
      <AssignManagerModal
        t={t}
        assignFor={assignFor}
        assignPerson={assignPerson}
        onSelectPerson={setAssignPerson}
        assignBusy={assignBusy}
        assignError={assignError}
        assignResult={assignResult}
        onClose={closeAssign}
        onConfirm={assignManager}
      />
    </section>
  );
}

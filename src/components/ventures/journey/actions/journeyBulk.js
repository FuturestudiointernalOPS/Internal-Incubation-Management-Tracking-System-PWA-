/**
 * Selection, bulk actions and the in-app confirmation
 *
 * The derived selectors (active, archived, visible), the selection itself,
 * the bulk archive/restore/delete requests, and the confirmed action the in-app
 * dialog runs — `runConfirmedAction` is the one place that dispatches on what the
 * user confirmed.
 *
 * Cut out of src/components/ventures/JourneyManagerPanel.js as-is: no state of
 * its own, no reads. The panel keeps every state value and every read, and hands
 * this factory what it reads through `values` — plus what the factories above
 * it return. The names it need are listed in the signature — nothing else.
 */

import {
  ChevronUp,
  ChevronDown,
  Trash2,
  CopyPlus,
  Archive,
  RotateCcw,
  Pencil,
  Lock,
  Play,
} from "lucide-react";

export function journeySelection({
  stages,
  viewArchived,
  selectedStageIds,
  setSelectedStageIds,
  setBulkBusy,
  ventureId,
  t,
  notify,
  setStages,
  setConfirmState,
  patch,
  access,
  startEdit,
  duplicatingStageId,
  duplicateStage,
  bulkBusy,
  confirmState,
  patchMilestone,
  refreshJourney,
  openReportComposer,
  setMilestoneBusy,
}) {
  // ── Journey archive / permanent delete (double-confirmed) ────────────────
  const activeStages = stages.filter((stage) => stage.is_archived !== true);
  const archivedStages = stages.filter((stage) => stage.is_archived === true);
  const visibleStages = viewArchived ? archivedStages : activeStages;
  const allSelected =
    activeStages.length > 0 && activeStages.every((stage) => selectedStageIds.has(String(stage.id)));

  const toggleSelectStage = (id) => {
    const next = new Set(selectedStageIds);
    const key = String(id);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelectedStageIds(next);
  };
  const toggleSelectAllStages = () => {
    if (allSelected) setSelectedStageIds(new Set());
    else setSelectedStageIds(new Set(activeStages.map((stage) => String(stage.id))));
  };

  const runBulk = async ({ ids, action = "archive", endpoint }) => {
    if (!ids.length) return;
    setBulkBusy(true);
    try {
      const res = await fetch(`/api/ventures/${ventureId}/journey/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action }),
      });
      const payload = await res.json();
      if (payload.success) {
        const done =
          endpoint === "delete"
            ? payload.deleted || []
            : action === "restore"
              ? payload.restored || []
              : payload.archived || [];
        const blocked = payload.blocked || [];
        const parts = [];
        if (done.length) {
          parts.push(
            endpoint === "delete"
              ? t("venture.manager.journeysDeleted", { n: done.length })
              : action === "restore"
                ? t("venture.manager.journeysRestored", { n: done.length })
                : t("venture.manager.journeysArchived", { n: done.length }),
          );
        }
        if (blocked.length) parts.push(blocked[0]?.reason || t("venture.manager.journeysBlocked", { n: blocked.length }));
        notify(parts.join(" — ") || t("venture.manager.journeysArchived", { n: 0 }), blocked.length && !done.length ? "error" : "success");
        if (payload.stages) setStages(payload.stages);
      } else {
        notify(payload.error || t("venture.manager.actionFailed"), "error");
      }
    } catch (_) {
      notify(t("venture.manager.actionFailed"), "error");
    }
    setSelectedStageIds(new Set());
    setBulkBusy(false);
  };

  // Destructive journey actions always go through an in-app confirmation
  // modal. Archive/delete need TWO explicit steps; restore needs one.
  const selectedActiveIds = () =>
    activeStages.filter((stage) => selectedStageIds.has(String(stage.id))).map((stage) => String(stage.id));

  const askArchiveSelected = () => {
    const ids = selectedActiveIds();
    if (ids.length) setConfirmState({ kind: "archive", ids, n: ids.length, step: 1 });
  };

  const askDeleteSelected = () => {
    const ids = selectedActiveIds();
    if (ids.length) setConfirmState({ kind: "delete", ids, n: ids.length, step: 1 });
  };

  const archiveOneJourney = (stage) =>
    setConfirmState({ kind: "archive", ids: [String(stage.id)], n: 1, name: stage.name, step: 1 });
  const restoreOneJourney = (stage) =>
    setConfirmState({ kind: "restore", ids: [String(stage.id)], n: 1, name: stage.name, step: 1 });
  const deleteOneJourney = (stage) =>
    setConfirmState({ kind: "delete", ids: [String(stage.id)], n: 1, name: stage.name, step: 1 });

  const journeyMenuItems = (stage, index) => [
    stage.status === "upcoming" && {
      key: "activate", label: t("venture.manager.activateStage"), icon: Play,
      onSelect: () => patch({ action: "activate", stage_id: stage.id }),
    },
    stage.status === "active" && {
      key: "lock", label: t("venture.manager.lockStage"), icon: Lock,
      onSelect: () => patch({ action: "lock", stage_id: stage.id }),
    },
    stage.status === "completed" && {
      key: "reset", label: t("venture.manager.reopenStage"), icon: RotateCcw,
      onSelect: () => patch({ action: "reset", stage_id: stage.id }),
    },
    { separator: true },
    { key: "edit", label: t("venture.manager.editStage"), icon: Pencil, disabled: !access.edit, onSelect: () => startEdit(stage) },
    { key: "up", label: t("venture.manager.moveUp"), icon: ChevronUp, disabled: !access.manage || index === 0, onSelect: () => patch({ action: "move", stage_id: stage.id, direction: "up" }) },
    { key: "down", label: t("venture.manager.moveDown"), icon: ChevronDown, disabled: !access.manage || index === visibleStages.length - 1, onSelect: () => patch({ action: "move", stage_id: stage.id, direction: "down" }) },
    { key: "duplicate", label: t("venture.manager.duplicateStageTitle"), icon: CopyPlus, disabled: !access.manage || duplicatingStageId === stage.id, onSelect: () => duplicateStage(stage) },
    { separator: true },
    { key: "archive", label: t("venture.manager.archiveJourney"), icon: Archive, disabled: !access.manage, onSelect: () => archiveOneJourney(stage) },
    // Permanent deletion is Super Admin only (access.delete): a Lead Manager
    // archives; they never destroy.
    { key: "delete", label: t("venture.manager.deleteJourney"), icon: Trash2, danger: true, disabled: !access.delete, onSelect: () => deleteOneJourney(stage) },
  ].filter(Boolean);

  const confirmBusy = bulkBusy;

  const runConfirmedAction = async () => {
    if (!confirmState) return;
    const { kind, ids, step } = confirmState;

    // Milestone actions are single-step in-app confirmations.
    if (kind === "milestone-complete") {
      setConfirmState(null);
      const ok = await patchMilestone(ids[0], { status: "completed" });
      if (ok) {
        notify(t("venture.manager.milestoneCompleted"));
        await refreshJourney();
        // Completing the LAST milestone of a journey closes it, and a closed
        // journey is owed a report. The composer opens on that journey and the
        // manager can simply dismiss it — that is what keeps the automatic close
        // intact: the report is prompted, never required.
        if (ok.journey_completed && ok.journey?.id) {
          const closed = stages.find((stage) => String(stage.id) === String(ok.journey.id));
          const name = ok.journey.name || closed?.name || "";
          openReportComposer({ id: ok.journey.id, name }, "closing");
          notify(t("venture.manager.journeyClosedWriteReport", { name }));
        }
      }
      return;
    }
    if (kind === "milestone-archive") {
      setConfirmState(null);
      setMilestoneBusy(ids[0]);
      try {
        const res = await fetch(`/api/ventures/${ventureId}/milestones/archive`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids, action: "archive" }),
        });
        const payload = await res.json();
        if (payload.success) {
          const archived = payload.archived || [];
          const blocked = payload.blocked || [];
          const parts = [];
          if (archived.length) parts.push(t("venture.manager.milestoneArchived"));
          if (blocked.length) parts.push(blocked[0]?.reason || t("venture.manager.actionFailed"));
          notify(parts.join(" — ") || t("venture.manager.milestoneArchived"), blocked.length && !archived.length ? "error" : "success");
          await refreshJourney();
        } else {
          notify(payload.error || t("venture.manager.actionFailed"), "error");
        }
      } catch (_) {
        notify(t("venture.manager.actionFailed"), "error");
      } finally {
        setMilestoneBusy(null);
      }
      return;
    }

    // Archive/delete: step 1 → step 2 → execute. Restore executes at step 1.
    if ((kind === "archive" || kind === "delete") && step === 1) {
      setConfirmState({ ...confirmState, step: 2 });
      return;
    }
    setConfirmState(null);
    if (kind === "restore") await runBulk({ ids, action: "restore", endpoint: "archive" });
    else if (kind === "archive") await runBulk({ ids, action: "archive", endpoint: "archive" });
    else await runBulk({ ids, endpoint: "delete" });
  };

  return {
    activeStages,
    archivedStages,
    visibleStages,
    allSelected,
    toggleSelectStage,
    toggleSelectAllStages,
    runBulk,
    selectedActiveIds,
    askArchiveSelected,
    askDeleteSelected,
    archiveOneJourney,
    restoreOneJourney,
    deleteOneJourney,
    journeyMenuItems,
    confirmBusy,
    runConfirmedAction,
  };
}

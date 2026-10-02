"use client";

import { UserPlus, CheckCircle2, AlertTriangle } from "lucide-react";
import AppButton from "@/components/ui/AppButton";
import AppModal from "@/components/ui/AppModal";
import PersonPicker from "../PersonPicker";

/**
 * The repair action — record who manages the programme.
 *
 * A refusal is a legitimate answer here: recording a manager is a programme
 * write, so a permission administrator may be refused `programs.edit`. The
 * refusal is stated inline, and the reconcile that followed the write is
 * reported (what access was applied / withdrawn) before the modal is closed.
 */
export default function AssignManagerModal({
  t,
  assignFor,
  assignPerson,
  onSelectPerson,
  assignBusy,
  assignError,
  assignResult,
  onClose,
  onConfirm,
}) {
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
    <AppModal
      isOpen={!!assignFor}
      onClose={onClose}
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
              <AppButton variant="secondary" size="sm" onClick={onClose}>
                {t("common.close")}
              </AppButton>
            </div>
          </div>
        ) : (
          <>
            <PersonPicker
              selectedCid={assignPerson?.cid || null}
              onSelect={onSelectPerson}
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
                onClick={onClose}
                disabled={assignBusy}
              >
                {t("common.cancel")}
              </AppButton>
              <AppButton
                variant="primary"
                icon={UserPlus}
                loading={assignBusy}
                disabled={!assignPerson}
                onClick={onConfirm}
              >
                {t("engineering.permissions.programScopeAssignConfirm")}
              </AppButton>
            </div>
          </>
        )}
      </div>
    </AppModal>
  );
}

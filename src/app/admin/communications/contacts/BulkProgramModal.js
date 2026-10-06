"use client";

import { X } from "lucide-react";

export function BulkProgramModal({
  t,
  contacts,
  programs,
  bulkSelected,
  setBulkSelected,
  isProcessing,
  setIsProcessing,
  setNotification,
  setShowBulkProgramModal,
  refreshAll,
}) {
  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
      <div className="card w-full max-w-2xl space-y-6 border-brand-orange/30 max-h-[85vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold uppercase">
            {t("crm.contacts.bulkProgramAssignment")}
          </h3>
          <button
            onClick={() => {
              setShowBulkProgramModal(false);
              setBulkSelected([]);
            }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Program Selector */}
          <select
            id="bulk-program-select"
            className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 text-xs font-bold outline-none focus:border-[var(--brand-orange)]"
            defaultValue=""
          >
            <option value="" disabled>
              {t("crm.contacts.selectProgram")}
            </option>
            {programs.map((program) => (
              <option key={program.id} value={program.id}>
                {program.name}
              </option>
            ))}
          </select>

          {/* Action Type */}
          <div className="flex gap-2">
            <button
              id="bulk-action-add"
              className="flex-1 py-2 rounded-lg bg-brand-orange/10 border border-brand-orange/30 text-[var(--brand-orange)] text-[10px] font-black uppercase tracking-wider"
            >
              {t("crm.contacts.addToProgram")}
            </button>
            <button
              id="bulk-action-remove"
              className="flex-1 py-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-500 text-[10px] font-black uppercase tracking-wider"
            >
              {t("crm.contacts.removeFromProgram")}
            </button>
          </div>

          {/* Select All / Clear */}
          <div className="flex items-center justify-between border-b border-[var(--border-primary)] pb-2">
            <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              {t("crm.contacts.selectParticipants", {
                count: bulkSelected.length,
              })}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const participants = contacts.filter(
                    (contact) =>
                      contact.is_participant === true ||
                      contact.role === "participant",
                  );
                  setBulkSelected(
                    participants.map((contact) => contact.cid || contact.id).filter(Boolean),
                  );
                }}
                className="text-[10px] font-bold text-blue-400 uppercase tracking-wide hover:underline"
              >
                {t("crm.contacts.selectAll")}
              </button>
              <button
                onClick={() => setBulkSelected([])}
                className="text-[10px] font-bold text-rose-400 uppercase tracking-wide hover:underline"
              >
                {t("crm.contacts.clear")}
              </button>
            </div>
          </div>

          {/* Participant List */}
          <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
            {contacts
              .filter(
                (contact) =>
                  contact.is_participant === true ||
                  contact.role === "participant" ||
                  contact.role === "unassigned",
              )
              .map((contact) => {
                const cid = contact.cid || contact.id;
                const isSelected = bulkSelected.includes(cid);
                return (
                  <button
                    key={cid}
                    type="button"
                    onClick={() => {
                      setBulkSelected((prev) =>
                        isSelected
                          ? prev.filter((id) => id !== cid)
                          : [...prev, cid],
                      );
                    }}
                    className={`flex items-center gap-2 p-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all text-left ${
                      isSelected
                        ? "bg-brand-orange/10 border border-brand-orange/30 text-[var(--brand-orange)]"
                        : "bg-tertiary border border-transparent text-[var(--text-secondary)] hover:border-[var(--border-primary)]"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                        isSelected
                          ? "bg-[var(--brand-orange)] border-[var(--brand-orange)]"
                          : "border-[var(--border-primary)]"
                      }`}
                    >
                      {isSelected && (
                        <span className="text-[10px] text-black font-black">
                          ✓
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate">{contact.name || t("crm.contacts.unknown")}</p>
                      <p className="text-[10px] opacity-50 truncate">
                        {contact.email || cid}
                      </p>
                    </div>
                  </button>
                );
              })}
            {contacts.filter(
              (contact) =>
                contact.is_participant === true ||
                contact.role === "participant" ||
                contact.role === "unassigned",
            ).length === 0 && (
              <p className="text-sm text-[var(--text-secondary)] col-span-2 py-8 text-center">
                {t("crm.contacts.noParticipantsFound")}
              </p>
            )}
          </div>

          {/* Apply Button */}
          <button
            onClick={async () => {
              const programId = document.getElementById(
                "bulk-program-select",
              ).value;
              const _actionEl = document.querySelector(
                "#bulk-action-add.bg-[var(--brand-orange)/10]",
              );
              if (!programId || !bulkSelected.length) return;
              setIsProcessing(true);
              try {
                const response = await fetch("/api/participant-programs/bulk", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    participant_ids: bulkSelected,
                    program_id: programId,
                    action: "add",
                    assigned_by: "sa",
                    source: "bulk_assignment",
                  }),
                });
                const payload = await response.json();
                if (payload.success) {
                  setNotification({
                    type: "success",
                    message: t("crm.contacts.updated"),
                  });
                  setShowBulkProgramModal(false);
                  setBulkSelected([]);
                  refreshAll();
                }
              } catch {
                setNotification({
                  type: "error",
                  message: t("crm.contacts.bulkAssignmentFailed"),
                });
              } finally {
                setIsProcessing(false);
                setTimeout(() => setNotification(null), 3000);
              }
            }}
            disabled={isProcessing || !bulkSelected.length}
            className="w-full py-4 rounded-xl bg-[var(--brand-orange)] text-black text-[11px] font-black uppercase tracking-wider disabled:opacity-50 hover:brightness-110 transition-all"
          >
            {isProcessing
              ? t("crm.contacts.processing")
              : t("crm.contacts.assignToProgram", {
                  count: bulkSelected.length,
                })}
          </button>
        </div>
      </div>
    </div>
  );
}

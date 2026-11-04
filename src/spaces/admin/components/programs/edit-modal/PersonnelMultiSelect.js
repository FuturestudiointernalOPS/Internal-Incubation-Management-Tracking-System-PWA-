"use client";

/**
 * Staff / Personnel multi-select.
 *
 * Toggles assistant assignments on the program being edited. The stored value
 * is a comma-separated list, but older records hold a JSON array, so both
 * shapes are read before writing the flat list back.
 */

export default function PersonnelMultiSelect({
  t,
  teams,
  editingProgram,
  setEditingProgram,
}) {
  return (
    <>
<div className="space-y-3">
  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">
    {t?.("admin.programPersonnel") || "PROGRAM PERSONNEL (STAFF)"}
  </label>
  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] ml-2">
    {t("adminMisc.programs.staffAssistHint", {
      manager: t("admin.selectManager"),
    })}
  </p>
  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto p-3 bg-primary rounded-2xl border border-[var(--border-primary)]">
    {(Array.isArray(teams) ? teams : [])
      .filter(
        (m) =>
          m &&
          (m.cid || m.id) !== editingProgram?.assigned_pm_id,
      )
      .map((member) => {
        if (!member) return null;
        const memberId = member.cid || member.id;
        let assistantIds = [];
        if (typeof editingProgram?.assigned_assistant_id === "string") {
          try {
            const parsed = JSON.parse(
              editingProgram.assigned_assistant_id,
            );
            assistantIds = Array.isArray(parsed)
              ? parsed
              : editingProgram.assigned_assistant_id
                  .split(",")
                  .filter(Boolean);
          } catch {
            assistantIds = editingProgram.assigned_assistant_id
              .split(",")
              .filter(Boolean);
          }
        } else if (
          Array.isArray(editingProgram?.assigned_assistant_id)
        ) {
          assistantIds = editingProgram.assigned_assistant_id;
        }
        const isActive = assistantIds.includes(memberId);
        return (
          <button
            key={memberId}
            type="button"
            onClick={() => {
              const next = isActive
                ? assistantIds.filter((id) => id !== memberId)
                : [...assistantIds, memberId];
              setEditingProgram({
                ...editingProgram,
                assigned_assistant_id: next.join(","),
              });
            }}
            className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
              isActive
                ? "bg-brand-orange/10 border-[var(--brand-orange)] text-[var(--brand-orange)]"
                : "bg-secondary border-[var(--border-primary)] text-[var(--text-secondary)]"
            }`}
          >
            <div
              className={`w-6 h-6 rounded bg-primary border border-[var(--border-primary)] flex items-center justify-center text-[10px] font-bold ${isActive ? "text-[var(--brand-orange)] border-brand-orange/30" : ""}`}
            >
              {member.name?.charAt(0) || "?"}
            </div>
            <span className="text-[10px] font-bold uppercase truncate">
              {member.name ||
                member.email ||
                member.cid ||
                t("adminMisc.programs.unknown")}
            </span>
          </button>
        );
      })}
  </div>
</div>
    </>
  );
}

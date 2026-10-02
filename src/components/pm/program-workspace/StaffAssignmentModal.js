import { useI18n } from "@/lib/i18n";
import { X } from "lucide-react";

export default function StaffAssignmentModal({
  isSaving,
  newStaff,
  onAssignStaff,
  onCloseStaffModal,
  onNewStaffChange,
  onRoleChange,
  staffList,
}) {
  const { t } = useI18n();

  return (
    <div
      className="fixed inset-0 z-[400] bg-black/40 flex items-center justify-center p-6"
      onClick={() => onCloseStaffModal()}
    >
      <div
        className="card w-full max-w-sm space-y-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-between items-center">
          <h3
            className="text-base font-black uppercase tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            {t("pmMisc.workspace.assignPersonnel")}
          </h3>
          <button onClick={() => onCloseStaffModal()}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-4">
          <div className="space-y-1">
            <label
              className="text-[10px] font-black uppercase tracking-widest"
              style={{ color: "var(--text-secondary)" }}
            >
              {t("pmMisc.workspace.selectStaffMember")}
            </label>
            <select
              value={newStaff.staff_id}
              onChange={(event) =>
                onNewStaffChange((prev) => ({
                  ...prev,
                  staff_id: event.target.value,
                }))
              }
              className="w-full rounded-lg px-4 py-3 text-sm outline-none font-bold"
              style={{
                background: "var(--bg-primary)",
                border: "1px solid var(--border-primary)",
                color: "var(--text-primary)",
              }}
            >
              <option value="">{t("pmMisc.workspace.selectMember")}</option>
              {staffList
                .filter((member) => member.role !== "super_admin")
                .map((member) => (
                  <option key={member.cid} value={member.cid}>
                    {member.name} ({member.role})
                  </option>
                ))}
            </select>
          </div>
          <div className="space-y-1">
            <label
              className="text-[10px] font-black uppercase tracking-widest"
              style={{ color: "var(--text-secondary)" }}
            >
              {t("pmMisc.workspace.assignedRole")}
            </label>
            <select
              value={newStaff.role}
              onChange={(event) =>
                onRoleChange((prev) => ({ ...prev, role: event.target.value }))
              }
              className="w-full rounded-lg px-4 py-3 text-sm outline-none font-bold"
              style={{
                background: "var(--bg-primary)",
                border: "1px solid var(--border-primary)",
                color: "var(--text-primary)",
              }}
            >
              <option value="staff">
                {t("pmMisc.workspace.roleStaffMember")}
              </option>
              <option value="assistant">
                {t("pmMisc.workspace.roleAssistant")}
              </option>
              <option value="evaluator">
                {t("pmMisc.workspace.roleEvaluator")}
              </option>
              <option value="handler">
                {t("pmMisc.workspace.roleHandler")}
              </option>
            </select>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => onCloseStaffModal()}
            className="flex-1 btn btn-secondary"
          >
            {t("pmMisc.workspace.cancel")}
          </button>
          <button
            onClick={onAssignStaff}
            disabled={isSaving || !newStaff.staff_id}
            className="flex-1 btn btn-primary"
          >
            {isSaving
              ? t("pmMisc.workspace.assigning")
              : t("pmMisc.workspace.assign")}
          </button>
        </div>
      </div>
    </div>
  );
}

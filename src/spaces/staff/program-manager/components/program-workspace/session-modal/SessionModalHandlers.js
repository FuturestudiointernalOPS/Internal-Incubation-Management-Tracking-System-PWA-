"use client";

import { useI18n } from "@/lib/i18n";

export default function SessionModalHandlers({
  t,
  newSession,
  programTeamMembers,
  onToggleSessionStaff,
}) {
  return (
    <div className="space-y-1">
      <label
        className="text-[10px] font-black uppercase tracking-widest"
        style={{ color: "var(--text-secondary)" }}
      >
        {t("pmMisc.workspace.assignHandlers")}
      </label>
      <div className="grid grid-cols-2 gap-1.5 max-h-[120px] overflow-y-auto p-1 custom-scrollbar">
        {programTeamMembers.map((staff) => {
          const isSelected = (newSession.handler_ids || []).includes(
            String(staff.cid),
          );
          return (
            <button
              key={staff.cid}
              type="button"
              onClick={() => onToggleSessionStaff(staff)}
              className={`flex items-center gap-2 p-2 rounded-lg border text-[11px] font-bold transition-all text-left ${
                isSelected
                  ? "bg-[#FF6600]/10 border-[#FF6600] text-white"
                  : "bg-black/20 border-white/5 text-slate-400 hover:border-white/20"
              }`}
            >
              <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-[7px]">
                {staff.name?.charAt(0)}
              </div>
              <span className="truncate">{staff.name}</span>
            </button>
          );
        })}
        {programTeamMembers.length === 0 && (
          <p className="text-[10px] text-slate-600 italic col-span-full px-2">
            {t("pmMisc.workspace.noStaffAssignedHint")}
          </p>
        )}
      </div>
    </div>
  );
}
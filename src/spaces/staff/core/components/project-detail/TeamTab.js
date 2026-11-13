"use client";

import { Users } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { MEMBER_ROLE_LABELS } from "./constants";

/**
 * The team tab: the project's members with their role badge.
 * Extracted verbatim from StaffProjectDetail.
 */
export default function TeamTab({ members }) {
  const { t } = useI18n();
  return (
    <div className="space-y-2">
      {members.length === 0 ? (
        <div className="card py-16 flex flex-col items-center justify-center text-center opacity-50">
          <Users className="w-12 h-12 mb-3" />
          <p className="text-[10px] font-bold uppercase tracking-widest">
            {t("staffMisc.projectDetail.noTeamMembers")}
          </p>
        </div>
      ) : (
        members.map((member, index) => (
          <div key={index} className="card flex items-center gap-3 p-4">
            <div className="w-8 h-8 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border-primary)] flex items-center justify-center text-[10px] font-bold uppercase text-[var(--text-primary)]">
              {(member.name || "?").charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <p className="text-[11px] font-bold text-[var(--text-primary)]">
                {member.name || member.member_id || t("staffMisc.projectDetail.unknown")}
              </p>
              {member.email && (
                <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                  {member.email}
                </p>
              )}
            </div>
            <span
              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${member.member_role === "lead" ? "bg-brand-orange/10 text-[var(--brand-orange)]" : "bg-slate-500/10 text-slate-500"}`}
            >
              {t(
                MEMBER_ROLE_LABELS[member.member_role] ||
                  member.member_role ||
                  "staffMisc.projectDetail.roleMember",
              )}
            </span>
          </div>
        ))
      )}
    </div>
  );
}

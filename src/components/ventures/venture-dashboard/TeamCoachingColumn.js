"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { Users, BookOpen, Crown, Ban } from "lucide-react";
import WidgetCard from "./WidgetCard";

/**
 * Column 2 of the metrics row: the Venture's team and its coaching/advisors.
 * Extracted verbatim from VentureDashboard.
 */
export default function TeamCoachingColumn({ id, data, widgetState, refreshWidget }) {
  const router = useRouter();
  const { t } = useI18n();
  return (
    <div className="space-y-6">
      {/* 4. Team — the Venture's people (membership), founder included.
          The founder invitation ledger is a separate screen, reached from
          the button below, and is never what a head count is read from. */}
      <WidgetCard title={t("vadmin.dashboard.team")} icon={Users} iconColor="bg-blue-500/10"
        loading={widgetState("team").loading} error={widgetState("team").error}
        empty={widgetState("team").empty} emptyMessage={t("vadmin.dashboard.noTeamMembersYet")}
        onRefresh={() => refreshWidget("team")}
      >
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2 bg-tertiary rounded-lg text-center">
              <p className="text-lg font-black text-[var(--text-primary)]">{data.team?.active || 0}</p>
              <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">{t("vadmin.dashboard.active")}</p>
            </div>
            <div className="p-2 bg-tertiary rounded-lg text-center">
              <p className="text-lg font-black text-blue-400">{data.team?.founders || 0}</p>
              <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">{t("vadmin.dashboard.foundersCount")}</p>
            </div>
            <div className="p-2 bg-tertiary rounded-lg text-center">
              <p className="text-lg font-black text-rose-400">{data.team?.suspended || 0}</p>
              <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">{t("vadmin.dashboard.suspended")}</p>
            </div>
          </div>
          {data.team?.owner && (
            <p className="text-[10px] text-[var(--text-secondary)]">
              {t("vadmin.dashboard.owner", { name: data.team.owner.name || data.team.owner.email || "—" })}
            </p>
          )}
          <div className="space-y-1.5">
            {(data.team?.members || []).slice(0, 4).map((member) => (
              <div key={member.id} className="flex items-center justify-between p-2 bg-tertiary rounded-lg">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-full bg-primary border border-[var(--border-primary)] flex items-center justify-center text-[10px] font-bold shrink-0">
                    {(member.name || member.email || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-[var(--text-primary)] truncate">{member.name || member.email}</p>
                    <p className="text-[10px] text-[var(--text-secondary)] truncate">{member.is_founder ? t("vadmin.dashboard.founderBadge") : t("vadmin.dashboard.teamMemberBadge")}</p>
                  </div>
                </div>
                {member.is_owner && <Crown className="w-3 h-3 text-amber-400 shrink-0" />}
                {member.status === "suspended" && <Ban className="w-3 h-3 text-rose-400 shrink-0" />}
              </div>
            ))}
          </div>
          <button onClick={() => router.push(`/admin/ventures/${id}/founders`)} className="w-full py-2 bg-blue-500/10 text-blue-400 rounded-xl text-[10px] font-bold uppercase tracking-wider hover:brightness-110 transition-all">
            {t("vadmin.dashboard.manageTeam")}
          </button>
        </div>
      </WidgetCard>

      {/* 6. Coaching / Advisors */}
      <WidgetCard title={t("vadmin.dashboard.coachingAndAdvisors")} icon={BookOpen} iconColor="bg-indigo-500/10"
        loading={widgetState("coaching").loading} error={widgetState("coaching").error}
        empty={widgetState("coaching").empty} emptyMessage={t("vadmin.dashboard.noCoachesOrAdvisors")}
        onRefresh={() => refreshWidget("coaching")}
      >
        <div className="space-y-3">
          {(data.coaching?.coaches || []).length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">{t("vadmin.dashboard.coaches")}</p>
              {data.coaching.coaches.slice(0, 3).map((coach, index) => (
                <div key={coach.cid || index} className="flex items-center gap-2 p-1.5">
                  <div className="w-5 h-5 rounded-full bg-primary border border-[var(--border-primary)] flex items-center justify-center text-[10px] font-bold">{coach.name?.charAt(0)}</div>
                  <span className="text-[10px] font-bold text-[var(--text-primary)]">{coach.name}</span>
                </div>
              ))}
            </div>
          )}
          {(data.coaching?.advisors || []).length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">{t("vadmin.dashboard.advisors")}</p>
              {data.coaching.advisors.slice(0, 3).map((advisor, index) => (
                <div key={advisor.cid || index} className="flex items-center gap-2 p-1.5">
                  <div className="w-5 h-5 rounded-full bg-primary border border-[var(--border-primary)] flex items-center justify-center text-[10px] font-bold">{advisor.name?.charAt(0)}</div>
                  <span className="text-[10px] font-bold text-[var(--text-primary)]">{advisor.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </WidgetCard>
    </div>
  );
}

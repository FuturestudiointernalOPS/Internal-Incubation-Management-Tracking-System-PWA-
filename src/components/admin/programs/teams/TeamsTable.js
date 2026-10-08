"use client";

import { Users, Edit3, Trash2, Shield, UserCheck, ExternalLink, Star } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/** Teams table for the program-teams screen (header row, empty state, rows). */
export default function TeamsTable({
  teams,
  getHandlerDisplay,
  getMemberCount,
  toggleVentureReady,
  openEditModal,
  setDeleteTarget,
  router,
}) {
  const { t } = useI18n();

  return (
        <div className="rounded-2xl bg-secondary border border-[var(--border-primary)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border-primary)]">
                  <th className="text-left px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                    {t("admin.teams.teamName")}
                  </th>
                  <th className="text-left px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                    {t("admin.teams.handler")}
                  </th>
                  <th className="text-center px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                    {t("admin.teams.members")}
                  </th>
                  <th className="text-right px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                    {t("adminMisc.programTeams.actions")}
                  </th>
                  <th className="text-right px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                    {t("adminMisc.programTeams.workspace")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-primary)]">
                {teams.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Shield className="w-10 h-10 text-[var(--text-tertiary)]" />
                        <p className="text-sm font-bold text-[var(--text-secondary)]">
                          {t("admin.teams.noTeams")}
                        </p>
                        <p className="text-[10px] text-[var(--text-tertiary)]">
                          {t("admin.teams.noTeamsDesc")}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  teams.map((team) => (
                    <tr
                      key={team.id}
                      className="group hover:bg-primary/50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-brand-orange/10 border border-brand-orange/20 flex items-center justify-center text-[var(--brand-orange)] shrink-0">
                            <Users className="w-4 h-4" />
                          </div>
                          <span className="text-sm font-bold text-[var(--text-primary)] uppercase">
                            {team.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <UserCheck className="w-3.5 h-3.5 text-[var(--brand-orange)]" />
                          <span className="text-xs font-bold text-[var(--text-secondary)]">
                            {getHandlerDisplay(team)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="px-3 py-1 rounded-full bg-brand-orange/10 text-[var(--brand-orange)] text-[10px] font-black uppercase tracking-wider">
                          {t("adminMisc.programTeams.membersCount", {
                            count: getMemberCount(team),
                          })}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          <button
                            onClick={() => toggleVentureReady(team)}
                            title={
                              team.is_venture_ready
                                ? t("adminMisc.programTeams.unmarkVentureReady")
                                : t("adminMisc.programTeams.markAsVentureReady")
                            }
                            className={`p-2 rounded-lg transition-colors ${
                              team.is_venture_ready
                                ? "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
                                : "hover:bg-primary text-[var(--text-secondary)] hover:text-emerald-500"
                            }`}
                          >
                            <Star
                              className={`w-4 h-4 ${team.is_venture_ready ? "fill-current" : ""}`}
                            />
                          </button>
                          <button
                            onClick={() => openEditModal(team)}
                            title={t("admin.edit")}
                            className="p-2 rounded-lg hover:bg-primary transition-colors text-[var(--text-secondary)] hover:text-[var(--brand-orange)]"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(team)}
                            title={t("common.delete")}
                            className="p-2 rounded-lg hover:bg-rose-500/10 transition-colors text-[var(--text-secondary)] hover:text-rose-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => router.push(`/team/${team.id}`)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-orange/10 border border-brand-orange/20 text-[var(--brand-orange)] text-[10px] font-black uppercase tracking-wider hover:bg-brand-orange/20 transition-all"
                        >
                          <ExternalLink className="w-3 h-3" />
                          {t("adminMisc.programTeams.open")}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
  );
}

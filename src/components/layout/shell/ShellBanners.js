"use client";

import { Briefcase, ListTodo, Megaphone } from "lucide-react";
import { tnav } from "./navigation";

/**
 * The three in-content banners the shell paints above the page: pinned
 * announcements, pending project invitations and pending task assignments.
 * Presentational only — the shell owns the state and the network actions and
 * hands them down already bound.
 */
export default function ShellBanners({
  pinnedAnnouncements,
  pendingInvites,
  pendingAssignments,
  onOpenAnnouncements,
  onAcceptInvite,
  onDeclineInvite,
  onAcceptAssignment,
  onDeclineAssignment,
  t,
}) {
  return (
    <>
      {/* Pinned Announcements Banner */}
      {pinnedAnnouncements.length > 0 && (
        <div className="mb-6 space-y-2">
          {pinnedAnnouncements.map((announcement) => (
            <div
              key={announcement.id}
              className="p-4 rounded-xl bg-brand-orange/10 border border-brand-orange/30 flex items-center justify-between flex-wrap gap-3 cursor-pointer hover:bg-brand-orange/15 transition-all"
              onClick={onOpenAnnouncements}
            >
              <div className="flex items-center gap-3">
                <Megaphone className="w-5 h-5 text-[var(--brand-orange)]" />
                <div>
                  <p className="text-[11px] font-black text-[var(--brand-orange)] uppercase tracking-wider">
                    {t(tnav("announcements"))}
                  </p>
                  <p className="text-[10px] text-[var(--text-secondary)]">
                    <span className="font-bold text-[var(--text-primary)]">
                      {announcement.title}
                    </span>
                    {" — "}
                    {announcement.body.length > 120
                      ? announcement.body.substring(0, 117) + "..."
                      : announcement.body}
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                {t("common.viewAll")} →
              </span>
            </div>
          ))}
        </div>
      )}
      {/* Project Invitation Banner */}
      {pendingInvites.length > 0 && (
        <div className="mb-6 p-4 rounded-xl bg-brand-orange/10 border border-brand-orange/30 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Briefcase className="w-5 h-5 text-[var(--brand-orange)]" />
            <div>
              <p className="text-[11px] font-black text-[var(--brand-orange)] uppercase tracking-wider">
                {t("common.projectInvitation")}
              </p>
              <p className="text-[10px] text-[var(--text-secondary)]">
                {t("common.invitedToJoin")}{" "}
                <span className="font-bold text-[var(--text-primary)]">
                  {pendingInvites[0].project_name || t("common.aProject")}
                </span>
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onAcceptInvite}
              className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-[10px] font-bold uppercase tracking-wide hover:bg-emerald-600 transition-all"
            >
              {t("common.accept")}
            </button>
            <button
              onClick={onDeclineInvite}
              className="px-4 py-2 bg-surface-3 text-[var(--text-primary)] rounded-lg text-[10px] font-bold uppercase tracking-wide hover:bg-surface-2 transition-all"
            >
              {t("common.decline")}
            </button>
          </div>
        </div>
      )}
      {/* Task Assignment Banner */}
      {pendingAssignments.length > 0 && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <ListTodo className="w-5 h-5 text-emerald-500" />
            <div>
              <p className="text-[11px] font-black text-emerald-500 uppercase tracking-wider">
                {t("common.taskAssignment")}
              </p>
              <p className="text-[10px] text-[var(--text-secondary)]">
                {t("common.assignedTask")}{" "}
                <span className="font-bold text-[var(--text-primary)]">
                  {pendingAssignments[0].task_title || t("common.aTask")}
                </span>
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onAcceptAssignment}
              className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-[10px] font-bold uppercase tracking-wide hover:bg-emerald-600 transition-all"
            >
              {t("common.accept")}
            </button>
            <button
              onClick={onDeclineAssignment}
              className="px-4 py-2 bg-surface-3 text-[var(--text-primary)] rounded-lg text-[10px] font-bold uppercase tracking-wide hover:bg-surface-2 transition-all"
            >
              {t("common.decline")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import {
  Calendar,
  Crown,
  Mail,
  Phone,
  Shield,
  User,
  Users,
} from "lucide-react";

const memberStatusColor = (status) =>
  status === "suspended"
    ? "bg-amber-500/10 text-amber-400"
    : status === "removed"
      ? "bg-slate-500/10 text-slate-400"
      : "bg-emerald-500/10 text-emerald-400";

/** A generic relation is translated; a job title ("CEO") is a datum, shown as-is. */
const MEMBER_ROLE_KEYS = {
  founder: "vadmin.detail.roleFounder",
  "co-founder": "vadmin.detail.roleCoFounder",
  member: "vadmin.detail.roleMember",
  team_member: "vadmin.detail.roleMember",
};

const memberRoleLabel = (member, t) => {
  const key = MEMBER_ROLE_KEYS[String(member.role || "").toLowerCase()];
  return key ? t(key) : String(member.role || "");
};

export default function VentureTeamTab({ t, memberSummary, members, id, router, lang }) {
  return (
    <>
      <div className="space-y-6">
        {/* Who is in this Venture, counted from the MEMBERSHIP list — the
            founder included. The founder invitation ledger is managed on its
            own screen, reached from the button below. */}
        <div className="card">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-brand-orange/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-[var(--brand-orange)]" />
              </div>
              <div>
                <h3 className="text-sm font-black text-[var(--text-primary)]">{t("vadmin.detail.teamMembers")}</h3>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {t("vadmin.detail.teamManagementDesc")}
                </p>
              </div>
            </div>
            <button
              onClick={() => router.push(`/admin/ventures/${id}/founders`)}
              className="px-5 py-2.5 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all flex items-center gap-2"
            >
              <Shield className="w-3.5 h-3.5" /> {t("vadmin.detail.manageInvitations")}
            </button>
          </div>

          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-tertiary rounded-xl border border-[var(--border-primary)]">
              <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{t("vadmin.detail.totalMembers")}</p>
              <p className="text-2xl font-black text-[var(--text-primary)] mt-1">{memberSummary.total}</p>
            </div>
            <div className="p-4 bg-tertiary rounded-xl border border-[var(--border-primary)]">
              <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{t("vadmin.detail.founders")}</p>
              <p className="text-2xl font-black text-[var(--text-primary)] mt-1">{memberSummary.founders}</p>
            </div>
            <div className="p-4 bg-tertiary rounded-xl border border-[var(--border-primary)]">
              <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{t("vadmin.detail.team")}</p>
              <p className="text-2xl font-black text-[var(--text-primary)] mt-1">{memberSummary.team}</p>
            </div>
            <div className="p-4 bg-tertiary rounded-xl border border-[var(--border-primary)]">
              <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{t("vadmin.detail.suspendedMembers")}</p>
              <p className="text-2xl font-black text-amber-400 mt-1">{memberSummary.suspended}</p>
            </div>
          </div>
        </div>

        {/* The member record itself: who they are, how to reach them, what
            they are, and since when. */}
        <div className="card">
          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <User className="w-3.5 h-3.5 text-[var(--brand-orange)]" />
            {t("vadmin.detail.memberList")}
          </h3>
          {members.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)] py-6 text-center">{t("vadmin.detail.noMembers")}</p>
          ) : (
            <div className="space-y-3">
              {members.map((member, index) => (
                <div
                  key={member.id || index}
                  className="flex flex-wrap items-center justify-between gap-3 p-4 bg-tertiary rounded-xl border border-[var(--border-primary)]"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-primary border border-[var(--border-primary)] flex items-center justify-center text-sm font-black shrink-0">
                      {(member.name || member.email || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-[var(--text-primary)] truncate">
                          {member.name || member.email || t("vadmin.detail.unnamedMember")}
                        </p>
                        {member.is_owner ? (
                          <span className="flex items-center gap-1 text-[8px] font-black uppercase px-2 py-0.5 rounded bg-brand-orange/10 text-[var(--brand-orange)]">
                            <Crown className="w-3 h-3" /> {t("vadmin.detail.owner")}
                          </span>
                        ) : member.is_founder ? (
                          <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded bg-blue-500/10 text-blue-400">
                            {t("vadmin.detail.founderBadge")}
                          </span>
                        ) : (
                          <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded bg-slate-500/10 text-slate-400">
                            {t("vadmin.detail.teamMemberBadge")}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 mt-1 text-[10px] text-slate-500">
                        {member.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" /> {member.email}
                          </span>
                        )}
                        {member.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {member.phone}
                          </span>
                        )}
                        <span>{memberRoleLabel(member, t)}</span>
                        {member.joined_at && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {t("vadmin.detail.memberSince", { date: new Date(member.joined_at).toLocaleDateString(lang) })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className={`text-[8px] font-black uppercase px-2 py-1 rounded shrink-0 ${memberStatusColor(member.status)}`}>
                    {t(`vadmin.detail.memberStatus.${["active", "suspended", "removed"].includes(member.status) ? member.status : "active"}`)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
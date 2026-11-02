"use client";

import { CalendarDays, Crown, Users } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * The right-hand snapshot: the few facts a Venture Manager needs to place the
 * Venture without opening a tab. Deliberately three rows and no lists — the
 * member roster, the roadmap and the calendar each have their own room.
 *
 * Reads nothing: both values arrive from the page's existing loads.
 */
const isFounderMember = (member) =>
  Boolean(member?.is_founder) || member?.member_type === "founder";

/** The soonest session that has not happened yet, or null. */
function soonestSession(sessions = []) {
  const now = Date.now();
  return (
    sessions
      .map((session) => ({
        session,
        at: session?.session_date ? new Date(session.session_date).getTime() : NaN,
      }))
      .filter((entry) => Number.isFinite(entry.at) && entry.at >= now)
      .sort((left, right) => left.at - right.at)[0]?.session || null
  );
}

function Row({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
      <span className="flex min-w-0 items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
        <Icon className="w-3.5 h-3.5 shrink-0 text-[var(--brand-orange)]" />
        {label}
      </span>
      <span className="shrink-0 text-xs font-bold text-[var(--text-primary)]">{value}</span>
    </div>
  );
}

export default function CockpitSnapshot({ members = [], sessions = [] }) {
  const { t, lang } = useI18n();
  const founders = members.filter(isFounderMember).length;
  const next = soonestSession(sessions);

  const nextLabel = next
    ? `${new Date(next.session_date).toLocaleDateString(lang)}${
        next.start_time ? ` · ${next.start_time}` : ""
      }`
    : t("vadmin.dashboard.noUpcomingMeetings");

  return (
    <div className="card h-full">
      <div className="divide-y divide-[var(--border-primary)]">
        <Row icon={Users} label={t("vadmin.dashboard.team")} value={members.length} />
        <Row icon={Crown} label={t("vadmin.dashboard.foundersCount")} value={founders} />
        <Row
          icon={CalendarDays}
          label={t("vadmin.dashboard.upcomingMeetings")}
          value={nextLabel}
        />
      </div>
    </div>
  );
}

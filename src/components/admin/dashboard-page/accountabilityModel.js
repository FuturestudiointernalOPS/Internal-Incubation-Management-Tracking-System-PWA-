/**
 * TEAM ACCOUNTABILITY MODEL — the pure rules behind the admin dashboard's
 * stand-up / retro / blocker figures.
 *
 * It applies the staff dashboard's own rules (`@/components/staff/dashboardModel`)
 * to the whole team, so a person reads the same regularity on their dashboard
 * and on the admin's:
 *  - only SUBMITTED reports count, over the last four ISO weeks;
 *  - a week owes a Monday stand-up, and its Friday retro only once Friday has
 *    come (the current week's retro is "not due yet" before that);
 *  - the people held to it are the active staff roster, plus anyone else who
 *    handed in a staff report in the window — someone who never reported still
 *    gets a row, as inactive.
 *
 * Blockers are read from the blockers table (the active ones), never from the
 * report flags: a blocker flagged in a stand-up AND raised on its task is one
 * blocker, not two. Nothing here fetches or renders.
 */

import { recentWeeks, weekRecord, regularity } from "@/components/staff/dashboardModel";

const WINDOW_WEEKS = 4;

const isRetroDue = (now) => [5, 6, 0].includes(now.getDay());
const isSubmitted = (report) => report && report.status === "submitted";

/**
 * @param {{
 *   reports: object[],   // staff-context reports, as GET /api/op-reports returns them
 *   roster: {cid:string, name:string, role:string}[],
 *   blockers: object[],  // active blockers
 *   now: Date,
 * }} input
 */
export function teamAccountability({ reports, roster, blockers, now }) {
  const weeks = recentWeeks(now, WINDOW_WEEKS);
  const current = weeks[weeks.length - 1];
  const retroDue = isRetroDue(now);
  const inWindow = (report) =>
    weeks.some((week) => Number(report.week_number) === week.week && Number(report.year) === week.year);

  const submitted = (reports || []).filter((report) => isSubmitted(report) && inWindow(report));

  const people = new Map();
  for (const member of roster || []) {
    people.set(String(member.cid), { id: String(member.cid), name: member.name, role: member.role });
  }
  for (const report of submitted) {
    const id = String(report.user_id);
    if (!people.has(id)) people.set(id, { id, name: report.user_name, role: report.user_role });
  }

  const activeBlockers = (blockers || []).filter((blocker) => blocker.status === "active");
  const blockersByUser = new Map();
  for (const blocker of activeBlockers) {
    const id = String(blocker.user_id);
    blockersByUser.set(id, (blockersByUser.get(id) || 0) + 1);
  }

  const rows = [...people.values()].map((person) => {
    const own = submitted.filter((report) => String(report.user_id) === person.id);
    const record = weeks.map((week) => weekRecord(own, week));
    const finished = record.slice(0, -1);
    const thisWeek = record[record.length - 1];
    const latest = own.reduce(
      (max, report) => (!max || new Date(report.updated_at || report.created_at) > new Date(max) ? report.updated_at || report.created_at : max),
      null,
    );
    return {
      ...person,
      status: regularity(record, now),
      standupThisWeek: thisWeek.standup,
      retroThisWeek: retroDue ? thisWeek.retro : thisWeek.retro || null,
      standups: { done: record.filter((week) => week.standup).length, due: record.length },
      retros: {
        done: finished.filter((week) => week.retro).length + (retroDue && thisWeek.retro ? 1 : 0),
        due: finished.length + (retroDue ? 1 : 0),
      },
      blockers: blockersByUser.get(person.id) || 0,
      latest,
    };
  });

  const order = { inactive: 0, at_risk: 1, regular: 2 };
  rows.sort(
    (first, second) =>
      order[first.status] - order[second.status] || String(first.name || "").localeCompare(String(second.name || "")),
  );

  const standupsInWindow = submitted.filter((report) => report.report_type === "standup");
  const flagged = standupsInWindow.filter((report) => Boolean(report.has_blockers)).length;

  return {
    week: current,
    retroDue,
    expected: rows.length,
    standupsThisWeek: rows.filter((row) => row.standupThisWeek).length,
    retrosThisWeek: rows.filter((row) => row.retroThisWeek).length,
    activeBlockers: activeBlockers.length,
    blockerRate: standupsInWindow.length ? Math.round((flagged / standupsInWindow.length) * 100) : 0,
    regular: rows.filter((row) => row.status === "regular").length,
    atRisk: rows.filter((row) => row.status === "at_risk").length,
    inactive: rows.filter((row) => row.status === "inactive").length,
    rows,
  };
}

"use client";

import React, { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/constants";
import { computeProgramProgress } from "@/lib/programProgress";
import AppTable from "@/components/ui/AppTable";

/**
 * PM — PROGRAM PROGRESS TO DATE
 *
 * Answers one question: "is this programme on schedule RIGHT NOW?" Every figure
 * is measured against what was OWED by today — sessions held, deliverables
 * checked, report weeks filed, submissions approved — not against the whole
 * plan. That is why the percentage here differs from the bar beside the
 * programme on the list page: that bar measures work produced against the entire
 * plan, so it can only reach 100% at the end and falls when the plan is made
 * more complete. This one reaches 100% whenever nothing is late, at any point.
 *
 * The rules that keep it honest live in @/lib/programProgress: a deadline
 * falling today is not late yet, and each block is capped at its own maximum, so
 * a surplus in one block can never pay for a deficit in another.
 *
 * Every string is translated (pmMisc.workspace.progress.*), every colour is a
 * theme variable, and days are printed through the local-midnight trick below so
 * a deadline does not slip back a day for readers west of Greenwich.
 */

/** How many late items each pace card previews, and how many delay rows show at first. */
const LATE_PREVIEW = 3;
const DELAY_PREVIEW = 15;

/**
 * Days travel as "YYYY-MM-DD". Appending a time makes the parser read LOCAL
 * midnight; parsing the bare day would be read as UTC midnight, which shows the
 * previous day west of Greenwich.
 */
const atLocalMidnight = (day) => (day ? `${day}T00:00:00` : null);

/** State accents, shared by the production tiles and the delay rows. */
const STATE_ACCENT = {
  approved: { text: "text-emerald-500", chip: "bg-emerald-500/10" },
  awaiting: { text: "text-amber-500", chip: "bg-amber-500/10" },
  returned: { text: "text-rose-500", chip: "bg-rose-500/10" },
  missing: {
    text: "text-[var(--text-tertiary)]",
    chip: "bg-[var(--surface-3)]",
  },
};

/**
 * One pace block: what was owed, what was done, and — for the first few blocks
 * that are still open — which items they are. Labels arrive already translated
 * so this stays a single rendering shape rather than three near-copies.
 */
function PaceCard({
  heading,
  done,
  due,
  rows,
  hiddenCount,
  doneOfDue,
  nothingDueYet,
  moreLabel,
  note = null,
}) {
  const filled = due > 0 ? Math.min(100, Math.round((done / due) * 100)) : 0;

  return (
    <div className="space-y-2 rounded-xl border border-[var(--border-primary)] bg-surface-2 p-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-primary)]">
        {heading}
      </p>

      {due > 0 ? (
        <>
          <p className="text-[10px] font-medium text-[var(--text-secondary)]">
            {doneOfDue}
          </p>
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--border-primary)]/20">
            <div
              className="h-full rounded-full"
              style={{
                width: `${filled}%`,
                background: "var(--brand-orange)",
              }}
            />
          </div>
        </>
      ) : (
        <p className="text-[10px] font-medium text-[var(--text-tertiary)]">
          {nothingDueYet}
        </p>
      )}

      {note ? (
        <p className="text-[10px] font-bold text-amber-500">{note}</p>
      ) : null}

      {(rows.length > 0 || hiddenCount > 0) && (
        <ul className="space-y-1 pt-1">
          {rows.map((row) => (
            <li
              key={row.key}
              className="text-[10px] font-medium text-[var(--text-tertiary)]"
            >
              {row.title ? (
                <>
                  <span className="text-[var(--text-secondary)]">
                    {row.title}
                  </span>
                  {row.detail ? " · " : null}
                </>
              ) : null}
              {row.detail}
              {row.mark ? (
                <span className="ml-1 text-[10px] font-bold text-amber-500">
                  · {row.mark}
                </span>
              ) : null}
            </li>
          ))}
          {hiddenCount > 0 && (
            <li className="text-[10px] font-bold text-[var(--text-tertiary)]">
              {moreLabel}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

export function ProgramProgressPanel({
  program,
  sessions,
  requirements,
  reports,
  submissions,
  participants,
}) {
  const { t, lang } = useI18n();
  const [showAllDelays, setShowAllDelays] = useState(false);

  // One computation per answer: the module is pure, so the same inputs always
  // give the same schedule and never need recomputing on an unrelated render.
  const progress = useMemo(
    () =>
      computeProgramProgress({
        program,
        sessions,
        requirements,
        reports,
        submissions,
        participants,
      }),
    [program, sessions, requirements, reports, submissions, participants],
  );

  const { headline, participantWork, dataQuality } = progress;

  const day = (value) => formatDate(atLocalMidnight(value), { short: true }, lang);

  const anythingLate = Object.values(headline.late).some((count) => count > 0);

  // Each note appears only when it has something to say. An undated plan or an
  // unlinked submission does not lower the score — it makes the score less
  // trustworthy, so it is shown beside it rather than quietly ignored.
  const qualityNotes = [
    dataQuality.missingStartDate &&
      t("pmMisc.workspace.progress.qualityNoStartDate"),
    dataQuality.undatedRequirements > 0 &&
      t("pmMisc.workspace.progress.qualityUndatedRequirements", {
        count: dataQuality.undatedRequirements,
      }),
    dataQuality.undatedSessions > 0 &&
      t("pmMisc.workspace.progress.qualityUndatedSessions", {
        count: dataQuality.undatedSessions,
      }),
    dataQuality.unlinkedSubmissions > 0 &&
      t("pmMisc.workspace.progress.qualityUnlinkedSubmissions", {
        count: dataQuality.unlinkedSubmissions,
      }),
    dataQuality.participantsWithoutEnrolmentDate > 0 &&
      t("pmMisc.workspace.progress.qualityNoEnrolmentDate", {
        count: dataQuality.participantsWithoutEnrolmentDate,
      }),
  ].filter(Boolean);

  // ── Pace: the three dated blocks, plus the first few late items in each ────
  const sessionsLate = progress.late.sessions.map((item, index) => ({
    key: `session-${index}`,
    title: item.title,
    detail: item.week
      ? t("pmMisc.workspace.progress.weekLabel", { week: item.week })
      : day(item.dueDay),
    mark: item.unrecorded
      ? t("pmMisc.workspace.progress.paceSessionsNoStatusMark")
      : null,
  }));

  const deliverablesLate = progress.late.deliverables.map((item, index) => ({
    key: `deliverable-${index}`,
    title: item.title,
    detail: item.undated
      ? t("pmMisc.workspace.progress.noDeadline")
      : day(item.dueDay),
  }));

  // A report week's deadline is derived from its number and lands on the first
  // day the week is owed, so printing that day would read as "due today". The
  // week number is the only honest label for it.
  const weeksLate = progress.late.weeks.map((item) => ({
    key: `week-${item.week}`,
    title: t("pmMisc.workspace.progress.weekLabel", { week: item.week }),
    detail: null,
  }));

  const paceBlocks = [
    {
      key: "sessions",
      heading: t("pmMisc.workspace.progress.paceSessions"),
      block: progress.blocks.sessions,
      rows: sessionsLate.slice(0, LATE_PREVIEW),
      hiddenCount: Math.max(0, sessionsLate.length - LATE_PREVIEW),
      note:
        dataQuality.pastSessionsWithoutStatus > 0
          ? t("pmMisc.workspace.progress.paceSessionsNoStatus", {
              count: dataQuality.pastSessionsWithoutStatus,
            })
          : null,
    },
    {
      key: "deliverables",
      heading: t("pmMisc.workspace.progress.paceRequirements"),
      block: progress.blocks.deliverables,
      rows: deliverablesLate.slice(0, LATE_PREVIEW),
      hiddenCount: Math.max(0, deliverablesLate.length - LATE_PREVIEW),
    },
    {
      key: "weeks",
      heading: t("pmMisc.workspace.progress.paceWeeks"),
      block: progress.blocks.weeks,
      rows: weeksLate.slice(0, LATE_PREVIEW),
      hiddenCount: Math.max(0, weeksLate.length - LATE_PREVIEW),
    },
  ];

  // ── Participant production ────────────────────────────────────────────────
  const productionTiles = [
    {
      key: "approved",
      label: t("pmMisc.workspace.progress.stateApproved"),
      value: participantWork.approved,
    },
    {
      key: "awaiting",
      label: t("pmMisc.workspace.progress.stateAwaitingReview"),
      value: participantWork.awaiting,
    },
    {
      key: "returned",
      label: t("pmMisc.workspace.progress.stateReturned"),
      value: participantWork.returned,
    },
    {
      key: "missing",
      label: t("pmMisc.workspace.progress.stateMissing"),
      value: participantWork.missing,
    },
  ];

  // ── Delays ────────────────────────────────────────────────────────────────
  const delayRows = progress.overdue.map((entry, index) => ({
    ...entry,
    id: `${entry.participantId}::${entry.requirementId}::${index}`,
  }));
  const visibleDelays = showAllDelays
    ? delayRows
    : delayRows.slice(0, DELAY_PREVIEW);
  const hiddenDelays = delayRows.length - visibleDelays.length;

  const delayColumns = [
    {
      key: "participantName",
      label: t("pmMisc.workspace.progress.colParticipant"),
      render: (value, row) => (
        <div className="space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-primary)]">
            {value}
          </p>
          <span
            className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
              STATE_ACCENT[row.state].text
            } ${STATE_ACCENT[row.state].chip}`}
          >
            {t(
              row.state === "returned"
                ? "pmMisc.workspace.progress.stateReturned"
                : "pmMisc.workspace.progress.stateMissing",
            )}
          </span>
        </div>
      ),
    },
    {
      key: "requirementTitle",
      label: t("pmMisc.workspace.progress.colDeliverable"),
    },
    {
      key: "dueDay",
      label: t("pmMisc.workspace.progress.colDeadline"),
      render: (value) => (
        <span className="text-[11px] font-medium text-[var(--text-secondary)]">
          {day(value)}
        </span>
      ),
    },
    {
      key: "daysLate",
      label: t("pmMisc.workspace.progress.colLate"),
      align: "right",
      render: (value) => (
        <span className="text-sm font-bold text-rose-500">
          {t("pmMisc.workspace.progress.daysLate", { days: value })}
        </span>
      ),
    },
  ];

  return (
    <section className="card space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
          {t("pmMisc.workspace.progress.title")}
        </h2>
        <span className="text-[10px] font-medium text-[var(--text-secondary)]">
          {t("pmMisc.workspace.progress.asOf", { date: day(progress.asOf) })}
        </span>
      </div>

      {/* Headline — what was owed by today, and how much of it was done */}
      {progress.ready ? (
        <div className="space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black tracking-tight text-[var(--text-primary)]">
              {progress.headline.percent}
            </span>
            <span className="text-lg font-black text-[var(--text-primary)]">
              %
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
              {t("pmMisc.workspace.progress.upToDate")}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--border-primary)]/20">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${progress.headline.percent}%`,
                background: "var(--brand-orange)",
              }}
            />
          </div>
        </div>
      ) : (
        <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">
          {t("pmMisc.workspace.progress.nothingDueYet")}
        </p>
      )}

      {/* Summary — what is outstanding, and why this figure is not the list bar */}
      <div className="space-y-1">
        {anythingLate ? (
          <p className="text-[11px] font-bold text-[var(--text-primary)]">
            {t("pmMisc.workspace.progress.summary", {
              sessions: headline.late.sessions,
              deliverables: headline.late.deliverables,
              weeks: headline.late.weeks,
              copies: headline.late.submissions,
            })}
          </p>
        ) : (
          <p className="text-[11px] font-bold text-emerald-500">
            {t("pmMisc.workspace.progress.allClear")}
          </p>
        )}
        <p className="text-[10px] font-medium text-[var(--text-tertiary)]">
          {t("pmMisc.workspace.progress.dueTodayNote")}
        </p>
        <p className="text-[10px] font-medium text-[var(--text-tertiary)]">
          {t("pmMisc.workspace.progress.listComparison")}
        </p>
      </div>

      {/* Data quality — shown only when there is something to report */}
      {qualityNotes.length > 0 && (
        <ul className="space-y-1 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2">
          {qualityNotes.map((note) => (
            <li key={note} className="text-[10px] font-medium text-amber-500">
              {note}
            </li>
          ))}
        </ul>
      )}

      {/* Pace — the three dated blocks */}
      <div className="space-y-2">
        <h3 className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-primary)]">
          {t("pmMisc.workspace.progress.paceTitle")}
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {paceBlocks.map((entry) => (
            <PaceCard
              key={entry.key}
              heading={entry.heading}
              done={entry.block.done}
              due={entry.block.due}
              rows={entry.rows}
              hiddenCount={entry.hiddenCount}
              doneOfDue={t("pmMisc.workspace.progress.doneOfDue", {
                done: entry.block.done,
                due: entry.block.due,
              })}
              nothingDueYet={t("pmMisc.workspace.progress.nothingDueYet")}
              moreLabel={t("pmMisc.workspace.progress.more", {
                count: entry.hiddenCount,
              })}
              note={entry.note || null}
            />
          ))}
        </div>
      </div>

      {/* Participant production */}
      <div className="space-y-2">
        <h3 className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-primary)]">
          {t("pmMisc.workspace.progress.participantsTitle")}
        </h3>
        <p className="text-[10px] font-medium text-[var(--text-secondary)]">
          {t("pmMisc.workspace.progress.expectedCopies", {
            copies: participantWork.expected,
          })}
        </p>
        <div className="grid grid-cols-2 items-start gap-3 sm:grid-cols-4">
          {productionTiles.map((tile) => (
            <div
              key={tile.key}
              className="space-y-1 rounded-xl border border-[var(--border-primary)] bg-surface-2 p-3"
            >
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                {tile.label}
              </p>
              <p className={`text-lg font-black ${STATE_ACCENT[tile.key].text}`}>
                {tile.value}
              </p>
              {/* Directly under the awaiting tile: this backlog is the
                  programme's own, not the participants' delay. */}
              {tile.key === "awaiting" && participantWork.awaiting > 0 && (
                <p className="text-[10px] font-medium text-amber-500">
                  {t("pmMisc.workspace.progress.awaitingHint")}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Delays — who is behind on a due deliverable */}
      <div className="space-y-2">
        <h3 className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-primary)]">
          {t("pmMisc.workspace.progress.delaysTitle")}
        </h3>
        {delayRows.length === 0 ? (
          <p className="text-[11px] font-medium text-[var(--text-secondary)]">
            {t("pmMisc.workspace.progress.delaysEmpty")}
          </p>
        ) : (
          <>
            <AppTable columns={delayColumns} data={visibleDelays} />
            {hiddenDelays > 0 && (
              <button
                type="button"
                onClick={() => setShowAllDelays(true)}
                className="text-[10px] font-bold uppercase tracking-wide text-[var(--brand-orange)] transition-all hover:brightness-110"
              >
                {t("pmMisc.workspace.progress.more", { count: hiddenDelays })}
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}

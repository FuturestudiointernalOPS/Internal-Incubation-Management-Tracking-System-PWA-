"use client";

import { useState } from "react";
import { AlertTriangle, Inbox, ListChecks, Loader2, ArrowRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { statusLabel } from "@/lib/ventureStatuses";
import SectionHead from "@/components/ui/SectionHead";
import { groupWork } from "@/components/shared/ventures/workspace/ventureScreenModel";

/**
 * The founder's work queue — the dashboard's answer to "what do I do next?".
 *
 * It renders ONLY what GET /api/ventures/[id]/my-work returned. No bucket is
 * recomputed here and no deadline is invented: the classification lives in
 * `services/ventures/myWork`, so the screen and the API can never disagree.
 */

/** status tone → the shared tag colour modifier (components/shared/kit/staff.css). */
const TAG_TONE = {
  changes_requested: "r",
  blocked: "r",
  awaiting_review: "w",
  upcoming: "w",
  in_progress: "b",
  completed: "g",
  approved: "g",
};

/** Rows shown before "Show all" — the queue is a prompt, not a dump. */
const VISIBLE_ROWS = 5;

/** Most urgent first: earliest due date; work with no deadline last. */
const byDueDate = (a, b) => {
  if (!a.due_date && !b.due_date) return 0;
  if (!a.due_date) return 1;
  if (!b.due_date) return -1;
  return String(a.due_date).localeCompare(String(b.due_date));
};

function formatDay(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
}

/** One piece of work, with the reviewer's words when it was sent back. */
function WorkRow({ item, onOpen }) {
  const { t } = useI18n();
  const feedback =
    item.submission?.state === "changes_requested" ? item.submission.feedback : null;
  const title = item.title || item.task_title || item.name || "Sprint Deliverable";

  return (
    <li
      className="p-3.5 rounded-xl border mb-2 transition-all hover:bg-[var(--surface-2)]"
      style={{
        background: "var(--surface-1)",
        borderColor: "var(--border-primary)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-bold text-[var(--text-primary)]">
              {title}
            </span>
            <span className={`stf-tag ${TAG_TONE[item.status?.tone] || ""}`}>
              {statusLabel(item.status, t)}
            </span>
          </div>
          <div
            className="mt-1 flex flex-wrap items-center gap-x-3 text-[11px]"
            style={{ color: "var(--text-secondary)" }}
          >
            {item.milestone?.title && (
              <span className="font-medium text-[var(--text-primary)]">
                {item.milestone.title}
              </span>
            )}
            {item.owner?.name && (
              <span>
                Owner: <strong>{item.owner.name}</strong>
              </span>
            )}
            <span>
              {item.due_date
                ? t("venture.myWork.dueOn", { date: formatDay(item.due_date) })
                : t("venture.myWork.noDeadline")}
            </span>
          </div>
          {feedback && (
            <p
              className="mt-2 rounded-lg p-2.5 text-[12px] border"
              style={{
                background: "color-mix(in srgb, var(--brand-orange) 8%, var(--surface-1))",
                borderColor: "color-mix(in srgb, var(--brand-orange) 20%, transparent)",
                color: "var(--text-primary)",
              }}
            >
              <strong className="text-[var(--brand-orange)]">{t("venture.myWork.feedback")}: </strong>
              {feedback}
            </p>
          )}
        </div>
        {onOpen && (
          <button
            type="button"
            className="shrink-0 flex items-center gap-1 text-xs font-bold text-[var(--brand-orange)] hover:underline pt-0.5"
            onClick={onOpen}
          >
            <span>{t("venture.myWork.open")}</span>
            <ArrowRight size={13} />
          </button>
        )}
      </div>
    </li>
  );
}

function Head({ subtitle }) {
  const { t } = useI18n();
  return (
    <SectionHead
      icon={ListChecks}
      title={t("venture.myWork.title")}
      subtitle={subtitle}
    />
  );
}

export default function DashboardWorkQueue({ myWork, loading, failed, onOpen, onRetry }) {
  const { t } = useI18n();
  const [showAll, setShowAll] = useState(false);

  if (failed) {
    return (
      <section className="stf-card">
        <Head />
        <div className="stf-empty">
          <AlertTriangle size={22} />
          <p className="font-semibold">{t("venture.myWork.loadFailed")}</p>
          <p>{t("venture.myWork.loadFailedHint")}</p>
          {onRetry && (
            <button type="button" className="stf-link-btn mt-2" onClick={onRetry}>
              {t("common.retry")}
            </button>
          )}
        </div>
      </section>
    );
  }

  if (loading && !myWork) {
    return (
      <section className="stf-card">
        <Head />
        <div
          className="flex items-center justify-center gap-2 py-6"
          style={{ color: "var(--text-secondary)" }}
        >
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">{t("common.loading")}</span>
        </div>
      </section>
    );
  }

  // One row per record — the first group that claims it wins
  const allGroups = groupWork(myWork).map((group) => ({
    ...group,
    items: [...group.items].sort(byDueDate),
  }));
  const total = allGroups.reduce((n, group) => n + group.items.length, 0);
  const limit = showAll ? Infinity : VISIBLE_ROWS;
  let printedBefore = 0;
  const groups = [];
  for (const group of allGroups) {
    const items = group.items.slice(0, Math.max(limit - printedBefore, 0));
    printedBefore += items.length;
    if (items.length > 0) groups.push({ ...group, items, total: group.items.length });
  }

  const partial = myWork?.source?.complete === false;

  return (
    <section className="stf-card">
      <Head subtitle={t("venture.myWork.subtitle")} />

      {partial && (
        <p
          className="mb-3 rounded-lg px-2.5 py-1.5 text-[12px]"
          style={{ background: "var(--surface-3)", color: "var(--text-secondary)" }}
        >
          {t("venture.myWork.partial")}
        </p>
      )}

      {groups.length === 0 ? (
        <div className="stf-empty">
          <Inbox size={22} />
          <p className="font-semibold">{t("venture.myWork.empty")}</p>
          <p>{t("venture.myWork.emptyHint")}</p>
        </div>
      ) : (
        groups.map((group) => (
          <div key={group.key} className="mt-4 first:mt-2">
            <p className="stf-k mb-2 text-[11px] uppercase font-bold tracking-wider" style={{ color: "var(--text-secondary)" }}>
              {t(`venture.myWork.group.${group.key}`)} · {group.total}
            </p>
            <ul className="list-none p-0 m-0">
              {group.items.map((item) => (
                <WorkRow key={item.id} item={item} onOpen={onOpen} />
              ))}
            </ul>
          </div>
        ))
      )}

      {total > VISIBLE_ROWS && (
        <button
          type="button"
          className="stf-link-btn mt-3"
          onClick={() => setShowAll((value) => !value)}
        >
          {showAll
            ? t("venture.myWork.showLess")
            : t("venture.myWork.showAll", { count: total })}
        </button>
      )}
    </section>
  );
}

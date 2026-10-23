"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { deliverableStatusWord, statusDotClass, statusLabel } from "@/lib/ventureStatuses";
import { groupActivitiesWithDeliverables, sessionBookingKey } from "@/components/ventures/journey/journeyShapers";
import FounderSessionBooking from "@/components/ventures/journey/FounderSessionBooking";
import DeliverableDetailDialog from "@/components/ventures/journey/DeliverableDetailDialog";
import { ChevronDown, ChevronRight } from "lucide-react";

// The kit tag for a status word (same tones as the Venture Manager view).
const TAG_TONE = { blocked: "r", in_progress: "b", awaiting_review: "w", changes_requested: "r", completed: "g", approved: "g" };

/**
 * The deliverables under one milestone: evidence the Venture must submit for
 * review. Every value comes from the parent (`JourneyTab`), which owns the
 * drafts and the submit action; this component only renders.
 *
 * The work is read as one labelled block per activity — ACTIVITY → its
 * DELIVERABLE(s) → DEFINITION OF DONE — with the people and timing kept as a
 * metadata line, so the founder can scan the chain without opening anything else.
 *
 * Each deliverable row is CLICKABLE and opens the shared
 * `DeliverableDetailDialog` (the same dialog the Venture Manager sees), where
 * every field is written out in full. Nothing in the list is truncated: the
 * title WRAPS, because a cut-off title with no way to read it was the whole
 * problem this replaced.
 *
 * ONE vocabulary, shared with the Venture Manager and Super Admin views
 * (`lib/ventureStatuses`) — the status chip is resolved through the same words.
 */
export default function FounderMilestoneDeliverables({ milestone, stage, dvDrafts, setDvDrafts, submitDeliverable, canBook, bookFor, bookForm, bookSaving, bookSession, openBooking, setBookFor, setBookForm }) {
  const { t } = useI18n();
  // Only the id is kept: the dialog then reads the CURRENT deliverable from
  // props, so a just-submitted status shows without reopening it.
  const [openId, setOpenId] = useState(null);
  // The activities opened by hand (by key). Collapsed by default: a milestone
  // carries many activities, and each one's header already says what it is and
  // how its deliverable stands.
  const [openActs, setOpenActs] = useState(() => new Set());
  const toggleAct = (key) =>
    setOpenActs((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const groups = groupActivitiesWithDeliverables(milestone.activities || [], milestone.deliverables || []);
  const openGroup = openId == null ? null : groups.find((group) => group.deliverables.some((item) => item.id === openId));
  const openDeliverable = openGroup?.deliverables.find((item) => item.id === openId) || null;
  const openStatus = openDeliverable ? deliverableStatusWord(openDeliverable) : null;
  // Evidence is the Venture's move only while the stage is active and the
  // deliverable has not been approved yet.
  const canSubmit = !!openDeliverable && stage.status === "active" && openStatus.id !== "approved";

  const fmtDate = (value) => (value ? new Date(value).toLocaleDateString() : "—");
  const actKey = (group, index) => group.activity?.id ?? `group-${index}`;
  const allOpen = groups.length > 0 && groups.every((group, index) => openActs.has(actKey(group, index)));

  return (
    <>
      {((milestone.deliverables || []).length > 0 || (milestone.activities || []).length > 0) && (
        <div className="jy-del">
          <div className="flex items-center justify-between gap-3">
            <p className="jy-lbl">{t("venture.manager.tasksHeading")}</p>
            {groups.length > 1 && (
              <button
                type="button"
                className="text-[12px] font-bold text-[var(--brand-orange)] hover:underline"
                onClick={() => setOpenActs(allOpen ? new Set() : new Set(groups.map((group, index) => actKey(group, index))))}
              >
                {allOpen ? t("common.collapse") : t("common.expand")}
              </button>
            )}
          </div>

          {groups.map((group, groupIndex) => {
            const key = actKey(group, groupIndex);
            const isOpen = openActs.has(key);
            return (
            <div key={key} className="jy-act">
              {/* ACTIVITY — the work that produces what follows. Its header is the
                  whole collapsed state: reference, title and where each deliverable stands. */}
              <button type="button" className="jy-act-head" aria-expanded={isOpen} onClick={() => toggleAct(key)}>
                {isOpen ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                <span className="min-w-0 flex-1">
                  {group.activity?.source_ref && <span className="stf-tag mr-1.5 align-middle">{group.activity.source_ref}</span>}
                  {group.activity?.title || t("venture.manager.notProvided")}
                </span>
                {group.deliverables.map((deliverable) => {
                  const status = deliverableStatusWord(deliverable);
                  return (
                    <span key={deliverable.id} className={`stf-tag ${TAG_TONE[status?.tone] || ""} shrink-0`}>
                      {statusLabel(status, t)}
                    </span>
                  );
                })}
              </button>

              {isOpen && (
              <div className="jy-act-body">
              {group.activity?.description && (
                <p className="text-[12px] text-[var(--text-secondary)] whitespace-pre-line break-words">{group.activity.description}</p>
              )}

              {/* DELIVERABLE(S) — the output, underneath its activity */}
              <div className="space-y-1">
                {group.deliverables.length > 0 && <p className="jy-lbl">{t("venture.manager.deliverableLabel")}</p>}
                {group.deliverables.map((deliverable) => {
                  const status = deliverableStatusWord(deliverable);
                  return (
                    <div key={deliverable.id} className="jy-drow">
                      <span className={`jy-dot ${statusDotClass(status)}`} />
                      <button
                        type="button"
                        onClick={() => setOpenId(deliverable.id)}
                        aria-label={`${t("venture.manager.viewDetails")}: ${deliverable.title}`}
                        className="t whitespace-normal break-words focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]/60 rounded"
                      >
                        {deliverable.title}
                      </button>
                      {deliverable.due_date && (
                        <span className="hidden sm:inline text-[11.5px] text-[var(--text-secondary)]">{fmtDate(deliverable.due_date)}</span>
                      )}
                      {deliverable.attachment_url && (
                        <a
                          href={deliverable.evidence_download_url || deliverable.attachment_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11.5px] font-semibold text-[var(--brand-orange)] hover:underline shrink-0"
                        >
                          {deliverable.attachment_name || t("venture.manager.viewEvidence")}
                        </a>
                      )}
                      <span className={`stf-tag ${TAG_TONE[status?.tone] || ""} shrink-0`}>{statusLabel(status, t)}</span>
                      <button
                        type="button"
                        onClick={() => setOpenId(deliverable.id)}
                        tabIndex={-1}
                        aria-hidden="true"
                        className="shrink-0"
                      >
                        <ChevronRight className="w-4 h-4" style={{ color: "var(--text-tertiary)" }} />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* DEFINITION OF DONE — what makes the activity complete */}
              <div>
                <p className="jy-lbl">{t("venture.manager.definitionOfDone")}</p>
                <p className="text-[12px] text-[var(--text-secondary)] mt-0.5 whitespace-pre-line break-words">
                  {group.activity?.definition_of_done || t("venture.manager.notProvided")}
                </p>
              </div>

              {/* METADATA — people and timing, kept out of the prose */}
              <div className="jy-facts in">
                <div><span>{t("venture.manager.milestoneOwner")}</span><b>{group.activity?.owner_name || group.deliverables[0]?.assigned_name || "—"}</b></div>
                <div><span>{t("venture.manager.supporting")}</span><b>{group.activity?.support_name || "—"}</b></div>
                <div><span>{t("venture.manager.startDate")}</span><b>{fmtDate(group.activity?.start_date)}</b></div>
                <div><span>{t("venture.manager.finishDate")}</span><b>{fmtDate(group.activity?.due_date || group.deliverables[0]?.due_date)}</b></div>
              </div>

              {/* Book a session AGAINST THIS ACTIVITY. The Report (notes) is staff-only: the
                  notes API refuses founders by design, so no button is offered here. */}
              <div className="jy-btns">
                {canBook && (
                  <FounderSessionBooking
                    bookFor={bookFor}
                    bookForKey={sessionBookingKey(milestone, group.activity, group.deliverables[0]?.id ?? null)}
                    bookForm={bookForm}
                    bookSaving={bookSaving}
                    bookSession={bookSession}
                    milestone={milestone}
                    onOpen={() => openBooking(milestone, group.activity, group.deliverables[0]?.id ?? null)}
                    setBookFor={setBookFor}
                    setBookForm={setBookForm}
                    stage={stage}
                  />
                )}
              </div>
              </div>
              )}
            </div>
            );
          })}
        </div>
      )}

      <DeliverableDetailDialog
        deliverable={openDeliverable}
        activity={openGroup?.activity || null}
        onClose={() => setOpenId(null)}
        submit={
          canSubmit
            ? {
              drafts: dvDrafts,
              setDrafts: setDvDrafts,
              // Once the evidence is in, the dialog has done its job: it closes.
              onSubmit: async (deliverableId) => {
                if (await submitDeliverable(deliverableId)) setOpenId(null);
              },
            }
            : null
        }
      />
    </>
  );
}

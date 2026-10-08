"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { deliverableStatusWord, statusChipClass, statusLabel } from "@/lib/ventureStatuses";
import { groupDeliverablesByActivity } from "@/components/ventures/journey/journeyShapers";
import DeliverableDetailDialog from "@/components/ventures/journey/DeliverableDetailDialog";
import { ChevronRight } from "lucide-react";

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
export default function FounderMilestoneDeliverables({ milestone, stage, dvDrafts, setDvDrafts, submitDeliverable }) {
  const { t } = useI18n();
  // Only the id is kept: the dialog then reads the CURRENT deliverable from
  // props, so a just-submitted status shows without reopening it.
  const [openId, setOpenId] = useState(null);

  const groups = groupDeliverablesByActivity(milestone.deliverables || []);
  const openGroup = openId == null ? null : groups.find((group) => group.deliverables.some((item) => item.id === openId));
  const openDeliverable = openGroup?.deliverables.find((item) => item.id === openId) || null;
  const openStatus = openDeliverable ? deliverableStatusWord(openDeliverable) : null;
  // Evidence is the Venture's move only while the stage is active and the
  // deliverable has not been approved yet.
  const canSubmit = !!openDeliverable && stage.status === "active" && openStatus.id !== "approved";

  return (
    <>
      {(milestone.deliverables || []).length > 0 && (
        <div className="space-y-2 pt-1">
          <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
            {t("venture.manager.deliverables")}
          </p>

          {groups.map((group, groupIndex) => (
            <div
              key={group.activity?.id ?? `group-${groupIndex}`}
              className="rounded-xl border p-3 space-y-3"
              style={{ borderColor: "var(--border-primary)", backgroundColor: "var(--surface-2)" }}
            >
              {/* ACTIVITY — the work that produces what follows */}
              <div className="space-y-1">
                <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
                  {t("venture.manager.activityLabel")}
                </p>
                <p className="text-xs font-semibold whitespace-normal break-words" style={{ color: "var(--text-primary)" }}>
                  {group.activity?.source_ref && (
                    <span className="mr-1.5 px-1.5 py-0.5 rounded text-[9px] font-black align-middle" style={{ backgroundColor: "var(--surface-3)", color: "var(--text-secondary)" }}>
                      {group.activity.source_ref}
                    </span>
                  )}
                  {group.activity?.title || t("venture.manager.notProvided")}
                </p>
                {group.activity?.description && (
                  <p className="text-xs whitespace-pre-line break-words" style={{ color: "var(--text-secondary)" }}>{group.activity.description}</p>
                )}
              </div>

              {/* DELIVERABLE(S) — the output, underneath its activity */}
              <div className="space-y-1.5">
                <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
                  {t("venture.manager.deliverableLabel")}
                </p>
                {group.deliverables.map((deliverable) => {
                  const status = deliverableStatusWord(deliverable);
                  return (
                    <button
                      key={deliverable.id}
                      type="button"
                      onClick={() => setOpenId(deliverable.id)}
                      aria-label={`${t("venture.manager.viewDetails")}: ${deliverable.title}`}
                      className="w-full text-left rounded-lg border px-3 py-2 flex items-start gap-2 transition-colors hover:border-[var(--brand-orange)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]/60"
                      style={{ borderColor: "var(--border-primary)", backgroundColor: "var(--surface-1)" }}
                    >
                      <span className="flex-1 min-w-0 space-y-0.5">
                        <span className="block text-xs font-semibold whitespace-normal break-words" style={{ color: "var(--text-primary)" }}>
                          {deliverable.title}
                        </span>
                        <span className="block text-[10px]" style={{ color: "var(--text-secondary)" }}>
                          {deliverable.due_date
                            ? `${t("venture.manager.dueDate")}: ${new Date(deliverable.due_date).toLocaleDateString()}`
                            : deliverable.deliverable_type
                              ? t(`venture.manager.deliverableTypes.${deliverable.deliverable_type}`)
                              : null}
                        </span>
                      </span>
                      <span className={`text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded shrink-0 ${statusChipClass(status)}`}>
                        {statusLabel(status, t)}
                      </span>
                      <ChevronRight className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--text-tertiary)" }} />
                    </button>
                  );
                })}
              </div>

              {/* DEFINITION OF DONE — what makes the activity complete */}
              <div className="space-y-1">
                <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
                  {t("venture.manager.definitionOfDone")}
                </p>
                <p className="text-xs whitespace-pre-line break-words" style={{ color: "var(--text-secondary)" }}>
                  {group.activity?.definition_of_done || t("venture.manager.notProvided")}
                </p>
              </div>

              {/* METADATA — people and timing, kept out of the prose */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-[10px]" style={{ color: "var(--text-secondary)" }}>
                <span>
                  <span className="font-bold">{t("venture.manager.milestoneOwner")}:</span> {group.activity?.owner_name || group.deliverables[0]?.assigned_name || "—"}
                </span>
                <span>
                  <span className="font-bold">{t("venture.manager.supporting")}:</span> {group.activity?.support_name || "—"}
                </span>
                <span>
                  <span className="font-bold">{t("venture.manager.startDate")}:</span>{" "}
                  {group.activity?.start_date ? new Date(group.activity.start_date).toLocaleDateString() : "—"}
                </span>
                <span>
                  <span className="font-bold">{t("venture.manager.finishDate")}:</span>{" "}
                  {(group.activity?.due_date || group.deliverables[0]?.due_date)
                    ? new Date(group.activity?.due_date || group.deliverables[0]?.due_date).toLocaleDateString()
                    : "—"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <DeliverableDetailDialog
        deliverable={openDeliverable}
        activity={openGroup?.activity || null}
        onClose={() => setOpenId(null)}
        submit={
          canSubmit
            ? { drafts: dvDrafts, setDrafts: setDvDrafts, onSubmit: submitDeliverable }
            : null
        }
      />
    </>
  );
}

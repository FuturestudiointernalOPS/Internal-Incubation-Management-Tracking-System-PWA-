"use client";

import { useI18n } from "@/lib/i18n";
import { deliverableStatusWord, statusChipClass, statusLabel } from "@/lib/ventureStatuses";
import AppModal from "@/components/ui/AppModal";

/**
 * ONE standard layout for a whole deliverable — the Venture's view and the
 * Venture Manager's view render the same dialog, so a deliverable never reads
 * differently depending on who opens it.
 *
 * Every field is spelled out and nothing is truncated: title (wrapping),
 * status, due date, changes requested, description, the activity that produces
 * it, the definition of done, and the submitted evidence.
 *
 * `submit` is optional — the Venture passes its evidence form
 * (`{ drafts, setDrafts, onSubmit }`); staff views omit it and get the
 * read-only dialog (staff review/edit stays on their own row controls).
 */
export default function DeliverableDetailDialog({ deliverable, activity, onClose, submit = null }) {
  const { t } = useI18n();
  const status = deliverable ? deliverableStatusWord(deliverable) : null;

  return (
    <AppModal
      isOpen={!!deliverable}
      onClose={onClose}
      title={t("venture.manager.deliverableDetailsTitle")}
      size="lg"
    >
      {deliverable && (
        <div className="space-y-5">
          {/* WHAT IT IS — the full title, never cut off */}
          <div className="space-y-2">
            <h3 className="text-base font-bold whitespace-normal break-words" style={{ color: "var(--text-primary)" }}>
              {deliverable.title}
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-[9px] uppercase tracking-widest px-2 py-1 rounded ${statusChipClass(status)}`}>
                {statusLabel(status, t)}
              </span>
              <span className="text-[10px] font-bold" style={{ color: "var(--text-secondary)" }}>
                {t("venture.manager.dueDate")}:{" "}
                {deliverable.due_date ? new Date(deliverable.due_date).toLocaleDateString() : "—"}
              </span>
              {deliverable.deliverable_type && (
                <span className="text-[10px] font-bold" style={{ color: "var(--text-secondary)" }}>
                  {t(`venture.manager.deliverableTypes.${deliverable.deliverable_type}`)}
                </span>
              )}
            </div>
          </div>

          {deliverable.approval_status === "rejected" && deliverable.rejection_reason && (
            <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-400">
              {t("venture.manager.changesRequestedReason", { reason: deliverable.rejection_reason })}
            </p>
          )}

          <DetailField
            label={t("venture.manager.description")}
            value={deliverable.description || t("venture.manager.notProvided")}
          />

          {activity && (
            <div
              className="rounded-xl border p-3 space-y-1"
              style={{ borderColor: "var(--border-primary)", backgroundColor: "var(--surface-2)" }}
            >
              <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
                {t("venture.manager.activityLabel")}
              </p>
              <p className="text-xs font-semibold whitespace-normal break-words" style={{ color: "var(--text-primary)" }}>
                {activity.source_ref && (
                  <span
                    className="mr-1.5 px-1.5 py-0.5 rounded text-[9px] font-black align-middle"
                    style={{ backgroundColor: "var(--surface-3)", color: "var(--text-secondary)" }}
                  >
                    {activity.source_ref}
                  </span>
                )}
                {activity.title || t("venture.manager.notProvided")}
              </p>
              {activity.description && (
                <p className="text-xs whitespace-pre-line break-words" style={{ color: "var(--text-secondary)" }}>
                  {activity.description}
                </p>
              )}
            </div>
          )}

          <DetailField
            label={t("venture.manager.definitionOfDone")}
            value={activity?.definition_of_done || t("venture.manager.notProvided")}
          />

          {/* EVIDENCE — what was submitted, if anything */}
          <div className="space-y-1.5">
            <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
              {t("venture.manager.evidence")}
            </p>
            {deliverable.attachment_url ? (
              <a
                href={deliverable.evidence_download_url || deliverable.attachment_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold hover:underline break-all"
                style={{ color: "var(--brand-orange)" }}
              >
                {deliverable.attachment_name || t("venture.manager.viewEvidence")}
              </a>
            ) : (
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {t("venture.manager.notProvided")}
              </p>
            )}
          </div>

          {/* SUBMIT — only where the caller provides the evidence form */}
          {submit && (
            <div
              className="rounded-xl border p-3 space-y-2"
              style={{ borderColor: "var(--border-primary)", backgroundColor: "var(--surface-2)" }}
            >
              <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
                {t("venture.submitForReview")}
              </p>
              <input
                type="file"
                onChange={(event) =>
                  submit.setDrafts((prev) => ({
                    ...prev,
                    [deliverable.id]: { ...(prev[deliverable.id] || {}), file: event.target.files?.[0] || null },
                  }))
                }
                className="w-full text-[11px]"
                style={{ color: "var(--text-secondary)" }}
              />
              <p className="text-[9px] uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
                {t("venture.manager.attachFile")}
              </p>
              <p className="text-[9px] uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
                {t("venture.manager.orPasteLink")}
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                <input
                  value={(submit.drafts[deliverable.id] || {}).url || ""}
                  onChange={(event) =>
                    submit.setDrafts((prev) => ({
                      ...prev,
                      [deliverable.id]: { ...(prev[deliverable.id] || {}), url: event.target.value },
                    }))
                  }
                  placeholder={t("venture.urlPlaceholder")}
                  className="flex-1 min-w-[160px] px-2.5 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
                />
                <button
                  type="button"
                  onClick={() => submit.onSubmit(deliverable.id)}
                  className="px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest text-black"
                  style={{ backgroundColor: "var(--brand-orange)" }}
                >
                  {t("venture.submitForReview")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </AppModal>
  );
}

/** One labelled block of the dialog — the same shape for every field. */
function DetailField({ label, value }) {
  return (
    <div className="space-y-1">
      <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
        {label}
      </p>
      <p className="text-xs whitespace-pre-line break-words" style={{ color: "var(--text-primary)" }}>
        {value}
      </p>
    </div>
  );
}

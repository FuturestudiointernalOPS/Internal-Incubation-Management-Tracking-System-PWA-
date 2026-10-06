"use client";

import React from "react";
import { Flag, Link2 } from "lucide-react";
import AppModal from "@/components/ui/AppModal";
import { useI18n } from "@/lib/i18n";
import { statusLabel, statusChipClass } from "@/lib/ventureStatuses";
import { formatDay } from "./projectFormat";

/**
 * ONE work item, in full.
 *
 * The layout is the point: the chain is rendered top to bottom — the work, then
 * the Activity that produces it, then the Deliverable, then what makes that
 * Deliverable complete — with people and timing kept out of the prose as a
 * metadata block. The previous attempt at this information put Activity,
 * Deliverable and Definition of Done into one paragraph, and the relationship
 * between them was the first thing a reader lost.
 *
 * Read-only: nothing here writes, by design (Phase 1).
 */

/** A labelled block of the full context (Activity / Deliverable / Definition of Done). */
function Section({ label, children }) {
  return (
    <div>
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

/** One label → value pair of the metadata block. */
function Field({ label, children }) {
  return (
    <div className="min-w-0">
      <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-tertiary)]">{label}</p>
      <p className="text-xs font-semibold text-[var(--text-primary)] break-words mt-0.5">{children}</p>
    </div>
  );
}

export default function WorkItemDetailModal({ item, onClose }) {
  const { t, lang } = useI18n();
  if (!item) return null;

  const kindLabel = t(`venture.projects.kind.${item.kind}`);
  const dependencies = item.depends_on || [];

  return (
    <AppModal isOpen={Boolean(item)} onClose={onClose} title={item.title || kindLabel} size="lg">
      <div className="space-y-5">
        {/* Which kind of work this is, and the tracker's own reference. */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-[var(--surface-2)] text-[var(--text-secondary)]">
            {kindLabel}
          </span>
          {item.ref && (
            <span className="text-[9px] font-black px-2 py-0.5 rounded bg-[var(--surface-2)] text-[var(--brand-orange)]">
              {item.ref}
            </span>
          )}
          <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${statusChipClass(item.status)}`}>
            {statusLabel(item.status, t)}
          </span>
        </div>

        {/* PEOPLE AND TIMING — metadata, never mixed into the descriptive text. */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-1)] p-3">
          <Field label={t("venture.manager.milestoneOwner")}>
            {item.owner ? (
              <span className="inline-flex items-center gap-1.5 flex-wrap">
                {item.owner.name}
                {item.owner.external && (
                  <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--surface-3)] text-[var(--text-tertiary)]">
                    {t("venture.personField.external")}
                  </span>
                )}
              </span>
            ) : (
              <span className="text-[var(--text-tertiary)]">{t("venture.manager.notProvided")}</span>
            )}
          </Field>
          <Field label={t("venture.manager.supporting")}>
            {item.supporting || <span className="text-[var(--text-tertiary)]">{t("venture.manager.notProvided")}</span>}
          </Field>
          <Field label={t("venture.manager.startDate")}>
            {item.start ? formatDay(item.start, lang) : <span className="text-[var(--text-tertiary)]">—</span>}
          </Field>
          <Field label={t("venture.manager.finishDate")}>
            {item.finish ? formatDay(item.finish, lang) : <span className="text-[var(--text-tertiary)]">—</span>}
          </Field>
          <Field label={t("venture.projects.journey")}>
            {item.journey?.name || <span className="text-[var(--text-tertiary)]">{t("venture.manager.notProvided")}</span>}
          </Field>
          <Field label={t("venture.projects.milestone")}>
            {item.milestone?.title || <span className="text-[var(--text-tertiary)]">{t("venture.manager.notProvided")}</span>}
          </Field>
          {item.parent && (
            <Field label={t("venture.projects.parent")}>
              <span className="text-[var(--text-secondary)]">{item.parent.title}</span>
            </Field>
          )}
        </div>

        {/* ACTIVITY -> DELIVERABLE -> DEFINITION OF DONE, each its own block. */}
        <Section label={t("venture.manager.activityLabel")}>
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            {item.activity || <span className="text-[var(--text-tertiary)] font-normal">{t("venture.manager.notProvided")}</span>}
          </p>
        </Section>

        <Section label={t("venture.manager.deliverableLabel")}>
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            {item.deliverable || <span className="text-[var(--text-tertiary)] font-normal">{t("venture.manager.notProvided")}</span>}
          </p>
        </Section>

        <Section label={t("venture.manager.definitionOfDone")}>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            {item.definition_of_done || <span className="italic">{t("venture.manager.notProvided")}</span>}
          </p>
        </Section>

        {dependencies.length > 0 && (
          <Section label={t("venture.projects.dependsOn")}>
            <ul className="space-y-1">
              {dependencies.map((dependency) => (
                <li key={dependency.id} className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                  <Link2 className="w-3 h-3 shrink-0" />
                  <span className="break-words">{dependency.label}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {(item.blocks || []).length > 0 && (
          <Section label={t("venture.projects.blocks")}>
            <ul className="space-y-1">
              {item.blocks.map((blocked) => (
                <li key={blocked.id} className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                  <Flag className="w-3 h-3 shrink-0" />
                  <span className="break-words">{blocked.label}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </AppModal>
  );
}

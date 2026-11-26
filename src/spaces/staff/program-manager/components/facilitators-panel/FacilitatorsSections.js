"use client";

import { Mail, Plus, Search } from "lucide-react";
import AssignedFacilitatorCard from "./AssignedFacilitatorCard";
import FacilitatorReviewCard from "./FacilitatorReviewCard";
import { FACILITATOR_CAPS } from "./capabilities";

/**
 * The program-facilitators panel's DISPLAY sections, extracted verbatim from
 * FacilitatorsPanel.js into the panel's own folder. Each section owns no state,
 * runs no read and calls no endpoint — it renders the values it is handed and
 * calls the action callbacks the parent passes down. The parent keeps the reads,
 * the state and the writes.
 */

/** Search any contact and add them to the program's facilitator group. */
export function AddFacilitatorSection({
  t,
  search,
  setSearch,
  busy,
  filteredPool,
  onAdd,
  conflictError,
  programName,
  programId,
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
        {t("pmMisc.facilitators.addSectionTitle")}
      </h2>
      {conflictError && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-rose-400">{t("errors.roleConflictParticipantFacilitator")}</p>
          <a
            href={`mailto:info@futurestudio.bj?subject=${encodeURIComponent(t("pmMisc.facilitators.conflictSubject", { program: programName || programId }))}&body=${encodeURIComponent(t("pmMisc.facilitators.conflictBody", { name: conflictError.name, email: conflictError.email, program: programName || programId }))}`}
            className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--brand-orange)] hover:underline"
          >
            <Mail className="w-3.5 h-3.5" /> {t("pmMisc.facilitators.contactSupport")}
          </a>
        </div>
      )}

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("pmMisc.facilitators.searchPlaceholder")}
          className="w-full bg-primary border border-[var(--border-primary)] rounded-xl pl-10 pr-3 py-3 text-[11px] font-bold outline-none focus:border-[var(--brand-orange)]"
        />
      </div>
      <div className="max-h-48 overflow-y-auto space-y-1.5">
        {filteredPool.map((contact) => (
          <button
            key={contact.cid}
            disabled={busy}
            onClick={() => onAdd(contact)}
            className="w-full flex items-center justify-between gap-2 p-3 rounded-xl border border-dashed border-[var(--border-primary)] hover:border-[var(--brand-orange)] text-left transition-all"
          >
            <span className="text-[10px] font-bold uppercase truncate">{contact.name}</span>
            <span className="text-[10px] font-medium text-[var(--text-secondary)] truncate">{contact.email}</span>
            <Plus className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
          </button>
        ))}
        {search.trim() && filteredPool.length === 0 && (
          <p className="text-sm text-[var(--text-secondary)]">
            {t("pmMisc.facilitators.noContacts")}
          </p>
        )}
      </div>

      <p className="text-sm text-[var(--text-secondary)]">
        {t("pmMisc.facilitators.inviteHint")}
      </p>
    </section>
  );
}

/** Assigned-groups-only vs. all participants of the program. */
export function ParticipantScopeSection({ t, scope, onChange }) {
  return (
    <section className="space-y-3">
      <h2 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
        {t("pmMisc.facilitators.participantScope")}
      </h2>
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onChange({ facilitator_scope: "assigned_groups" })}
          className={`p-4 rounded-2xl border text-left transition-all ${scope !== "all" ? "bg-brand-orange/10 border-[var(--brand-orange)]" : "bg-secondary border-[var(--border-primary)]"}`}
        >
          <p className="text-[11px] font-bold uppercase tracking-wide">{t("pmMisc.facilitators.assignedGroupsOnly")}</p>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {t("pmMisc.facilitators.assignedGroupsDesc")}
          </p>
        </button>
        <button
          onClick={() => onChange({ facilitator_scope: "all" })}
          className={`p-4 rounded-2xl border text-left transition-all ${scope === "all" ? "bg-brand-orange/10 border-[var(--brand-orange)]" : "bg-secondary border-[var(--border-primary)]"}`}
        >
          <p className="text-[11px] font-bold uppercase tracking-wide">{t("pmMisc.facilitators.allParticipants")}</p>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {t("pmMisc.facilitators.allParticipantsDesc")}
          </p>
        </button>
      </div>
    </section>
  );
}

/** The capabilities a newly added facilitator gets by default. */
export function DefaultPermissionsSection({ t, defaultPerms, onToggle }) {
  return (
    <section className="space-y-3">
      <h2 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
        {t("pmMisc.facilitators.defaultPermissions")}
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {FACILITATOR_CAPS.map((capability) => {
          const active = !!defaultPerms[capability.key];
          return (
            <button
              key={capability.key}
              onClick={() => onToggle(capability.key)}
              className={`p-3 rounded-xl border text-left text-[10px] font-bold uppercase transition-all ${active ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" : "bg-secondary border-[var(--border-primary)] text-[var(--text-secondary)]"}`}
            >
              {t(capability.label)}
              {active ? " ✓" : ""}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** The people currently in the program's facilitator group. */
export function AssignedFacilitatorsSection({ t, facilitators, onRemove, onToggleOverride }) {
  return (
    <section className="space-y-3">
      <h2 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
        {t("pmMisc.facilitators.assignedFacilitators")}
      </h2>
      <div className="space-y-3">
        {facilitators.map((facilitator) => (
          <AssignedFacilitatorCard
            key={facilitator.id}
            facilitator={facilitator}
            t={t}
            onRemove={() => onRemove(facilitator)}
            onToggleOverride={(capKey) => onToggleOverride(facilitator, capKey)}
          />
        ))}
        {facilitators.length === 0 && (
          <p className="text-sm text-[var(--text-secondary)] py-4 text-center">
            {t("pmMisc.facilitators.noneAssigned")}
          </p>
        )}
      </div>
    </section>
  );
}

/** One lead facilitator per participant group. */
export function LeadFacilitatorSection({ t, families, facilitators, onSetLead }) {
  return (
    <section className="space-y-3">
      <h2 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
        {t("pmMisc.facilitators.leadPerGroup")}
      </h2>
      <div className="space-y-2">
        {families.map((group) => (
          <div key={group.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-[var(--border-primary)] bg-secondary">
            <span className="text-[10px] font-black uppercase truncate">{group.name}</span>
            <select
              value={group.lead_facilitator_id || ""}
              onChange={(event) => onSetLead(group.id, event.target.value || null)}
              className="bg-primary border border-[var(--border-primary)] rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none cursor-pointer max-w-[45%]"
            >
              <option value="">{t("pmMisc.facilitators.noneOption")}</option>
              {facilitators.map((facilitator) => (
                <option key={facilitator.cid} value={facilitator.cid}>{facilitator.name}</option>
              ))}
            </select>
          </div>
        ))}
        {families.length === 0 && (
          <p className="text-sm text-[var(--text-secondary)]">
            {t("pmMisc.facilitators.noGroups")}
          </p>
        )}
      </div>
    </section>
  );
}

/** Facilitator reviews with the PM decision and note. */
export function FacilitatorReviewsSection({ t, reviews, decisionInputs, onNoteChange, onDecision }) {
  return (
    <section className="space-y-3">
      <h2 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
        {t("pmMisc.facilitators.reviews")}
      </h2>
      <div className="space-y-3">
        {reviews.length === 0 && (
          <p className="text-sm text-[var(--text-secondary)] py-4 text-center">
            {t("pmMisc.facilitators.noReviews")}
          </p>
        )}
        {reviews.map((review) => (
          <FacilitatorReviewCard
            key={review.id}
            review={review}
            t={t}
            note={decisionInputs[review.id]?.note || ""}
            onNoteChange={(value) => onNoteChange(review.id, value)}
            onDecision={(decision) => onDecision(review.id, decision)}
          />
        ))}
      </div>
    </section>
  );
}

"use client";

import { Search, Plus } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { FACILITATOR_CAPS } from "./constants";

/** Programme facilitators: scope, default permissions, assignments, invites and leads. */
export default function ProgramFacilitatorsSection({
  editingProgram,
  setEditingProgram,
  onToggleFacDefault,
  onToggleFacOverride,
  onRemoveFacilitator,
  inviteForm,
  setInviteForm,
  facBusy,
  onCreateFacilitator,
  facilitatorSearch,
  setFacilitatorSearch,
  facilitatorPool,
  onAddFacilitator,
  notes,
  onSetLeadFacilitator,
}) {
  const { t } = useI18n();

  return (
    <div className="space-y-3 mt-4 pt-4 border-t border-divider/40">
      <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">
        {t("adminMisc.programs.programFacilitatorsTitle")}
      </label>
      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] ml-2">
        {t("adminMisc.programs.programFacilitatorsHint")}
      </p>

      {/* Scope toggle */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() =>
            setEditingProgram({
              ...editingProgram,
              facilitator_scope: "assigned_groups",
            })
          }
          className={`p-3 rounded-xl border text-left transition-all ${
            editingProgram?.facilitator_scope !== "all"
              ? "bg-brand-orange/10 border-[var(--brand-orange)]"
              : "bg-secondary border-[var(--border-primary)]"
          }`}
        >
          <p
            className={`text-[10px] font-bold uppercase ${editingProgram?.facilitator_scope !== "all" ? "text-[var(--brand-orange)]" : "text-[var(--text-secondary)]"}`}
          >
            {t("adminMisc.programs.scopeAssignedGroups")}
          </p>
          <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-1">
            {t("adminMisc.programs.scopeAssignedGroupsHint")}
          </p>
        </button>
        <button
          type="button"
          onClick={() =>
            setEditingProgram({
              ...editingProgram,
              facilitator_scope: "all",
            })
          }
          className={`p-3 rounded-xl border text-left transition-all ${
            editingProgram?.facilitator_scope === "all"
              ? "bg-brand-orange/10 border-[var(--brand-orange)]"
              : "bg-secondary border-[var(--border-primary)]"
          }`}
        >
          <p
            className={`text-[10px] font-bold uppercase ${editingProgram?.facilitator_scope === "all" ? "text-[var(--brand-orange)]" : "text-[var(--text-secondary)]"}`}
          >
            {t("adminMisc.programs.scopeAll")}
          </p>
          <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-1">
            {t("adminMisc.programs.scopeAllHint")}
          </p>
        </button>
      </div>

      {/* Default permissions */}
      <div className="p-3 bg-primary rounded-2xl border border-[var(--border-primary)] space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
          {t("adminMisc.programs.defaultPermissionsTitle")}
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {FACILITATOR_CAPS.map((cap) => {
            const active = !!(
              editingProgram?.facilitator_default_permissions || {}
            )[cap.key];
            return (
              <button
                key={cap.key}
                type="button"
                onClick={() => onToggleFacDefault(cap.key)}
                className={`text-[10px] font-bold uppercase px-1.5 py-1.5 rounded-lg border text-left truncate transition-all ${
                  active
                    ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                    : "bg-secondary border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--brand-orange)]"
                }`}
              >
                {t(`adminMisc.programs.${cap.labelKey}`)}
                {active ? " ✓" : ""}
              </button>
            );
          })}
        </div>
      </div>

      {/* Assigned facilitators */}
      <div className="p-3 bg-primary rounded-2xl border border-[var(--border-primary)] space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
          {t("adminMisc.programs.assignedFacilitatorsTitle")}
        </p>
        {(editingProgram?.facilitators || []).length === 0 && (
          <p className="text-[10px] font-medium text-[var(--text-secondary)]">
            {t("adminMisc.programs.noFacilitatorsAssigned")}
          </p>
        )}
        {(editingProgram?.facilitators || []).map((fac) => (
          <div
            key={fac.id}
            className="rounded-xl border border-[var(--border-primary)] p-2.5 space-y-2 bg-secondary"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase truncate">
                  {fac.name || fac.email || fac.cid}
                </p>
                <p className="text-[10px] font-medium text-[var(--text-secondary)] truncate">
                  {fac.email && fac.email !== fac.name ? fac.email : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onRemoveFacilitator(fac)}
                className="text-[10px] font-bold uppercase text-rose-400 hover:underline shrink-0"
              >
                {t("adminMisc.programs.remove")}
              </button>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
              {t("adminMisc.programs.individualOverridesTitle")}
            </p>
            <div className="grid grid-cols-2 gap-1">
              {FACILITATOR_CAPS.map((cap) => {
                const active = !!(fac.permissions || {})[cap.key];
                return (
                  <button
                    key={cap.key}
                    type="button"
                    onClick={() => onToggleFacOverride(fac, cap.key)}
                    className={`text-[10px] font-bold uppercase px-1.5 py-1 rounded-lg border text-left truncate transition-all ${
                      active
                        ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-400"
                        : "bg-primary border-[var(--border-primary)] text-[var(--text-secondary)]"
                    }`}
                  >
                    {t(`adminMisc.programs.${cap.labelKey}`)}
                    {active ? " ✓" : ""}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Add facilitator */}
      <div className="p-3 bg-primary rounded-2xl border border-[var(--border-primary)] space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
          {t("adminMisc.programs.addFacilitatorTitle")}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <input
            value={inviteForm.name}
            onChange={(e) =>
              setInviteForm({ ...inviteForm, name: e.target.value })
            }
            placeholder={t(
              "adminMisc.programs.newFacilitatorNamePlaceholder",
            )}
            className="bg-primary border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-[10px] font-bold outline-none focus:border-[var(--brand-orange)]"
          />
          <input
            value={inviteForm.email}
            onChange={(e) =>
              setInviteForm({ ...inviteForm, email: e.target.value })
            }
            placeholder={t(
              "adminMisc.programs.newFacilitatorEmailPlaceholder",
            )}
            className="bg-primary border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-[10px] font-bold outline-none focus:border-[var(--brand-orange)]"
          />
        </div>
        <button
          type="button"
          disabled={facBusy}
          onClick={onCreateFacilitator}
          className="w-full text-[10px] font-bold uppercase px-3 py-2 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 hover:bg-blue-500/25 transition-all"
        >
          {t("adminMisc.programs.createAndInviteFacilitator")}
        </button>
        <p className="text-[10px] font-medium text-[var(--text-secondary)]">
          {t("adminMisc.programs.createAndInviteHint")}
        </p>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
          <input
            value={facilitatorSearch}
            onChange={(e) => setFacilitatorSearch(e.target.value)}
            placeholder={t(
              "adminMisc.programs.searchFacilitatorPlaceholder",
            )}
            className="w-full bg-primary border border-[var(--border-primary)] rounded-xl pl-9 pr-3 py-2.5 text-[10px] font-bold outline-none focus:border-[var(--brand-orange)]"
          />
        </div>
        <div className="max-h-36 overflow-y-auto space-y-1">
          {facilitatorPool
            .filter(
              (c) =>
                !(editingProgram?.facilitators || []).some(
                  (f) => f.cid === c.cid,
                ),
            )
            .filter(
              (c) =>
                c.role !== "participant" &&
                c.role !== "applicant" &&
                c.role !== "student",
            )
            .filter(
              (c) =>
                !facilitatorSearch ||
                (c.name || "")
                  .toLowerCase()
                  .includes(facilitatorSearch.toLowerCase()) ||
                (c.email || "")
                  .toLowerCase()
                  .includes(facilitatorSearch.toLowerCase()),
            )
            .map((contact) => (
              <button
                key={contact.cid}
                type="button"
                disabled={facBusy}
                onClick={() => onAddFacilitator(contact)}
                className="w-full flex items-center justify-between gap-2 p-2 rounded-lg border border-dashed border-[var(--border-primary)] hover:border-[var(--brand-orange)] text-left transition-all"
              >
                <span className="text-[10px] font-bold uppercase truncate">
                  {contact.name || contact.email}
                </span>
                <span className="text-[10px] font-medium text-[var(--text-secondary)] truncate">
                  {contact.email && contact.email !== contact.name
                    ? contact.email
                    : ""}
                </span>
                <Plus className="w-3 h-3 shrink-0 text-emerald-400" />
              </button>
            ))}
          {facilitatorPool.length === 0 && (
            <p className="text-[10px] font-medium text-[var(--text-secondary)]">
              {t("adminMisc.programs.noContactsInFacilitatorGroup")}
            </p>
          )}
        </div>
      </div>

      {/* Lead facilitator per group */}
      <div className="p-3 bg-primary rounded-2xl border border-[var(--border-primary)] space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
          {t("adminMisc.programs.leadFacilitatorPerGroupTitle")}
        </p>
        {(editingProgram?.assigned_segments || []).map((segmentId) => {
          const family = (Array.isArray(notes) ? notes : []).find(
            (n) => String(n.id) === String(segmentId),
          );
          if (!family) return null;
          return (
            <div
              key={segmentId}
              className="flex items-center justify-between gap-2"
            >
              <span className="text-[10px] font-bold uppercase truncate">
                {family.name}
              </span>
              <select
                value={family.lead_facilitator_id || ""}
                onChange={(e) =>
                  onSetLeadFacilitator(family.id, e.target.value || null)
                }
                className="bg-primary border border-[var(--border-primary)] rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none cursor-pointer max-w-[45%]"
              >
                <option value="">{t("adminMisc.programs.noneOption")}</option>
                {(editingProgram?.facilitators || []).map((fac) => (
                  <option key={fac.cid} value={fac.cid}>
                    {fac.name}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
        {(editingProgram?.assigned_segments || []).length === 0 && (
          <p className="text-[10px] font-medium text-[var(--text-secondary)]">
            {t("adminMisc.programs.assignGroupsForLeadFacilitatorHint")}
          </p>
        )}
      </div>
    </div>
  );
}

"use client";

import { Trash2 } from "lucide-react";

/**
 * Assigned-roles modal of the Access Profiles editor.
 *
 * The roles list is read-only by default (chips behind the modal trigger); this
 * modal holds the add/remove controls. Moved verbatim out of
 * `AccessProfilesView.js` — the parent keeps every piece of state and every
 * write, and passes them here by name.
 */
export default function ProfileRoleDefaultsModal({
  t,
  selectedIsDefaultFor,
  removeRoleDefault,
  removeBusy,
  defaultRoleChoice,
  setDefaultRoleChoice,
  allRoles,
  assignRoleDefault,
  defaultRoleBusy,
  defaultRoleMsg,
  defaultRoleErr,
  removeMsg,
  removeErr,
  onClose,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.7)" }}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-md rounded-2xl p-6 shadow-2xl"
        style={{
          background: "var(--surface-1)",
          border: "1px solid var(--border-primary)",
        }}
      >
        <h4
          className="text-sm font-black uppercase tracking-tight"
          style={{ color: "var(--text-primary)" }}
        >
          {t("engineering.permissions.rolesEditTitle")}
        </h4>
        <p
          className="text-[10px] font-black uppercase tracking-widest mt-4"
          style={{ color: "var(--text-secondary)" }}
        >
          {t("engineering.permissions.defaultForTitle")}
        </p>

        <div className="space-y-1.5 mt-2">
          {selectedIsDefaultFor.length > 0 ? (
            selectedIsDefaultFor.map((role) => (
              <div
                key={role}
                className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2"
                style={{ borderColor: "var(--border-primary)" }}
              >
                <span
                  className="text-[10px] font-bold uppercase tracking-wide"
                  style={{ color: "var(--text-primary)" }}
                >
                  {role.replace(/_/g, " ")}
                </span>
                <button
                  onClick={() => removeRoleDefault(role)}
                  disabled={removeBusy === role}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/10 text-[10px] font-bold text-red-400 uppercase tracking-widest hover:bg-red-500/20 transition-all disabled:opacity-40"
                >
                  <Trash2 className="w-3 h-3" />{" "}
                  {t("engineering.permissions.rolesRemove")}
                </button>
              </div>
            ))
          ) : (
            <p
              className="text-[10px] font-bold"
              style={{ color: "var(--text-secondary)" }}
            >
              {t("engineering.permissions.defaultForNone")}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-4">
          <select
            value={defaultRoleChoice}
            onChange={(event) => setDefaultRoleChoice(event.target.value)}
            aria-label={t("engineering.permissions.defaultForTitle")}
            className="bg-secondary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-brand-orange/50 focus-visible:ring-2 focus-visible:ring-brand-orange/40"
          >
            <option value="">
              {t("engineering.permissions.defaultForPick")}
            </option>
            {(allRoles || [])
              .filter((role) => !selectedIsDefaultFor.includes(role))
              .map((role) => (
                <option key={role} value={role}>
                  {role.replace(/_/g, " ")}
                </option>
              ))}
          </select>
          <button
            onClick={assignRoleDefault}
            disabled={!defaultRoleChoice || defaultRoleBusy}
            className="px-3 py-2 rounded-lg bg-[var(--brand-orange)] text-black text-[10px] font-black uppercase tracking-widest disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60"
          >
            {t("engineering.permissions.rolesAdd")}
          </button>
        </div>

        {defaultRoleMsg && (
          <p className="text-[10px] font-bold text-emerald-400 mt-2">
            {defaultRoleMsg}
          </p>
        )}
        {defaultRoleErr && (
          <p className="text-[10px] font-bold text-red-400 mt-2">
            {defaultRoleErr}
          </p>
        )}
        {removeMsg && (
          <p className="text-[10px] font-bold text-emerald-400 mt-2">
            {removeMsg}
          </p>
        )}
        {removeErr && (
          <p className="text-[10px] font-bold text-red-400 mt-2">
            {removeErr}
          </p>
        )}

        <div className="flex justify-end mt-5">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-secondary border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-widest hover:bg-tertiary transition-all"
          >
            {t("engineering.permissions.close")}
          </button>
        </div>
      </div>
    </div>
  );
}

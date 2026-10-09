"use client";

import React from "react";
import { AlertTriangle, X } from "lucide-react";

/**
 * The creation form of the Profiles screen (profiles takeover).
 *
 * Cut out of `ProfilesView.js`: the panel keeps the state and the POST, this
 * block only renders the fields. A profile is DYNAMIC — the key is a free
 * identifier, the label is the display name and the context is a display group.
 */
export default function ProfileCreateForm({ ctx }) {
  const {
    t,
    createOpen,
    newProfile,
    setNewProfile,
    contexts,
    createBusy,
    createErr,
    baselineRoles,
    toggleNewRole,
    submitCreate,
    closeCreate,
  } = ctx;

  if (!createOpen) return null;

  return (
    <div className="ios-card !p-5 border-[var(--border-primary)] space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-wider">
          {t("engineering.permissions.profilesCreateTitle")}
        </h4>
        <button
          onClick={closeCreate}
          className="p-1 rounded-lg hover:bg-tertiary text-[var(--text-secondary)]"
          aria-label={t("common.cancel")}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {createErr && (
        <p className="flex items-center gap-2 text-xs font-bold text-red-500">
          <AlertTriangle className="w-3.5 h-3.5" /> {createErr}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
            {t("engineering.permissions.profilesCreateKey")}
          </span>
          <input
            value={newProfile.key}
            onChange={(event) => setNewProfile({ ...newProfile, key: event.target.value })}
            placeholder="auditor"
            className="bg-secondary border border-[var(--border-primary)] rounded-lg px-2 py-1.5 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-brand-orange/50"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
            {t("engineering.permissions.profilesCreateLabel")}
          </span>
          <input
            value={newProfile.label}
            onChange={(event) => setNewProfile({ ...newProfile, label: event.target.value })}
            placeholder="Auditor"
            className="bg-secondary border border-[var(--border-primary)] rounded-lg px-2 py-1.5 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-brand-orange/50"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
            {t("engineering.permissions.profilesCreateContext")}
          </span>
          <select
            value={newProfile.context}
            onChange={(event) => setNewProfile({ ...newProfile, context: event.target.value })}
            className="bg-secondary border border-[var(--border-primary)] rounded-lg px-2 py-1.5 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-brand-orange/50"
          >
            {contexts.map((ctxKey) => (
              <option key={ctxKey} value={ctxKey}>
                {t(`engineering.permissions.contextRolesContexts.${ctxKey}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-3">
        {baselineRoles.map((role) => (
          <label
            key={role}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]"
          >
            <input
              type="checkbox"
              checked={newProfile.allowed_roles.includes(role)}
              onChange={() => toggleNewRole(role)}
              className="accent-[var(--brand-orange)]"
            />
            {t(`engineering.permissions.profilesRoles.${role}`)}
          </label>
        ))}
      </div>
      <button
        onClick={submitCreate}
        disabled={createBusy || !newProfile.key.trim() || !newProfile.label.trim()}
        className="px-4 py-2 rounded-xl bg-[var(--brand-orange)] text-black text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-40"
      >
        {createBusy
          ? t("engineering.permissions.profilesSaving")
          : t("engineering.permissions.profilesCreateSubmit")}
      </button>
    </div>
  );
}

"use client";

import React from "react";
import { Trash2 } from "lucide-react";

/**
 * The profile catalogue of the Profiles screen (profiles takeover).
 *
 * Cut out of `ProfilesView.js`: the panel keeps the state and the writes, this
 * block renders the table (above `md`) and the same fields as cards (below), so
 * no control is hidden on a small screen.
 */
export default function ProfileCatalogue({ ctx }) {
  const {
    t,
    profiles,
    drafts,
    busyKey,
    isDirty,
    profileLabel,
    baselineRoles,
    toggleRole,
    setField,
    save,
    removeProfile,
    openProfile,
    selectedKey,
  } = ctx;

  const roleChecks = (row, draft) => (
    <div className="flex flex-wrap gap-3">
      {baselineRoles.map((role) => (
        <label
          key={role}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]"
        >
          <input
            type="checkbox"
            checked={(draft.allowed_roles || []).includes(role)}
            onChange={() => toggleRole(row, role)}
            className="accent-[var(--brand-orange)]"
          />
          {t(`engineering.permissions.profilesRoles.${role}`)}
        </label>
      ))}
    </div>
  );

  return (
    <>
      <div className="hidden md:block overflow-x-auto rounded-xl border border-[var(--border-primary)] bg-secondary/40">
        <table className="w-full text-left border-collapse min-w-[900px]">
          <thead>
            <tr className="border-b border-[var(--border-primary)]">
              {[
                "profilesKey",
                "contextRolesContext",
                "profilesAllowedRoles",
                "profilesActive",
                "profilesNotes",
                "profilesCapabilitiesCount",
              ].map((key) => (
                <th
                  key={key}
                  className="p-3 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]"
                >
                  {t(`engineering.permissions.${key}`)}
                </th>
              ))}
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {profiles.map((row) => {
              const key = row.key;
              const draft = drafts[key] || {};
              const dirty = isDirty(row);
              const isSelected = selectedKey === key;
              return (
                <tr
                  key={key}
                  className={`border-b border-divider/50 align-top ${isSelected ? "bg-brand-orange/5" : ""}`}
                >
                  <td className="p-3 text-xs font-bold text-[var(--text-primary)]">
                    {profileLabel(row)}
                    <span className="ml-2 font-medium text-[10px] text-[var(--text-secondary)] opacity-70">
                      {row.key}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="inline-block px-2 py-1 rounded-md bg-primary border border-[var(--border-primary)] text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                      {t(`engineering.permissions.contextRolesContexts.${row.context}`)}
                    </span>
                  </td>
                  <td className="p-3">{roleChecks(row, draft)}</td>
                  <td className="p-3 text-center">
                    <input
                      type="checkbox"
                      checked={Boolean(draft.is_active)}
                      onChange={(event) => setField(row, "is_active", event.target.checked)}
                      className="accent-[var(--brand-orange)]"
                    />
                  </td>
                  <td className="p-3">
                    <input
                      value={draft.notes || ""}
                      onChange={(event) => setField(row, "notes", event.target.value)}
                      className="w-full bg-secondary border border-[var(--border-primary)] rounded-lg px-2 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-brand-orange/50"
                    />
                  </td>
                  <td className="p-3 text-center text-xs font-bold text-[var(--text-primary)]">
                    {row.capability_count ?? 0}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openProfile(key)}
                        className="px-2 py-1 rounded-lg bg-secondary border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-widest text-[var(--text-primary)] hover:bg-tertiary"
                      >
                        {t("engineering.permissions.profilesEditCapabilities")}
                      </button>
                      <button
                        onClick={() => save(row)}
                        disabled={!dirty || busyKey === key}
                        className="px-2 py-1 rounded-lg bg-[var(--brand-orange)] text-black text-[10px] font-black uppercase tracking-widest disabled:opacity-40"
                      >
                        {busyKey === key
                          ? t("engineering.permissions.profilesSaving")
                          : t("engineering.permissions.profilesSave")}
                      </button>
                      <button
                        onClick={() => removeProfile(row)}
                        aria-label={t("engineering.permissions.profilesDeleteTitle")}
                        className="p-1.5 rounded-lg hover:bg-tertiary text-[var(--text-secondary)] hover:text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Small screens: the same fields as cards (no control is hidden) */}
      <div className="md:hidden space-y-3">
        {profiles.map((row) => {
          const key = row.key;
          const draft = drafts[key] || {};
          const dirty = isDirty(row);
          return (
            <div
              key={key}
              className="rounded-xl border border-[var(--border-primary)] bg-secondary/30 p-3 space-y-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-[var(--text-primary)]">
                  {profileLabel(row)}
                </span>
                <span className="inline-block px-2 py-1 rounded-md bg-primary border border-[var(--border-primary)] text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                  {t(`engineering.permissions.contextRolesContexts.${row.context}`)}
                </span>
              </div>
              {roleChecks(row, draft)}
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={Boolean(draft.is_active)}
                    onChange={(event) => setField(row, "is_active", event.target.checked)}
                    className="accent-[var(--brand-orange)]"
                  />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                    {t("engineering.permissions.profilesActive")}
                  </span>
                </label>
                <input
                  value={draft.notes || ""}
                  onChange={(event) => setField(row, "notes", event.target.value)}
                  className="flex-1 bg-secondary border border-[var(--border-primary)] rounded-lg px-2 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-brand-orange/50"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => openProfile(key)}
                  className="flex-1 px-3 py-2 rounded-lg bg-secondary border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-widest text-[var(--text-primary)]"
                >
                  {t("engineering.permissions.profilesEditCapabilities")}
                </button>
                <button
                  onClick={() => save(row)}
                  disabled={!dirty || busyKey === key}
                  className="flex-1 px-3 py-2 rounded-lg bg-[var(--brand-orange)] text-black text-[10px] font-black uppercase tracking-widest disabled:opacity-40"
                >
                  {busyKey === key
                    ? t("engineering.permissions.profilesSaving")
                    : t("engineering.permissions.profilesSave")}
                </button>
                <button
                  onClick={() => removeProfile(row)}
                  aria-label={t("engineering.permissions.profilesDeleteTitle")}
                  className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

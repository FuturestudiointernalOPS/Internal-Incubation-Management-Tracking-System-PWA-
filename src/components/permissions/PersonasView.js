"use client";

import React, { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, UserCog } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { defer } from "./effectUtils";

/**
 * PHASE A — Persona catalogue (Permission Center → Rules → Personas).
 *
 * The persona is the contextual function someone occupies (Participant of a
 * program, Founder of a venture, Facilitator…), distinct from the baseline role
 * on their account (Super Admin / Staff / Member). This screen edits, per
 * persona, which BASELINE ROLES may hold it, whether it is active, and a note.
 *
 * The initial rows come from the catalogue; an edit is audited (with an optional
 * reason) and never overwritten by a later reseed. Nothing here changes anyone's
 * effective access yet — this is the vocabulary the later phases enforce.
 */

/** The baseline roles the toggle UI offers (super_admin is a valid value). */
const BASELINE_ROLES = ["super_admin", "staff", "member"];

const rowKey = (row) => row.key;

export default function PersonasView() {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState("");
  const [message, setMsg] = useState("");
  const [err, setErr] = useState("");

  const apply = useCallback((json) => {
    setData(json);
    const next = {};
    for (const row of json.personas || []) {
      next[rowKey(row)] = {
        allowed_roles: Array.isArray(row.allowed_roles) ? [...row.allowed_roles] : [],
        is_active: Number(row.is_active) === 1 || row.is_active === true,
        notes: row.notes || "",
      };
    }
    setDrafts(next);
  }, []);

  const load = useCallback(async () => {
    // No synchronous state write here: the mount effect calls this loader, and
    // react-hooks/set-state-in-effect forbids sync updates in effects.
    try {
      const res = await fetch("/api/engineering/permissions/personas");
      const json = await res.json();
      if (json.success) apply(json);
      else setErr(json.error || t("engineering.permissions.personasLoadFailed"));
    } catch {
      setErr(t("engineering.permissions.personasLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [apply, t]);

  useEffect(() => {
    defer(() => load());
  }, [load]);

  const toggleRole = (row, role) => {
    setDrafts((prev) => {
      const draft = prev[rowKey(row)] || { allowed_roles: [] };
      const has = (draft.allowed_roles || []).includes(role);
      const allowed_roles = has
        ? draft.allowed_roles.filter((item) => item !== role)
        : [...(draft.allowed_roles || []), role];
      return { ...prev, [rowKey(row)]: { ...draft, allowed_roles } };
    });
    setMsg("");
  };

  const setField = (row, field, value) => {
    setDrafts((prev) => ({
      ...prev,
      [rowKey(row)]: { ...prev[rowKey(row)], [field]: value },
    }));
    setMsg("");
  };

  const isDirty = (row) => {
    const draft = drafts[rowKey(row)];
    if (!draft) return false;
    const current = Array.isArray(row.allowed_roles) ? row.allowed_roles : [];
    const draftRoles = draft.allowed_roles || [];
    const sameRoles =
      draftRoles.length === current.length &&
      draftRoles.every((role) => current.includes(role));
    return (
      !sameRoles ||
      draft.is_active !== (Number(row.is_active) === 1 || row.is_active === true) ||
      draft.notes !== (row.notes || "")
    );
  };

  const save = async (row) => {
    const draft = drafts[rowKey(row)];
    if (!draft) return;
    const key = rowKey(row);
    setBusyKey(key);
    setErr("");
    setMsg("");
    try {
      const res = await fetch("/api/engineering/permissions/personas", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: row.key,
          allowed_roles: draft.allowed_roles || [],
          is_active: draft.is_active,
          notes: draft.notes,
          reason: reason.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "save failed");
      setMsg(t("engineering.permissions.personasSaved"));
      await load();
    } catch (error) {
      setErr(error.message || t("engineering.permissions.personasSaveFailed"));
    } finally {
      setBusyKey("");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 animate-spin text-[var(--brand-orange)]" />
      </div>
    );
  }

  const personas = data?.personas || [];
  const personaLabel = (row) =>
    row.label_key ? t(row.label_key) : String(row.key).replace(/_/g, " ");

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--border-primary)] bg-secondary/40 p-4 space-y-1.5">
        <p className="text-xs font-bold text-[var(--text-primary)] leading-relaxed">
          {t("engineering.permissions.personasHint")}
        </p>
        <p className="inline-flex items-center gap-2 px-2 py-1 rounded-md bg-primary border border-[var(--border-primary)] text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
          <UserCog className="w-3 h-3 text-[var(--brand-orange)]" />
          {t("engineering.permissions.personasStatusPill")}
        </p>
      </div>

      {err && (
        <p className="flex items-center gap-2 text-xs font-bold text-red-500">
          <AlertTriangle className="w-3.5 h-3.5" /> {err}
        </p>
      )}
      {message && (
        <p className="flex items-center gap-2 text-xs font-bold text-green-500">
          <CheckCircle2 className="w-3.5 h-3.5" /> {message}
        </p>
      )}

      <div className="hidden md:block overflow-x-auto rounded-xl border border-[var(--border-primary)] bg-secondary/40">
        <table className="w-full text-left border-collapse min-w-[820px]">
          <thead>
            <tr className="border-b border-[var(--border-primary)]">
              <th className="p-3 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                {t("engineering.permissions.personasKey")}
              </th>
              <th className="p-3 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                {t("engineering.permissions.contextRolesContext")}
              </th>
              <th className="p-3 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                {t("engineering.permissions.personasAllowedRoles")}
              </th>
              <th className="p-3 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] text-center">
                {t("engineering.permissions.personasActive")}
              </th>
              <th className="p-3 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                {t("engineering.permissions.personasNotes")}
              </th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {personas.map((row) => {
              const key = rowKey(row);
              const draft = drafts[key] || {};
              const dirty = isDirty(row);
              return (
                <tr key={key} className="border-b border-divider/50 align-top">
                  <td className="p-3 text-xs font-bold text-[var(--text-primary)]">
                    {personaLabel(row)}
                  </td>
                  <td className="p-3">
                    <span className="inline-block px-2 py-1 rounded-md bg-primary border border-[var(--border-primary)] text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                      {t(`engineering.permissions.contextRolesContexts.${row.context}`)}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-3">
                      {BASELINE_ROLES.map((role) => (
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
                          {t(`engineering.permissions.personasRoles.${role}`)}
                        </label>
                      ))}
                    </div>
                  </td>
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
                      className="w-full bg-secondary border border-[var(--border-primary)] rounded-lg px-2 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-brand-orange/50 focus-visible:ring-2 focus-visible:ring-brand-orange/40"
                    />
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => save(row)}
                      disabled={!dirty || busyKey === key}
                      className="px-3 py-1.5 rounded-lg bg-[var(--brand-orange)] text-black text-[10px] font-black uppercase tracking-widest disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60"
                    >
                      {busyKey === key
                        ? t("engineering.permissions.personasSaving")
                        : t("engineering.permissions.personasSave")}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Small screens: the same fields as cards (no control is hidden) */}
      <div className="md:hidden space-y-3">
        {personas.map((row) => {
          const key = rowKey(row);
          const draft = drafts[key] || {};
          const dirty = isDirty(row);
          return (
            <div
              key={key}
              className="rounded-xl border border-[var(--border-primary)] bg-secondary/30 p-3 space-y-2"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-[var(--text-primary)]">
                  {personaLabel(row)}
                </span>
                <span className="inline-block px-2 py-1 rounded-md bg-primary border border-[var(--border-primary)] text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                  {t(`engineering.permissions.contextRolesContexts.${row.context}`)}
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("engineering.permissions.personasAllowedRoles")}
                </span>
                <div className="flex flex-wrap gap-3">
                  {BASELINE_ROLES.map((role) => (
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
                      {t(`engineering.permissions.personasRoles.${role}`)}
                    </label>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={Boolean(draft.is_active)}
                  onChange={(event) => setField(row, "is_active", event.target.checked)}
                  className="accent-[var(--brand-orange)]"
                />
                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("engineering.permissions.personasActive")}
                </span>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("engineering.permissions.personasNotes")}
                </span>
                <input
                  value={draft.notes || ""}
                  onChange={(event) => setField(row, "notes", event.target.value)}
                  className="w-full bg-secondary border border-[var(--border-primary)] rounded-lg px-2 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-brand-orange/50 focus-visible:ring-2 focus-visible:ring-brand-orange/40"
                />
              </label>

              <button
                onClick={() => save(row)}
                disabled={!dirty || busyKey === key}
                className="w-full px-3 py-2 rounded-lg bg-[var(--brand-orange)] text-black text-[10px] font-black uppercase tracking-widest disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60"
              >
                {busyKey === key
                  ? t("engineering.permissions.personasSaving")
                  : t("engineering.permissions.personasSave")}
              </button>
            </div>
          );
        })}
      </div>

      <input
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder={t("engineering.permissions.personasReasonPlaceholder")}
        className="w-full max-w-xl rounded-lg border border-[var(--border-primary)] bg-surface-1 px-3 py-2 text-xs font-bold text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] placeholder:opacity-60 focus:outline-none focus:border-[var(--brand-orange)]"
      />
    </div>
  );
}

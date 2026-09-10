"use client";

import React, { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Link2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import Badge from "./ui/Badge";
import { defer } from "./effectUtils";

/**
 * Context roles whose access is scope-derived by design — no profile mapping
 * should be added. A learner reaches courses through lms_enrollments (scope),
 * while the lms.* capabilities gate course AUTHORING, not learning.
 */
const SCOPE_DERIVED_ROLES = new Set(["lms:learner"]);

/** mapped | scopeDerived | gap — the status badge in both renderings. */
function roleStatus(row) {
  const mapped = !(row.profile_id === null || row.profile_id === undefined);
  if (mapped) return "mapped";
  return SCOPE_DERIVED_ROLES.has(`${row.context}:${row.role_key}`)
    ? "scopeDerived"
    : "gap";
}

/**
 * PHASE 4 — Context Role → Profile registry (Permission Center).
 *
 * Maps each contextual role (what someone IS inside a Program / Venture /
 * Learning / Investor context) to the access profile that should seed their
 * capabilities. Governance surface only: the resolver does not read the
 * registry yet, so nothing here changes anyone's effective access.
 *
 * Rows with no mapped profile stay visible as "— no default —" — an open gap
 * is shown, never hidden. Edits are audited (with an optional reason).
 */
export default function ContextRolesView() {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const rowKey = (row) => `${row.context}:${row.role_key}`;

  const apply = useCallback((json) => {
    setData(json);
    const next = {};
    for (const row of json.roles || []) {
      next[rowKey(row)] = {
        profile_id:
          row.profile_id === null || row.profile_id === undefined
            ? ""
            : String(row.profile_id),
        is_active: Number(row.is_active) === 1 || row.is_active === true,
        notes: row.notes || "",
      };
    }
    setDrafts(next);
  }, []);

  const load = useCallback(async () => {
    // NOTE: no synchronous state write here — the mount effect calls this
    // loader, and react-hooks/set-state-in-effect forbids sync updates in
    // effects. Errors are cleared by the save path instead.
    try {
      const res = await fetch("/api/engineering/permissions/context-roles");
      const json = await res.json();
      if (json.success) apply(json);
      else setErr(json.error || t("engineering.permissions.contextRolesLoadFailed"));
    } catch {
      setErr(t("engineering.permissions.contextRolesLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [apply, t]);

  useEffect(() => {
    defer(() => load());
  }, [load]);

  const setDraftField = (row, field, value) => {
    setDrafts((prev) => ({
      ...prev,
      [rowKey(row)]: { ...prev[rowKey(row)], [field]: value },
    }));
    setMsg("");
  };

  const isDirty = (row) => {
    const d = drafts[rowKey(row)];
    if (!d) return false;
    return (
      d.profile_id !==
        (row.profile_id === null || row.profile_id === undefined
          ? ""
          : String(row.profile_id)) ||
      d.is_active !== (Number(row.is_active) === 1 || row.is_active === true) ||
      d.notes !== (row.notes || "")
    );
  };

  const save = async (row) => {
    const d = drafts[rowKey(row)];
    if (!d) return;
    const key = rowKey(row);
    setBusyKey(key);
    setErr("");
    setMsg("");
    try {
      const res = await fetch("/api/engineering/permissions/context-roles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context: row.context,
          role_key: row.role_key,
          profile_id: d.profile_id === "" ? null : Number(d.profile_id),
          is_active: d.is_active,
          notes: d.notes,
          reason: reason.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "save failed");
      setMsg(t("engineering.permissions.contextRolesSaved"));
      await load();
    } catch (e) {
      setErr(e.message || t("engineering.permissions.contextRolesSaveFailed"));
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

  const profiles = data?.profiles || [];
  const roles = data?.roles || [];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--border-primary)] bg-secondary/40 p-4 space-y-1.5">
        <p className="text-xs font-bold text-[var(--text-primary)] leading-relaxed">
          {t("engineering.permissions.contextRolesHint")}
        </p>
        <p className="inline-flex items-center gap-2 px-2 py-1 rounded-md bg-primary border border-[var(--border-primary)] text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
          <Link2 className="w-3 h-3 text-[var(--brand-orange)]" />
          {t("engineering.permissions.contextRolesStatusPill")}
        </p>
      </div>

      {err && (
        <p className="flex items-center gap-2 text-xs font-bold text-red-500">
          <AlertTriangle className="w-3.5 h-3.5" /> {err}
        </p>
      )}
      {msg && (
        <p className="flex items-center gap-2 text-xs font-bold text-green-500">
          <CheckCircle2 className="w-3.5 h-3.5" /> {msg}
        </p>
      )}

      <div className="hidden md:block overflow-x-auto rounded-xl border border-[var(--border-primary)] bg-secondary/40">
        <table className="w-full text-left border-collapse min-w-[900px]">
          <thead>
            <tr className="border-b border-[var(--border-primary)]">
              <th className="p-3 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                {t("engineering.permissions.contextRolesContext")}
              </th>
              <th className="p-3 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                {t("engineering.permissions.contextRolesRole")}
              </th>
              <th className="p-3 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] text-center">
                {t("engineering.permissions.contextRolesStatus")}
              </th>
              <th className="p-3 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] text-center">
                {t("engineering.permissions.contextRolesHolders")}
              </th>
              <th className="p-3 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                {t("engineering.permissions.contextRolesProfile")}
              </th>
              <th className="p-3 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] text-center">
                {t("engineering.permissions.contextRolesActive")}
              </th>
              <th className="p-3 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                {t("engineering.permissions.contextRolesNotes")}
              </th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {roles.map((row) => {
              const key = rowKey(row);
              const d = drafts[key] || {};
              const dirty = isDirty(row);
              return (
                <tr key={key} className="border-b border-[var(--border-primary)]/50 align-top">
                  <td className="p-3">
                    <span className="inline-block px-2 py-1 rounded-md bg-primary border border-[var(--border-primary)] text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                      {t(`engineering.permissions.contextRolesContexts.${row.context}`)}
                    </span>
                  </td>
                  <td className="p-3 text-xs font-bold text-[var(--text-primary)]">
                    {row.role_key.replace(/_/g, " ")}
                  </td>
                  <td className="p-3 text-center">
                    {roleStatus(row) === "mapped" ? (
                      <Badge variant="mapped">
                        {t("engineering.permissions.contextRolesStatusMapped")}
                      </Badge>
                    ) : roleStatus(row) === "scopeDerived" ? (
                      <Badge variant="neutral">
                        {t("engineering.permissions.contextRolesStatusScopeDerived")}
                      </Badge>
                    ) : (
                      <Badge variant="gap">
                        {t("engineering.permissions.contextRolesStatusGap")}
                      </Badge>
                    )}
                  </td>
                  <td className="p-3 text-center text-xs font-bold text-[var(--text-secondary)]">
                    {row.holders === null || row.holders === undefined
                      ? "—"
                      : row.holders}
                  </td>
                  <td className="p-3">
                    <select
                      value={d.profile_id ?? ""}
                      onChange={(e) => setDraftField(row, "profile_id", e.target.value)}
                      className={`w-full bg-secondary border border-[var(--border-primary)] rounded-lg px-2 py-1.5 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/50 focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]/40 ${
                        d.profile_id === "" ? "opacity-70" : ""
                      }`}
                    >
                      <option value="">
                        {t("engineering.permissions.contextRolesNone")}
                      </option>
                      {profiles.map((p) => (
                        <option key={p.id} value={String(p.id)}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3 text-center">
                    <input
                      type="checkbox"
                      checked={Boolean(d.is_active)}
                      onChange={(e) => setDraftField(row, "is_active", e.target.checked)}
                      className="accent-[var(--brand-orange)]"
                    />
                  </td>
                  <td className="p-3">
                    <input
                      value={d.notes || ""}
                      onChange={(e) => setDraftField(row, "notes", e.target.value)}
                      className="w-full bg-secondary border border-[var(--border-primary)] rounded-lg px-2 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/50 focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]/40"
                    />
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => save(row)}
                      disabled={!dirty || busyKey === key}
                      className="px-3 py-1.5 rounded-lg bg-[var(--brand-orange)] text-black text-[10px] font-black uppercase tracking-widest disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]/60"
                    >
                      {busyKey === key
                        ? t("engineering.permissions.contextRolesSaving")
                        : t("engineering.permissions.contextRolesSave")}
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
        {roles.map((row) => {
          const key = rowKey(row);
          const d = drafts[key] || {};
          const dirty = isDirty(row);
          return (
            <div
              key={key}
              className="rounded-xl border border-[var(--border-primary)] bg-secondary/30 p-3 space-y-2"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="neutral">
                  {t(`engineering.permissions.contextRolesContexts.${row.context}`)}
                </Badge>
                <span className="text-xs font-bold text-[var(--text-primary)]">
                  {row.role_key.replace(/_/g, " ")}
                </span>
                {roleStatus(row) === "mapped" ? (
                  <Badge variant="mapped">
                    {t("engineering.permissions.contextRolesStatusMapped")}
                  </Badge>
                ) : roleStatus(row) === "scopeDerived" ? (
                  <Badge variant="neutral">
                    {t("engineering.permissions.contextRolesStatusScopeDerived")}
                  </Badge>
                ) : (
                  <Badge variant="gap">
                    {t("engineering.permissions.contextRolesStatusGap")}
                  </Badge>
                )}
                <span className="text-[10px] font-bold text-[var(--text-secondary)]">
                  {t("engineering.permissions.contextRolesHolders")}:{" "}
                  {row.holders === null || row.holders === undefined ? "—" : row.holders}
                </span>
              </div>

              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("engineering.permissions.contextRolesProfile")}
                </span>
                <select
                  value={d.profile_id ?? ""}
                  onChange={(e) => setDraftField(row, "profile_id", e.target.value)}
                  className="w-full bg-secondary border border-[var(--border-primary)] rounded-lg px-2 py-1.5 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/50 focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]/40"
                >
                  <option value="">{t("engineering.permissions.contextRolesNone")}</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={Boolean(d.is_active)}
                  onChange={(e) => setDraftField(row, "is_active", e.target.checked)}
                  className="accent-[var(--brand-orange)]"
                />
                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("engineering.permissions.contextRolesActive")}
                </span>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("engineering.permissions.contextRolesNotes")}
                </span>
                <input
                  value={d.notes || ""}
                  onChange={(e) => setDraftField(row, "notes", e.target.value)}
                  className="w-full bg-secondary border border-[var(--border-primary)] rounded-lg px-2 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/50 focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]/40"
                />
              </label>

              <button
                onClick={() => save(row)}
                disabled={!dirty || busyKey === key}
                className="w-full px-3 py-2 rounded-lg bg-[var(--brand-orange)] text-black text-[10px] font-black uppercase tracking-widest disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]/60"
              >
                {busyKey === key
                  ? t("engineering.permissions.contextRolesSaving")
                  : t("engineering.permissions.contextRolesSave")}
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] opacity-70">
        {t("engineering.permissions.contextRolesHolderHint")}
      </p>

      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={t("engineering.permissions.contextRolesReasonPlaceholder")}
        className="w-full max-w-xl rounded-lg border border-[var(--border-primary)] bg-surface-1 px-3 py-2 text-xs font-bold text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] placeholder:opacity-60 focus:outline-none focus:border-[var(--brand-orange)]"
      />
    </div>
  );
}

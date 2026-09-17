"use client";

import React from "react";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";

/**
 * PHASE UI-9 — "show me ONE person's history", as a control.
 *
 * The audit endpoint has always accepted `target_cid` (exact account), but the
 * History screen only offered the free-text box, which searches actor, target,
 * module and details at once — so typing a name there answers a different
 * question than "everything that was done to this account".
 *
 * A select rather than a text field on purpose: the value IS a contact id, and
 * a dropdown cannot produce a cid that belongs to nobody. A deep link may still
 * point at an account that has since left the directory, so that id is shown as
 * itself instead of silently falling back to "all people".
 */
export default function AuditPersonFilter({ value = "", onChange }) {
  const { t } = useI18n();
  const { data } = useApi("/api/contacts");
  const people = (data?.success ? data.contacts || [] : [])
    .slice()
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  const inList = people.some((p) => String(p.cid) === String(value));

  return (
    <label className="flex min-w-[200px] flex-col gap-1">
      <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
        {t("engineering.permissions.auditFilterPerson")}
      </span>
      <select
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-xl border border-[var(--border-primary)] bg-secondary px-3 py-2.5 text-[10px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/50 focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]/40"
      >
        <option value="">
          {t("engineering.permissions.auditFilterPersonAll")}
        </option>
        {value && !inList && (
          <option value={value}>
            {t("engineering.permissions.auditFilterPersonUnknown", {
              cid: value,
            })}
          </option>
        )}
        {people.map((p) => (
          <option key={p.cid} value={p.cid}>
            {p.name || p.email || p.cid}
          </option>
        ))}
      </select>
    </label>
  );
}

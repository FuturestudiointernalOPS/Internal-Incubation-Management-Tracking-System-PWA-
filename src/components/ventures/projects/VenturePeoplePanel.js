"use client";

import React, { useMemo, useState } from "react";
import { AlertTriangle, Link2, Mail, Unlink, UserCheck, Users } from "lucide-react";
import { useApi } from "@/lib/hooks/useApi";
import { useI18n } from "@/lib/i18n";
import { useDialogs } from "@/components/ui/DialogProvider";
import AppTable from "@/components/ui/AppTable";
import AppButton from "@/components/ui/AppButton";
import AppEmptyState from "@/components/ui/AppEmptyState";
import SectionHead from "@/components/ui/SectionHead";
import IdentifyPersonModal from "./IdentifyPersonModal";

/**
 * THE PEOPLE this Venture's work stands on.
 *
 * A tracker writes names. Some of them are people the platform already knows —
 * including people who have left and come back — and identifying one is what
 * makes a reminder reach the right address, or any address at all. This screen is
 * where that decision is made, ONCE PER NAME for the whole Venture: a support list
 * is text and can hold no identifier of its own, so "this Amina is that contact"
 * is recorded against the name and covers every mention of her.
 *
 * Identifying grants NOTHING. No account is created, no invitation is sent, no
 * membership changes, and the name the tracker wrote is never rewritten — the
 * contact it points at simply already exists.
 *
 * The address shown is the one a reminder WOULD use, asked of the same decision
 * the send makes, so this screen can never disagree with the sending.
 */
export default function VenturePeoplePanel({ ventureId }) {
  const { t } = useI18n();
  const { confirm, alert } = useDialogs();

  const { data, loading, error, refresh } = useApi(
    ventureId ? `/api/ventures/${ventureId}/people` : null,
    { deps: [ventureId], defaultValue: null },
  );

  const [picking, setPicking] = useState(null);
  const [forgetting, setForgetting] = useState(null);

  const people = useMemo(
    () => (Array.isArray(data?.people) ? data.people.map((person) => ({ ...person, id: person.name })) : []),
    [data],
  );
  const summary = data?.summary || { total: 0, identified: 0, unidentified: 0, reachable: 0, unreachable: 0 };

  const forget = async (person) => {
    if (
      !(await confirm({
        message: t("venture.people.confirmForget", { name: person.name }),
        tone: "danger",
      }))
    ) {
      return;
    }
    setForgetting(person.name);
    try {
      const res = await fetch(`/api/ventures/${ventureId}/people`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unlink", display_name: person.name }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload?.success) {
        await alert({ message: t(payload?.error || "errors.somethingWrong"), tone: "danger" });
        return;
      }
      refresh();
    } finally {
      setForgetting(null);
    }
  };

  /** What this name carries: work it owns, work it supports. */
  const carries = (person) => {
    const parts = [];
    if (person.assignments > 0) parts.push(t("venture.people.ownsCount", { count: person.assignments }));
    if (person.supporting_items > 0) parts.push(t("venture.people.supportsCount", { count: person.supporting_items }));
    return parts.length > 0 ? parts.join(" · ") : t("venture.people.noWork");
  };

  const columns = [
    {
      key: "name",
      label: t("venture.people.colName"),
      render: (_value, person) => (
        <div className="min-w-[180px]">
          <p className="font-semibold text-[var(--text-primary)] break-words">{person.name}</p>
          <span className="mt-1 flex flex-wrap gap-1">
            {person.roles.map((role) => (
              <span
                key={role}
                className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-[var(--surface-2)] text-[var(--text-tertiary)]"
              >
                {t(`venture.reminders.role.${role}`)}
              </span>
            ))}
          </span>
        </div>
      ),
    },
    {
      key: "carries",
      label: t("venture.people.colCarries"),
      render: (_value, person) => (
        <span className="text-[11px] text-[var(--text-secondary)] whitespace-nowrap">{carries(person)}</span>
      ),
    },
    {
      key: "email",
      label: t("venture.people.colAddress"),
      render: (_value, person) =>
        person.email ? (
          <div className="min-w-[200px]">
            <span className="flex items-center gap-1 text-[11px] text-[var(--text-primary)] break-all">
              <Mail className="w-3 h-3 shrink-0" /> {person.email}
            </span>
            <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-tertiary)]">
              {t(person.source === "contact" ? "venture.people.fromRecord" : "venture.people.fromFile")}
            </span>
            {person.alternative_email && (
              <span className="block mt-0.5 text-[10px] text-amber-400">
                {t("venture.people.alternative", { email: person.alternative_email })}
              </span>
            )}
          </div>
        ) : (
          <span className="flex items-center gap-1 text-[10px] font-bold text-amber-400">
            <AlertTriangle className="w-3 h-3" />
            {t(`venture.reminders.reason.${person.reason}`)}
          </span>
        ),
    },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (_value, person) =>
        person.contact ? (
          <span className="flex flex-col items-end gap-1">
            <span className="flex flex-wrap items-center justify-end gap-2">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                <UserCheck className="w-3 h-3" />
                {person.contact.name || person.contact.email || person.contact.cid}
              </span>
              <button
                type="button"
                disabled={forgetting === person.name}
                onClick={() => setPicking(person)}
                className="text-[9px] font-black uppercase tracking-widest text-[var(--brand-orange)] hover:underline disabled:opacity-50"
              >
                {t("venture.people.change")}
              </button>
              <button
                type="button"
                disabled={forgetting === person.name}
                onClick={() => forget(person)}
                className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-rose-400 hover:underline disabled:opacity-50"
              >
                <Unlink className="w-3 h-3" /> {t("venture.people.forget")}
              </button>
            </span>
            {/* Identified on the assignments themselves, rather than by a
                decision about the name: said out loud, because the two records
                can point at different people. */}
            {person.contact_source === "assignment" ? (
              <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-tertiary)]">
                {t("venture.people.fromAssignment")}
              </span>
            ) : null}
            {person.alternative_contact ? (
              <span className="text-[10px] text-amber-400">
                {t("venture.people.alternativeContact", {
                  name: person.alternative_contact.name || person.alternative_contact.cid,
                })}
              </span>
            ) : null}
          </span>
        ) : (
          <AppButton variant="secondary" size="sm" icon={Link2} onClick={() => setPicking(person)}>
            {t("venture.people.identify")}
          </AppButton>
        ),
    },
  ];

  return (
    <div className="space-y-3">
      <SectionHead
        icon={Users}
        title={t("venture.people.title")}
        subtitle={t("venture.people.subtitle")}
      />

      <div className="flex flex-wrap gap-2">
        <span className="stf-tag">{t("venture.people.statTotal", { count: summary.total })}</span>
        <span className="stf-tag">{t("venture.people.statIdentified", { count: summary.identified })}</span>
        <span className="stf-tag o">{t("venture.people.statUnidentified", { count: summary.unidentified })}</span>
        <span className="stf-tag">{t("venture.people.statReachable", { count: summary.reachable })}</span>
      </div>

      {error ? (
        <AppEmptyState
          title={t("venture.people.loadFailed")}
          description={error}
          action={
            <AppButton variant="secondary" onClick={() => refresh()}>
              {t("common.retry")}
            </AppButton>
          }
        />
      ) : !loading && people.length === 0 ? (
        <AppEmptyState title={t("venture.people.empty")} description={t("venture.people.emptyHint")} />
      ) : (
        <AppTable columns={columns} data={people} loading={loading} emptyMessage={t("venture.people.empty")} />
      )}

      {picking && (
        <IdentifyPersonModal
          ventureId={ventureId}
          person={picking}
          onClose={() => setPicking(null)}
          onIdentified={refresh}
        />
      )}
    </div>
  );
}

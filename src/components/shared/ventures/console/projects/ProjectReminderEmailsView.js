"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Mail, Paperclip, SlidersHorizontal } from "lucide-react";
import { useApi } from "@/lib/hooks/useApi";
import { useI18n } from "@/lib/i18n";
import AppTable from "@/components/ui/AppTable";
import AppModal from "@/components/ui/AppModal";
import AppButton from "@/components/ui/AppButton";
import AppEmptyState from "@/components/ui/AppEmptyState";
import SectionHead from "@/components/ui/SectionHead";

/** The status filter uses this sentinel for "any". */
const ANY = "all";

/** "12 Nov 2026, 14:05" — a send is read at a glance. */
function formatWhen(value, lang) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(lang, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * The reminder emails sent for ONE Venture's projects.
 *
 * This is a dedicated reading surface, not another settings screen: the reminder
 * log already records every attempt (who was written to, why, with what subject
 * and message, and whether it left). The Projects view links here so a manager
 * can answer "what has actually been chased?" without opening each work item.
 *
 * The rows are the log itself — never rewritten, never re-derived — so a failed
 * attempt stays visible instead of being filtered into a success story.
 */
export default function ProjectReminderEmailsView({ ventureId, backHref = null }) {
  const { t, lang } = useI18n();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(ANY);
  const [selected, setSelected] = useState(null);

  const { data, loading, error, refresh } = useApi(
    ventureId ? `/api/ventures/${ventureId}/reminders` : null,
    { deps: [ventureId], defaultValue: null },
  );

  const history = useMemo(
    () => (Array.isArray(data?.history) ? data.history : []),
    [data],
  );

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return history.filter((row) => {
      if (status !== ANY && row.status !== status) return false;
      if (!needle) return true;
      return [
        row.work_item_ref,
        row.work_item_title,
        row.recipient_name,
        row.recipient_email,
        row.subject,
        row.body,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [history, search, status]);

  const reasonLabel = (row) =>
    row.mode === "manual" ? t("venture.sentEmails.manual") : t(`venture.reminders.trigger.${row.trigger}`);

  const statusLabel = (row) =>
    row.status === "sent" ? t("venture.sentEmails.statusSent") : t("venture.sentEmails.statusFailed");

  const statusClass = (row) =>
    row.status === "sent"
      ? "text-emerald-400 bg-emerald-500/10"
      : "text-rose-400 bg-rose-500/10";

  const columns = [
    {
      key: "when",
      label: t("venture.sentEmails.colWhen"),
      render: (_value, row) => (
        <span className="whitespace-nowrap text-[12px] text-[var(--text-secondary)]">
          {formatWhen(row.sent_at || row.created_at, lang)}
        </span>
      ),
    },
    {
      key: "work",
      label: t("venture.sentEmails.colWork"),
      render: (_value, row) => (
        <div className="min-w-[200px] max-w-[340px]">
          {row.work_item_ref ? <span className="stf-tag o mr-1.5">{row.work_item_ref}</span> : null}
          <span className="font-semibold text-[13px] text-[var(--text-primary)] break-words">
            {row.work_item_title || "—"}
          </span>
        </div>
      ),
    },
    {
      key: "to",
      label: t("venture.sentEmails.colTo"),
      render: (_value, row) => (
        <div className="min-w-[180px]">
          {row.recipient_name ? (
            <p className="text-[13px] font-semibold text-[var(--text-primary)]">{row.recipient_name}</p>
          ) : null}
          <p className="text-[12px] text-[var(--text-secondary)] break-all">{row.recipient_email}</p>
        </div>
      ),
    },
    {
      key: "why",
      label: t("venture.sentEmails.colWhy"),
      render: (_value, row) => (
        <span className="whitespace-nowrap text-[12px] text-[var(--text-secondary)]">{reasonLabel(row)}</span>
      ),
    },
    {
      key: "subject",
      label: t("venture.sentEmails.colSubject"),
      render: (_value, row) => (
        <div className="min-w-[180px] max-w-[340px]">
          <p className="text-[13px] text-[var(--text-primary)] line-clamp-1">
            {row.subject || t("venture.sentEmails.standardSubject")}
          </p>
          {row.attachment_name ? (
            <p className="inline-flex items-center gap-1 text-[11px] text-[var(--text-tertiary)]">
              <Paperclip className="w-3 h-3" /> {row.attachment_name}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      key: "status",
      label: t("venture.sentEmails.colStatus"),
      render: (_value, row) => (
        <span className={`whitespace-nowrap rounded px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${statusClass(row)}`}>
          {statusLabel(row)}
        </span>
      ),
    },
  ];

  return (
    <div>
      {backHref ? (
        <Link
          href={backHref}
          className="mb-4 inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--text-tertiary)] transition-colors hover:text-[var(--brand-orange)]"
        >
          <ArrowLeft className="w-3 h-3" /> {t("venture.sentEmails.back")}
        </Link>
      ) : null}

      <SectionHead
        icon={Mail}
        title={t("venture.sentEmails.title")}
        subtitle={t("venture.sentEmails.subtitle")}
        action={<span className="stf-tag">{t("venture.sentEmails.count", { count: visible.length })}</span>}
      />

      <div className="stf-bar" style={{ marginTop: 10 }}>
        <span className="stf-k" style={{ display: "inline-flex", alignItems: "center", gap: 6, flex: "none" }}>
          <SlidersHorizontal size={13} /> {t("venture.projects.filters")}
        </span>
        <input
          className="stf-input"
          style={{ flex: "2 1 240px" }}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("venture.sentEmails.searchPlaceholder")}
          aria-label={t("common.search")}
        />
        <select
          className="stf-input"
          style={{ flex: "1 1 150px" }}
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          aria-label={t("venture.sentEmails.allStatuses")}
          title={t("venture.sentEmails.allStatuses")}
        >
          <option value={ANY}>{t("venture.sentEmails.allStatuses")}</option>
          <option value="sent">{t("venture.sentEmails.statusSent")}</option>
          <option value="failed">{t("venture.sentEmails.statusFailed")}</option>
        </select>
      </div>

      {error ? (
        <AppEmptyState
          title={t("venture.projects.loadFailed")}
          description={error}
          action={
            <AppButton variant="secondary" onClick={() => refresh()}>
              {t("common.retry")}
            </AppButton>
          }
        />
      ) : loading ? (
        <AppTable loading columns={columns} data={[]} />
      ) : visible.length === 0 ? (
        <AppEmptyState
          title={t("venture.sentEmails.empty")}
          description={history.length === 0 ? t("venture.sentEmails.emptyHint") : t("venture.sentEmails.noResults")}
          icon={Mail}
        />
      ) : (
        <AppTable columns={columns} data={visible} onRowClick={(row) => setSelected(row)} />
      )}

      <AppModal
        isOpen={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={t("venture.sentEmails.detailTitle")}
        size="md"
      >
        {selected ? (
          <div className="space-y-4 text-xs">
            <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--surface-1)] p-3">
              <p className="font-semibold text-[var(--text-primary)] break-words">
                {selected.work_item_ref ? (
                  <span className="mr-1.5 text-[var(--brand-orange)]">{selected.work_item_ref}</span>
                ) : null}
                {selected.work_item_title || "—"}
              </p>
              <p className="mt-1 text-[var(--text-secondary)]">
                {selected.recipient_name ? `${selected.recipient_name} · ` : ""}
                {selected.recipient_email}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <p className="stf-k">{t("venture.sentEmails.colWhy")}</p>
                <p className="text-[var(--text-primary)]">{reasonLabel(selected)}</p>
              </div>
              <div>
                <p className="stf-k">{t("venture.sentEmails.colWhen")}</p>
                <p className="text-[var(--text-primary)]">
                  {formatWhen(selected.sent_at || selected.created_at, lang)}
                </p>
              </div>
            </div>

            <div>
              <p className="stf-k">{t("venture.sentEmails.colSubject")}</p>
              <p className="text-[var(--text-primary)]">
                {selected.subject || t("venture.sentEmails.standardSubject")}
              </p>
            </div>

            <div>
              <p className="stf-k">{t("venture.sentEmails.messageLabel")}</p>
              <p className="whitespace-pre-wrap break-words text-[var(--text-secondary)]">
                {selected.body || t("venture.sentEmails.noMessage")}
              </p>
            </div>

            {selected.attachment_name ? (
              <div>
                <p className="stf-k">{t("venture.sentEmails.attachment")}</p>
                <p className="inline-flex items-center gap-1.5 text-[var(--text-primary)]">
                  <Paperclip className="w-3.5 h-3.5" /> {selected.attachment_name}
                </p>
              </div>
            ) : null}

            {selected.status !== "sent" && selected.error ? (
              <div className="rounded-lg border border-rose-500/25 bg-rose-500/5 p-3">
                <p className="stf-k flex items-center gap-1.5 text-rose-400">
                  <AlertTriangle className="w-3.5 h-3.5" /> {t("venture.sentEmails.error")}
                </p>
                <p className="mt-1 break-words text-rose-400">{selected.error}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </AppModal>
    </div>
  );
}

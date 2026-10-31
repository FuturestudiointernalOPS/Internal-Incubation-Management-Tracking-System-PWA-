"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { Megaphone, Pin, PinOff, Check, Mail } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import { formatLocaleDate } from "@/lib/constants";
import AppCard from "@/components/ui/AppCard";
import AppSelect from "@/components/ui/AppSelect";
import AppButton from "@/components/ui/AppButton";
import { Skeleton } from "@/components/ui/Skeleton";
import { useDialogs } from "@/components/ui/DialogProvider";

export const dynamic = "force-dynamic";
const isRead = row => row.is_read === true || Number(row.is_read) === 1;

export default function ParticipantAnnouncementsPage() {
  const { t, lang } = useI18n();
  const { alert } = useDialogs();
  const { data, loading, error, refresh } = useApi("/api/participant/announcements", { defaultValue: null });
  const [readFilter, setReadFilter] = useState("all");
  const [busy, setBusy] = useState(null);
  const [readOverrides, setReadOverrides] = useState({});

  // Announcements and venture notifications are one inbox: the bell counts both,
  // so this page lists and counts both, each with its own read state.
  const rows = [...(data?.announcements || []), ...(data?.notifications || [])]
    .map(row => ({ ...row, read: readOverrides[row.id] ?? isRead(row) }))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const unread = rows.filter(row => !row.read).length;
  const visible = rows.filter(row => readFilter === "all" || row.read === (readFilter === "read"));

  const updateRead = async row => {
    setBusy(row.id);
    try {
      const response = await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: row.id, action: row.read ? "unread" : "read" }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error("Notification update failed");
      setReadOverrides(previous => ({ ...previous, [row.id]: !row.read }));
      window.dispatchEvent(new Event("notifications:refresh"));
      refresh();
    } catch { await alert({ message: t("participant.announcementHub.readError") }); }
    finally { setBusy(null); }
  };

  return <div className="space-y-6">
    <header><h1 className="flex items-center gap-3 text-2xl font-bold text-[var(--text-primary)]"><Megaphone className="h-6 w-6 text-[var(--brand-orange)]" />{t("navigation.announcements")}</h1><p className="mt-2 text-sm text-[var(--text-secondary)]">{t("participant.announcementHub.description")}</p></header>
    <div className="grid grid-cols-3 gap-4">{[["total", rows.length], ["unread", unread], ["read", rows.length - unread]].map(([key, value]) => <AppCard key={key}><p className="text-xs text-[var(--text-secondary)]">{t(`participant.announcementHub.${key}`)}</p><strong className="mt-2 block text-3xl text-[var(--text-primary)]">{loading && !data ? t("common.loading") : value}</strong></AppCard>)}</div>
    <AppCard><div className="w-full sm:w-64"><AppSelect placeholder={t("common.select")} label={t("participant.announcementHub.readState")} value={readFilter} onChange={event => setReadFilter(event.target.value)} options={["all", "unread", "read"].map(value => ({ value, label: t(`participant.announcementHub.filters.${value}`) }))} /></div></AppCard>
    {loading && !data ? <Skeleton className="h-40 w-full" /> : error || data?.success === false ? <AppCard><p role="alert">{t("errors.networkError")}</p><AppButton className="mt-3" onClick={refresh}>{t("common.retry")}</AppButton></AppCard> : <div className="space-y-4">{visible.map(row => <AppCard key={row.id}>
      <article className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs">{!row.read && <span className="h-2 w-2 rounded-full bg-blue-400" />}<span className={row.read ? "text-[var(--text-secondary)]" : "font-bold text-[var(--brand-orange)]"}>{t(row.read ? "participant.announcementHub.read" : "participant.announcementHub.unread")}</span></div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">{row.title}</h2>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">{formatLocaleDate(row.created_at, { day: "numeric", month: "long", year: "numeric" }, lang)}</p>
          </div>
          <AppButton variant="secondary" icon={row.read ? Mail : Check} loading={busy === row.id} disabled={busy !== null} onClick={() => updateRead(row)}>{t(row.read ? "participant.announcementHub.markUnread" : "participant.announcementHub.markRead")}</AppButton>
        </div>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-secondary)]">{row.message}</p>
      </article>
    </AppCard>)}</div>}
  </div>;
}

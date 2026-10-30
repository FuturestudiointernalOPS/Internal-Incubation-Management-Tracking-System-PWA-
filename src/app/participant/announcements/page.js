"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { Megaphone, Pin, PinOff, Check, Mail } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import { formatLocaleDate } from "@/lib/constants";
import AppCard from "@/components/ui/AppCard";
import AppInput from "@/components/ui/AppInput";
import AppSelect from "@/components/ui/AppSelect";
import AppButton from "@/components/ui/AppButton";
import { Skeleton } from "@/components/ui/Skeleton";
import { useDialogs } from "@/components/ui/DialogProvider";

export const dynamic = "force-dynamic";
const CATEGORIES = ["important", "program", "opportunity"];
const STORAGE_EVENT = "participant-announcement-preferences";
const serverPreferences = () => "{}";
function subscribePreferences(listener) {
  window.addEventListener("storage", listener);
  window.addEventListener(STORAGE_EVENT, listener);
  return () => { window.removeEventListener("storage", listener); window.removeEventListener(STORAGE_EVENT, listener); };
}
const isRead = row => row.is_read === true || Number(row.is_read) === 1;
const searchable = text => String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase();

export default function ParticipantAnnouncementsPage() {
  const { t, lang } = useI18n();
  const { alert } = useDialogs();
  const { data, loading, error, refresh } = useApi("/api/participant/announcements", { defaultValue: null });
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [readFilter, setReadFilter] = useState("all");
  const [onlyPinned, setOnlyPinned] = useState(false);
  const [busy, setBusy] = useState(null);
  const [readOverrides, setReadOverrides] = useState({});
  const storageKey = data?.recipientId ? `impactos_announcement_preferences:${data.recipientId}` : null;
  const getPreferences = useCallback(() => {
    try { return storageKey ? localStorage.getItem(storageKey) || "{}" : "{}"; } catch { return "{}"; }
  }, [storageKey]);
  const preferenceSnapshot = useSyncExternalStore(subscribePreferences, getPreferences, serverPreferences);
  const preferences = useMemo(() => {
    try { const value = JSON.parse(preferenceSnapshot); return value && typeof value === "object" && !Array.isArray(value) ? value : {}; } catch { return {}; }
  }, [preferenceSnapshot]);
  const savePreference = async (id, changes) => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ ...preferences, [id]: { ...preferences[id], ...changes } }));
      window.dispatchEvent(new Event(STORAGE_EVENT));
    } catch { await alert({ message: t("participant.announcementHub.preferenceError") }); }
  };
  const rows = (data?.announcements || []).map(row => ({
    ...row,
    read: readOverrides[row.id] ?? isRead(row),
    pinned: preferences[row.id]?.pinned ?? (row.is_pinned === true || Number(row.is_pinned) === 1),
    category: CATEGORIES.includes(preferences[row.id]?.category) ? preferences[row.id].category : CATEGORIES.includes(row.category) ? row.category : "program",
  }));
  const visible = rows.filter(row => (category === "all" || row.category === category) && (readFilter === "all" || row.read === (readFilter === "read")) && (!onlyPinned || row.pinned) && searchable(`${row.title} ${row.message}`).includes(searchable(query))).sort((a, b) => Number(b.pinned) - Number(a.pinned) || new Date(b.created_at) - new Date(a.created_at));
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
  const categoryOptions = CATEGORIES.map(value => ({ value, label: t(`participant.announcementHub.categories.${value}`) }));

  return <div className="space-y-6">
    <header><h1 className="flex items-center gap-3 text-2xl font-bold text-[var(--text-primary)]"><Megaphone className="h-6 w-6 text-[var(--brand-orange)]" />{t("navigation.announcements")}</h1><p className="mt-2 text-sm text-[var(--text-secondary)]">{t("participant.announcementHub.description")}</p></header>
    <div className="grid grid-cols-3 gap-4">{[["total", rows.length], ["unread", rows.filter(row => !row.read).length], ["pinned", rows.filter(row => row.pinned).length]].map(([key, value]) => <AppCard key={key}><p className="text-xs text-[var(--text-secondary)]">{t(`participant.announcementHub.${key}`)}</p><strong className="mt-2 block text-3xl text-[var(--text-primary)]">{loading ? t("common.loading") : value}</strong></AppCard>)}</div>
    <AppCard><div className="grid gap-4 md:grid-cols-3"><AppInput label={t("common.search")} value={query} onChange={event => setQuery(event.target.value)} placeholder={t("participant.announcementHub.searchPlaceholder")} /><AppSelect placeholder={t("common.select")} label={t("participant.announcementHub.category")} value={category} onChange={event => setCategory(event.target.value)} options={[{ value: "all", label: t("participant.announcementHub.allCategories") }, ...categoryOptions]} /><AppSelect placeholder={t("common.select")} label={t("participant.announcementHub.readState")} value={readFilter} onChange={event => setReadFilter(event.target.value)} options={["all", "unread", "read"].map(value => ({ value, label: t(`participant.announcementHub.filters.${value}`) }))} /></div><label className="mt-4 flex items-center gap-2 text-sm text-[var(--text-secondary)]"><input type="checkbox" checked={onlyPinned} onChange={event => setOnlyPinned(event.target.checked)} className="accent-[var(--brand-orange)]" />{t("participant.announcementHub.onlyPinned")}</label><p className="mt-3 text-xs text-[var(--text-secondary)]">{t("participant.announcementHub.localPreferences")}</p></AppCard>
    {loading && !data ? <Skeleton className="h-40 w-full" /> : error || data?.success === false ? <AppCard><p role="alert">{t("errors.networkError")}</p><AppButton className="mt-3" onClick={refresh}>{t("common.retry")}</AppButton></AppCard> : visible.length === 0 ? <AppCard><p className="py-8 text-center text-[var(--text-secondary)]">{t(rows.length ? "participant.announcementHub.noMatches" : "participant.announcementHub.empty")}</p></AppCard> : <div className="space-y-4">{visible.map(row => <AppCard key={row.id}>
      <article className="space-y-4"><div className="flex items-start justify-between gap-3"><div><div className="mb-2 flex flex-wrap items-center gap-2 text-xs"><span className="rounded-full bg-brand-orange/10 px-3 py-1 font-bold text-[var(--brand-orange)]">{t(`participant.announcementHub.categories.${row.category}`)}</span><span className={row.read ? "text-[var(--text-secondary)]" : "font-bold text-[var(--brand-orange)]"}>{t(row.read ? "participant.announcementHub.read" : "participant.announcementHub.unread")}</span>{row.pinned && <span className="flex items-center gap-1 text-[var(--brand-orange)]"><Pin className="h-3 w-3" />{t("participant.announcementHub.pinned")}</span>}</div><h2 className="text-lg font-bold text-[var(--text-primary)]">{row.title}</h2><p className="mt-1 text-xs text-[var(--text-secondary)]">{formatLocaleDate(row.created_at, { day: "numeric", month: "long", year: "numeric" }, lang)}</p></div><AppButton variant="ghost" icon={row.pinned ? PinOff : Pin} aria-label={t(row.pinned ? "participant.announcementHub.unpin" : "participant.announcementHub.pin")} title={t(row.pinned ? "participant.announcementHub.unpin" : "participant.announcementHub.pin")} onClick={() => savePreference(row.id, { pinned: !row.pinned })} /></div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-secondary)]">{row.message}</p><div className="flex flex-wrap items-end justify-between gap-4"><div className="w-full sm:w-48"><AppSelect placeholder={t("common.select")} label={t("participant.announcementHub.category")} aria-label={t("participant.announcementHub.categoryFor", { title: row.title })} value={row.category} options={categoryOptions} onChange={event => savePreference(row.id, { category: event.target.value })} /></div><AppButton variant="secondary" icon={row.read ? Mail : Check} loading={busy === row.id} disabled={busy !== null} onClick={() => updateRead(row)}>{t(row.read ? "participant.announcementHub.markUnread" : "participant.announcementHub.markRead")}</AppButton></div></article>
    </AppCard>)}</div>}
  </div>;
}

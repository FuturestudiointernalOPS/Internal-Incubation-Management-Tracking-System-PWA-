"use client";

import { useState } from "react";
import {
  Loader2, CheckCircle2, AlertCircle, Bell, Settings, Archive, Trash2,
  Send,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";

const TYPE_COLORS = {
  system: "text-slate-400 bg-slate-500/10",
  project: "text-blue-400 bg-blue-500/10",
  mentoring: "text-purple-400 bg-purple-500/10",
  investment: "text-emerald-400 bg-emerald-500/10",
  verification: "text-amber-400 bg-amber-500/10",
  knowledge: "text-[var(--brand-orange)] bg-[var(--brand-orange)]/10",
  meetings: "text-indigo-400 bg-indigo-500/10",
  security: "text-rose-400 bg-rose-500/10",
  announcements: "text-amber-400 bg-amber-500/10",
};

// The shapes the screen renders from, so a failed or malformed payload never
// reaches a `.filter` / `.map` read. Module scope keeps them stable for the hook
// (inline values would refetch on every render).
const EMPTY_NOTIFICATION_INBOX = { notifications: [], unread_count: 0 };
const pickNotificationInbox = (payload) =>
  payload?.success
    ? { notifications: payload.notifications || [], unread_count: payload.unread_count || 0 }
    : EMPTY_NOTIFICATION_INBOX;
// The preferences endpoint answers with the stored row: its `preferences` field
// is the per-type channel map, and the delivery settings sit beside it. The
// screen edits both, so the row is kept whole.
const pickNotificationPreferences = (payload) => (payload?.success ? payload.preferences : null);

export default function NotificationsPage() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState("inbox");
  const [filterType, setFilterType] = useState("");
  const [toast, setToast] = useState(null);

  // Both loaders' work — cache-first paint, discarding a stale response, the
  // background refresh — belongs to the hook, so the screen keeps no data state
  // of its own and never sets state from an effect. The edits below write through
  // each read's own setter, exactly as they did before, and sending a test
  // notification refreshes both.
  const {
    data: inbox,
    loading: inboxLoading,
    setData: setInbox,
    refresh: refreshInbox,
  } = useApi("/api/notifications/venture", {
    defaultValue: EMPTY_NOTIFICATION_INBOX,
    transform: pickNotificationInbox,
  });
  const {
    data: preferences,
    loading: preferencesLoading,
    setData: setPreferences,
    refresh: refreshPreferences,
  } = useApi("/api/notifications/venture?type=preferences", {
    transform: pickNotificationPreferences,
  });
  const loading = inboxLoading || preferencesLoading;
  const { notifications, unread_count: unreadCount } = inbox;
  const refreshAll = () => {
    refreshInbox();
    refreshPreferences();
  };

  const notify = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const markRead = async (id) => {
    await fetch(`/api/notifications/venture`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_read", notification_id: id }),
    });
    setInbox((prev) => ({
      ...prev,
      notifications: prev.notifications.map((notification) => notification.id === id ? { ...notification, status: "read" } : notification),
      unread_count: Math.max(0, prev.unread_count - 1),
    }));
  };

  const markAllRead = async () => {
    await fetch(`/api/notifications/venture`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_all_read" }),
    });
    setInbox((prev) => ({
      ...prev,
      notifications: prev.notifications.map((notification) => notification.status === "unread" ? { ...notification, status: "read" } : notification),
      unread_count: 0,
    }));
    notify(t("adminMisc.notifications.allMarkedRead"));
  };

  const archiveNotif = async (id) => {
    await fetch(`/api/notifications/venture`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "archive", notification_id: id }),
    });
    setInbox((prev) => ({ ...prev, notifications: prev.notifications.filter((notification) => notification.id !== id) }));
  };

  const deleteNotif = async (id) => {
    await fetch(`/api/notifications/venture`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", notification_id: id }),
    });
    setInbox((prev) => ({ ...prev, notifications: prev.notifications.filter((notification) => notification.id !== id) }));
  };

  const sendTest = async () => {
    await fetch(`/api/notifications/venture`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "send_test" }),
    });
    notify(t("adminMisc.notifications.testNotificationSent"));
    refreshAll();
  };

  const togglePref = async (type, channel) => {
    const updated = { ...preferences.preferences };
    if (!updated[type]) updated[type] = { in_app: true, email: false, sms: false, push: false };
    updated[type][channel] = !updated[type][channel];
    await fetch(`/api/notifications/venture`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_preferences", updates: { preferences: updated } }),
    });
    setPreferences((previous) => ({ ...previous, preferences: updated }));
  };

  const filtered = filterType ? notifications.filter((notification) => notification.type === filterType) : notifications;

  if (loading) return (
    <><div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-[var(--brand-orange)]" /></div></>
  );

  return (
    <>
      <div className="space-y-8 pb-20">
        {toast && (
          <div className={`fixed top-6 right-6 z-50 px-4 py-2.5 rounded-xl shadow-2xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 ${toast.type==="error"?"bg-rose-600":"bg-emerald-600"} text-white`}>
            {toast.type==="error"?<AlertCircle className="w-3.5 h-3.5"/>:<CheckCircle2 className="w-3.5 h-3.5"/>}{toast.msg}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[var(--brand-orange)]/10 flex items-center justify-center"><Bell className="w-6 h-6 text-[var(--brand-orange)]" /></div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-[var(--text-primary)]">{t("adminMisc.notifications.title")}</h1>
              <p className="text-sm text-[var(--text-secondary)]">{t("adminMisc.notifications.unreadTotal", { unread: unreadCount, total: notifications.length })}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={sendTest} className="px-3 py-2 rounded-xl border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-wide hover:bg-tertiary flex items-center gap-1.5"><Send className="w-3 h-3" /> {t("adminMisc.notifications.test")}</button>
            <button onClick={markAllRead} className="px-3 py-2 bg-[var(--brand-orange)] text-black rounded-xl text-sm font-bold uppercase tracking-wide hover:brightness-110 flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3" /> {t("adminMisc.notifications.markAllRead")}</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-[var(--border-primary)]">
          {[
            { id: "inbox", label: t("adminMisc.notifications.inboxWithCount", { count: unreadCount }), icon: Bell },
            { id: "preferences", label: t("adminMisc.notifications.preferences"), icon: Settings },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 border-b-2 transition-all ${activeTab===tab.id?"border-[var(--brand-orange)] text-[var(--brand-orange)]":"border-transparent text-[var(--text-secondary)]"}`}>
                <Icon className="w-3 h-3" />{tab.label}
              </button>
            );
          })}
        </div>

        {/* Inbox */}
        {activeTab === "inbox" && (
          <>
            {/* Filter */}
            <div className="flex gap-1 overflow-x-auto pb-1">
              <button onClick={() => setFilterType("")} className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase whitespace-nowrap ${!filterType?"bg-[var(--brand-orange)]/10 text-[var(--brand-orange)]":"bg-tertiary text-[var(--text-secondary)]"}`}>{t("adminMisc.notifications.all")}</button>
              {Object.keys(TYPE_COLORS).map((typeKey) => (
                <button key={typeKey} onClick={() => setFilterType(typeKey)} className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase whitespace-nowrap ${filterType===typeKey?"bg-[var(--brand-orange)]/10 text-[var(--brand-orange)]":"bg-tertiary text-[var(--text-secondary)]"}`}>{typeKey}</button>
              ))}
            </div>

            {/* List */}
            {filtered.length === 0 ? (
              <div className="text-center py-16"><Bell className="w-12 h-12 text-slate-600 mx-auto mb-3" /><p className="text-sm text-[var(--text-secondary)]">{t("adminMisc.notifications.noNotifications")}</p></div>
            ) : (
              <div className="space-y-2">
                {filtered.map((notification) => (
                  <div key={notification.id}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${notification.status==="unread" ? "bg-[var(--brand-orange)]/[0.02] border-[var(--brand-orange)]/20" : "bg-tertiary border-[var(--border-primary)] hover:border-[var(--brand-orange)]/30"}`}
                    onClick={() => notification.status === "unread" && markRead(notification.id)}>
                    <div className="flex items-start gap-3">
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${notification.status==="unread" ? "bg-[var(--brand-orange)]" : "bg-transparent"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${TYPE_COLORS[notification.type] || TYPE_COLORS.system}`}>{notification.type}</span>
                          {notification.priority === "urgent" && <span className="text-[10px] font-bold uppercase text-rose-400">{t("adminMisc.notifications.urgent")}</span>}
                          <span className="text-[10px] font-medium text-[var(--text-secondary)] ml-auto">{new Date(notification.created_at).toLocaleString()}</span>
                        </div>
                        <p className={`text-xs mt-1 ${notification.status==="unread" ? "font-bold text-[var(--text-primary)]" : "font-medium text-[var(--text-secondary)]"}`}>{notification.title}</p>
                        {notification.body && <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-0.5">{notification.body}</p>}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {notification.status === "unread" && <button onClick={(event) => { event.stopPropagation(); markRead(notification.id); }} className="p-1.5 text-slate-500 hover:text-[var(--brand-orange)]"><CheckCircle2 className="w-3.5 h-3.5" /></button>}
                        <button onClick={(event) => { event.stopPropagation(); archiveNotif(notification.id); }} className="p-1.5 text-slate-500 hover:text-blue-400"><Archive className="w-3.5 h-3.5" /></button>
                        <button onClick={(event) => { event.stopPropagation(); deleteNotif(notification.id); }} className="p-1.5 text-slate-500 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Preferences */}
        {activeTab === "preferences" && preferences && (
          <div className="space-y-6">
            {Object.entries(preferences.preferences || {}).map(([type, channels]) => (
              <div key={type} className="card">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-3">{type}</h3>
                <div className="flex gap-4">
                  {["in_app", "email", "sms", "push"].map((channel) => (
                    <button key={channel} onClick={() => togglePref(type, channel)}
                      className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase border transition-all ${
                        channels[channel] ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-primary text-[var(--text-secondary)] border-[var(--border-primary)]"
                      }`}>
                      {channel === "in_app" ? t("adminMisc.notifications.inApp") : channel.charAt(0).toUpperCase() + channel.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div className="card">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-3">{t("adminMisc.notifications.deliverySettings")}</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
                  <span className="text-[10px] font-bold text-[var(--text-primary)]">{t("adminMisc.notifications.digestFrequency")}</span>
                  <select value={preferences.digest_frequency || "realtime"}
                    onChange={async (event) => {
                      await fetch(`/api/notifications/venture`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update_preferences", updates: { digest_frequency: event.target.value } }) });
                      setPreferences((previous) => ({ ...previous, digest_frequency: event.target.value }));
                      notify(t("adminMisc.notifications.updated"));
                    }}
                    className="bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-1.5 text-sm font-bold outline-none">
                    <option value="realtime">{t("adminMisc.notifications.realtime")}</option><option value="hourly">{t("adminMisc.notifications.hourly")}</option><option value="daily">{t("adminMisc.notifications.daily")}</option><option value="weekly">{t("adminMisc.notifications.weekly")}</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

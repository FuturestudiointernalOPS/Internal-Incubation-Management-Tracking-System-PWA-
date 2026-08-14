"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2, CheckCircle2, AlertCircle, Bell, Mail, Settings, Archive, Trash2,
  X, Send, Filter, RefreshCw,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useI18n } from "@/lib/i18n";

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

export default function NotificationsPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [preferences, setPreferences] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("inbox");
  const [filterType, setFilterType] = useState("");
  const [toast, setToast] = useState(null);

  useEffect(() => { fetchAll(); }, []);

  const notify = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [nRes, pRes] = await Promise.all([
        fetch(`/api/notifications/venture`),
        fetch(`/api/notifications/venture?type=preferences`),
      ]);
      const n = await nRes.json(); const p = await pRes.json();
      if (n.success) { setNotifications(n.notifications || []); setUnreadCount(n.unread_count || 0); }
      if (p.success) setPreferences(p.preferences);
    } catch {} finally { setLoading(false); }
  };

  const markRead = async (id) => {
    await fetch(`/api/notifications/venture`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_read", notification_id: id }),
    });
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, status: "read" } : n));
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const markAllRead = async () => {
    await fetch(`/api/notifications/venture`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_all_read" }),
    });
    setNotifications((prev) => prev.map((n) => n.status === "unread" ? { ...n, status: "read" } : n));
    setUnreadCount(0);
    notify(t("adminMisc.notifications.allMarkedRead"));
  };

  const archiveNotif = async (id) => {
    await fetch(`/api/notifications/venture`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "archive", notification_id: id }),
    });
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const deleteNotif = async (id) => {
    await fetch(`/api/notifications/venture`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", notification_id: id }),
    });
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const sendTest = async () => {
    await fetch(`/api/notifications/venture`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "send_test" }),
    });
    notify(t("adminMisc.notifications.testNotificationSent"));
    fetchAll();
  };

  const togglePref = async (type, channel) => {
    const updated = { ...preferences.preferences };
    if (!updated[type]) updated[type] = { in_app: true, email: false, sms: false, push: false };
    updated[type][channel] = !updated[type][channel];
    await fetch(`/api/notifications/venture`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_preferences", updates: { preferences: updated } }),
    });
    setPreferences((p) => ({ ...p, preferences: updated }));
  };

  const filtered = filterType ? notifications.filter((n) => n.type === filterType) : notifications;

  if (loading) return (
    <DashboardLayout role="super_admin"><div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-[var(--brand-orange)]" /></div></DashboardLayout>
  );

  return (
    <DashboardLayout role="super_admin">
      <div className="space-y-8 pb-20">
        {toast && (
          <div className={`fixed top-6 right-6 z-50 px-4 py-2.5 rounded-xl shadow-2xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 ${toast.type==="error"?"bg-rose-600":"bg-emerald-600"} text-white`}>
            {toast.type==="error"?<AlertCircle className="w-3.5 h-3.5"/>:<CheckCircle2 className="w-3.5 h-3.5"/>}{toast.msg}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[var(--brand-orange)]/10 flex items-center justify-center"><Bell className="w-6 h-6 text-[var(--brand-orange)]" /></div>
            <div>
              <h1 className="text-2xl font-black text-[var(--text-primary)]">{t("adminMisc.notifications.title")}</h1>
              <p className="text-xs text-slate-500">{t("adminMisc.notifications.unreadTotal", { unread: unreadCount, total: notifications.length })}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={sendTest} className="px-3 py-2 rounded-xl border border-[var(--border-primary)] text-[8px] font-black uppercase tracking-wider hover:bg-tertiary flex items-center gap-1.5"><Send className="w-3 h-3" /> {t("adminMisc.notifications.test")}</button>
            <button onClick={markAllRead} className="px-3 py-2 bg-[var(--brand-orange)] text-black rounded-xl text-[8px] font-black uppercase tracking-wider hover:brightness-110 flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3" /> {t("adminMisc.notifications.markAllRead")}</button>
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
                className={`px-4 py-2.5 text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5 border-b-2 transition-all ${activeTab===tab.id?"border-[var(--brand-orange)] text-[var(--brand-orange)]":"border-transparent text-slate-500"}`}>
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
              <button onClick={() => setFilterType("")} className={`px-2.5 py-1 rounded-lg text-[7px] font-black uppercase tracking-wider whitespace-nowrap ${!filterType?"bg-[var(--brand-orange)]/10 text-[var(--brand-orange)]":"bg-tertiary text-slate-500"}`}>{t("adminMisc.notifications.all")}</button>
              {Object.keys(TYPE_COLORS).map((t) => (
                <button key={t} onClick={() => setFilterType(t)} className={`px-2.5 py-1 rounded-lg text-[7px] font-black uppercase tracking-wider whitespace-nowrap ${filterType===t?"bg-[var(--brand-orange)]/10 text-[var(--brand-orange)]":"bg-tertiary text-slate-500"}`}>{t}</button>
              ))}
            </div>

            {/* List */}
            {filtered.length === 0 ? (
              <div className="text-center py-16"><Bell className="w-12 h-12 text-slate-600 mx-auto mb-3" /><p className="text-sm text-slate-500">{t("adminMisc.notifications.noNotifications")}</p></div>
            ) : (
              <div className="space-y-2">
                {filtered.map((n) => (
                  <div key={n.id}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${n.status==="unread" ? "bg-[var(--brand-orange)]/[0.02] border-[var(--brand-orange)]/20" : "bg-tertiary border-[var(--border-primary)] hover:border-[var(--brand-orange)]/30"}`}
                    onClick={() => n.status === "unread" && markRead(n.id)}>
                    <div className="flex items-start gap-3">
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${n.status==="unread" ? "bg-[var(--brand-orange)]" : "bg-transparent"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded ${TYPE_COLORS[n.type] || TYPE_COLORS.system}`}>{n.type}</span>
                          {n.priority === "urgent" && <span className="text-[7px] font-black text-rose-400">{t("adminMisc.notifications.urgent")}</span>}
                          <span className="text-[8px] text-slate-500 ml-auto">{new Date(n.created_at).toLocaleString()}</span>
                        </div>
                        <p className={`text-xs mt-1 ${n.status==="unread" ? "font-bold text-[var(--text-primary)]" : "font-medium text-[var(--text-secondary)]"}`}>{n.title}</p>
                        {n.body && <p className="text-[9px] text-slate-500 mt-0.5">{n.body}</p>}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {n.status === "unread" && <button onClick={(e) => { e.stopPropagation(); markRead(n.id); }} className="p-1.5 text-slate-500 hover:text-[var(--brand-orange)]"><CheckCircle2 className="w-3.5 h-3.5" /></button>}
                        <button onClick={(e) => { e.stopPropagation(); archiveNotif(n.id); }} className="p-1.5 text-slate-500 hover:text-blue-400"><Archive className="w-3.5 h-3.5" /></button>
                        <button onClick={(e) => { e.stopPropagation(); deleteNotif(n.id); }} className="p-1.5 text-slate-500 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
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
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 capitalize">{type}</h3>
                <div className="flex gap-4">
                  {["in_app", "email", "sms", "push"].map((channel) => (
                    <button key={channel} onClick={() => togglePref(type, channel)}
                      className={`px-4 py-2 rounded-xl text-[8px] font-black uppercase tracking-wider border transition-all ${
                        channels[channel] ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-primary text-slate-500 border-[var(--border-primary)]"
                      }`}>
                      {channel === "in_app" ? t("adminMisc.notifications.inApp") : channel.charAt(0).toUpperCase() + channel.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div className="card">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">{t("adminMisc.notifications.deliverySettings")}</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
                  <span className="text-[10px] font-bold text-[var(--text-primary)]">{t("adminMisc.notifications.digestFrequency")}</span>
                  <select value={preferences.digest_frequency || "realtime"}
                    onChange={async (e) => {
                      await fetch(`/api/notifications/venture`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update_preferences", updates: { digest_frequency: e.target.value } }) });
                      setPreferences((p) => ({ ...p, digest_frequency: e.target.value }));
                      notify(t("adminMisc.notifications.updated"));
                    }}
                    className="bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-1.5 text-[9px] font-bold outline-none">
                    <option value="realtime">{t("adminMisc.notifications.realtime")}</option><option value="hourly">{t("adminMisc.notifications.hourly")}</option><option value="daily">{t("adminMisc.notifications.daily")}</option><option value="weekly">{t("adminMisc.notifications.weekly")}</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

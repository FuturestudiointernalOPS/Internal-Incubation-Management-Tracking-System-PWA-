"use client";

import React, { useState, useEffect } from "react";
import { Calendar, Bell, Briefcase, Loader2, ArrowRight, Building2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { resolveNotificationTarget } from "@/lib/notificationLinks";

export const dynamic = "force-dynamic";

/**
 * Personal staff home (Vinance 3 — Manager & Coach, Phase 2).
 * "My Dashboard" — NOT a Venture dashboard: My Calendar (personal mode),
 * My Notifications (drill-down breadcrumb), My Ventures (assignments).
 */
export default function StaffPersonalHome() {
  const { t } = useI18n();
  const [cal, setCal] = useState({ loading: true, events: [] });
  const [notes, setNotes] = useState({ loading: true, rows: [], grouped: null });
  const [ventures, setVentures] = useState({ loading: true, list: [] });

  useEffect(() => {
    const now = new Date();
    (async () => {
      try {
        const res = await fetch(`/api/calendar?personal=1&year=${now.getFullYear()}&month=${now.getMonth() + 1}`);
        const d = await res.json();
        if (d.success) setCal({ loading: false, events: d.events || [] });
        else setCal({ loading: false, events: [] });
      } catch (_) {
        setCal({ loading: false, events: [] });
      }
    })();
    (async () => {
      try {
        const res = await fetch(`/api/notifications?group_by=context`);
        const d = await res.json();
        if (d.success) setNotes({ loading: false, rows: d.notifications || [], grouped: d.grouped || null });
        else setNotes({ loading: false, rows: [], grouped: null });
      } catch (_) {
        setNotes({ loading: false, rows: [], grouped: null });
      }
    })();
    (async () => {
      try {
        const res = await fetch(`/api/ventures/assigned`);
        const d = await res.json();
        if (d.success) setVentures({ loading: false, list: d.assignments || [] });
        else setVentures({ loading: false, list: [] });
      } catch (_) {
        setVentures({ loading: false, list: [] });
      }
    })();
  }, []);

  const fmtDay = (dateStr) => {
    if (!dateStr) return "";
    return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  };

  const upcoming = (cal.events || [])
    .slice()
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.start_time || "").localeCompare(String(b.start_time || "")))
    .slice(0, 10);

  const Card = ({ icon: Icon, title, children }) => (
    <section className="card">
      <h2 className="text-[11px] font-black text-[var(--text-primary)] uppercase tracking-wide flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-[var(--brand-orange)]" /> {title}
      </h2>
      {children}
    </section>
  );

  const Loading = () => <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-[var(--brand-orange)]" /></div>;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <header className="card">
        <h1 className="text-xl font-black text-[var(--text-primary)]">{t("venture.personal.title")}</h1>
        <p className="text-[10px] text-slate-400 mt-0.5">{t("venture.personal.subtitle")}</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* My Calendar */}
        <Card icon={Calendar} title={`${t("venture.personal.myCalendar")} · ${new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" })}`}>
          {cal.loading ? (
            <Loading />
          ) : upcoming.length === 0 ? (
            <p className="text-xs text-[var(--text-secondary)] py-4 text-center">{t("venture.personal.noEvents")}</p>
          ) : (
            <ul className="space-y-2">
              {upcoming.map((e, i) => (
                <li key={i} className="flex items-center gap-3 text-xs py-1.5 border-b border-[var(--border-primary)] last:border-0">
                  <span className="w-20 shrink-0 text-[10px] font-bold text-slate-500">{fmtDay(e.date)}{e.start_time ? ` · ${e.start_time}` : ""}</span>
                  <span className="font-medium text-[var(--text-primary)] truncate">{e.title}</span>
                  {e.source && <span className="ml-auto text-[9px] uppercase tracking-wider text-slate-500">{String(e.source).split("_")[0]}</span>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* My Notifications */}
        <Card icon={Bell} title={`${t("venture.personal.myNotifications")}${notes.rows.length ? ` (${notes.rows.length})` : ""}`}>
          {notes.loading ? (
            <Loading />
          ) : notes.rows.length === 0 ? (
            <p className="text-xs text-[var(--text-secondary)] py-4 text-center">{t("venture.personal.noNotifications")}</p>
          ) : (
            <>
              {notes.grouped && notes.grouped.ventures.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {notes.grouped.ventures.slice(0, 6).map((v) => (
                    <span key={v.venture_id} className="px-2 py-0.5 rounded-full bg-[var(--brand-orange)]/10 text-[var(--brand-orange)] text-[9px] font-black uppercase tracking-wider">
                      {v.venture_id.slice(0, 12)} · {v.count}
                    </span>
                  ))}
                  {notes.grouped.general > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-tertiary text-slate-400 text-[9px] font-black uppercase tracking-wider">
                      {t("venture.personal.general")} · {notes.grouped.general}
                    </span>
                  )}
                </div>
              )}
              <ul className="space-y-2">
                {notes.rows.slice(0, 8).map((n) => {
                  const target = resolveNotificationTarget(n, { role: "staff" });
                  const body = (
                    <li key={n.id} className="text-xs py-1.5 border-b border-[var(--border-primary)] last:border-0">
                      <span className="font-semibold text-[var(--text-primary)]">{n.title}</span>
                      {n.message && <span className="text-[var(--text-secondary)]"> — {n.message}</span>}
                      <span className="text-[9px] text-slate-500 block mt-0.5">{n.created_at ? new Date(n.created_at).toLocaleString() : ""}</span>
                    </li>
                  );
                  return target?.href ? (
                    <a key={n.id} href={target.href} className="block hover:bg-tertiary/50 rounded-lg px-1 -mx-1 transition-colors">
                      {body}
                    </a>
                  ) : (
                    body
                  );
                })}
              </ul>
            </>
          )}
        </Card>
      </div>

      {/* My Ventures */}
      <Card icon={Briefcase} title={t("venture.personal.myVentures")}>
        {ventures.loading ? (
          <Loading />
        ) : ventures.list.length === 0 ? (
          <p className="text-xs text-[var(--text-secondary)] py-4 text-center">{t("venture.personal.noVentures")}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {ventures.list.map((a) => (
              <a
                key={a.id}
                href={`/staff/ventures/${a.venture_id}`}
                className="rounded-xl border border-[var(--border-primary)] p-4 hover:bg-tertiary/60 transition-colors flex items-start gap-3"
              >
                <div className="w-9 h-9 rounded-xl bg-[var(--brand-orange)]/10 flex items-center justify-center shrink-0">
                  <Building2 className="w-4 h-4 text-[var(--brand-orange)]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-[var(--text-primary)] truncate">{a.company_name || a.name || a.venture_id}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {a.responsibility_name || a.responsibility_code}
                    {a.scope_type && a.scope_type !== "venture_wide" ? ` · ${a.scope_type}` : ""} · {a.status || "active"}
                  </p>
                  <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-[var(--brand-orange)] mt-1.5">
                    {t("venture.personal.open")} <ArrowRight className="w-2.5 h-2.5" />
                  </span>
                </div>
              </a>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

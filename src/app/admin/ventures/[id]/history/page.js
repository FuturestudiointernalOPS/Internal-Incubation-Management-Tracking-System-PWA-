"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, History, ShieldCheck, ClipboardList, FileText, CalendarClock } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * Admin → Ventures → [Venture] → History
 * Venture institutional memory (Vinance 3 — Phase 2): events, staff notes,
 * session records and submission review decisions assembled read-only.
 */
export default function VentureHistoryPage() {
  const { t } = useI18n();
  const { id } = useParams();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/ventures/${id}/venture-history`);
        const d = await res.json();
        if (d.success) setData(d);
        else setError(d.error || "Failed to load history.");
      } catch (e) {
        setError("Failed to load history.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const fmtDate = (v) => (v ? new Date(v).toLocaleString() : "");

  const Section = ({ icon: Icon, title, count, children }) => (
    <section className="card">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-[var(--brand-orange)]/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-[var(--brand-orange)]" />
        </div>
        <h2 className="text-[11px] font-black text-[var(--text-primary)] uppercase tracking-wide">
          {title} {count > 0 && <span className="text-slate-500">({count})</span>}
        </h2>
      </div>
      {children}
    </section>
  );

  const Empty = () => <p className="text-xs text-[var(--text-secondary)] py-2">{t("venture.history.empty")}</p>;

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <button
        onClick={() => router.push(`/admin/ventures/${id}`)}
        className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-[var(--text-primary)] transition-all"
      >
        <ArrowLeft className="w-3 h-3" /> {t("common.back") || "Back"}
      </button>

      <div className="card">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[var(--brand-orange)]/10 flex items-center justify-center">
            <History className="w-6 h-6 text-[var(--brand-orange)]" />
          </div>
          <div>
            <h1 className="text-xl font-black text-[var(--text-primary)]">{t("venture.history.title")}</h1>
            <p className="text-[10px] text-slate-400 mt-0.5">{t("venture.history.subtitle")}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--brand-orange)]" />
        </div>
      ) : error ? (
        <div className="card text-sm text-rose-400 p-4">{error}</div>
      ) : (
        <div className="space-y-5">
          {/* Events */}
          <Section icon={FileText} title={t("venture.history.events")} count={(data.timeline.events || []).length}>
            {(data.timeline.events || []).length === 0 ? (
              <Empty />
            ) : (
              <ul className="space-y-2">
                {(data.timeline.events || []).map((e, i) => (
                  <li key={i} className="flex items-start gap-3 text-xs py-1.5 border-b border-[var(--border-primary)] last:border-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-orange)] mt-1.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[var(--text-primary)] font-medium break-words">{e.description || e.event_type}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{fmtDate(e.created_at)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* Review decisions */}
          <Section icon={ShieldCheck} title={t("venture.history.reviews")} count={(data.timeline.review_decisions || []).length}>
            {(data.timeline.review_decisions || []).length === 0 ? (
              <Empty />
            ) : (
              <ul className="space-y-2">
                {(data.timeline.review_decisions || []).map((r, i) => (
                  <li key={i} className="text-xs py-1.5 border-b border-[var(--border-primary)] last:border-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[var(--text-primary)]">{r.task_title}</span>
                      {r.review_decision === "approved" ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold">{t("venture.history.decisionApproved")}</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-bold">{t("venture.history.decisionChanges")}</span>
                      )}
                      <span className="text-[10px] text-slate-500">v{r.version} · {fmtDate(r.reviewed_at || r.created_at)}</span>
                    </div>
                    {r.review_comment && <p className="mt-1 text-[var(--text-secondary)] break-words">{r.review_comment}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* Staff notes (staff only) */}
          {data.staff && (
            <Section icon={ClipboardList} title={t("venture.history.staffNotes")} count={(data.timeline.notes || []).length}>
              {(data.timeline.notes || []).length === 0 ? (
                <Empty />
              ) : (
                <ul className="space-y-2">
                  {(data.timeline.notes || []).map((n) => (
                    <li key={n.id} className="text-xs py-1.5 border-b border-[var(--border-primary)] last:border-0">
                      <p className="font-semibold text-[var(--text-primary)]">{n.title}</p>
                      <p className="text-[var(--text-secondary)] mt-0.5 break-words whitespace-pre-line">{n.body}</p>
                      <p className="text-[10px] text-slate-500 mt-1">{n.author_name || ""}{n.author_name && " · "}{fmtDate(n.created_at)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          )}

          {/* Session records (staff only) */}
          {data.staff && (
            <Section icon={CalendarClock} title={t("venture.history.sessionNotes")} count={(data.timeline.session_notes || []).length}>
              {(data.timeline.session_notes || []).length === 0 ? (
                <Empty />
              ) : (
                <ul className="space-y-2">
                  {(data.timeline.session_notes || []).map((s) => (
                    <li key={s.id} className="text-xs py-1.5 border-b border-[var(--border-primary)] last:border-0">
                      <p className="font-semibold text-[var(--text-primary)]">{s.session_title}</p>
                      <p className="text-[var(--text-secondary)] mt-0.5 break-words whitespace-pre-line">{s.content}</p>
                      <p className="text-[10px] text-slate-500 mt-1">{s.author_name || ""}{s.author_name && " · "}{fmtDate(s.created_at)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

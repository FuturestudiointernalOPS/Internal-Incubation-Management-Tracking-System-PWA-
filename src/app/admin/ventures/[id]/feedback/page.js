"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Loader2, Star, MessageCircle, TrendingUp, Users,
} from "lucide-react";
import { useApi } from "@/lib/hooks/useApi";
import { useI18n } from "@/lib/i18n";

// ─── Module-scope readers ────────────────────────────────────────────────────
// The reading hook keys its internal work on these, so they are made once here
// rather than rebuilt on every render.

const EMPTY_LIST = [];

const pickVenture = (payload) => (payload?.success ? payload.venture || null : null);
const pickPayload = (payload) => (payload?.success ? payload : null);
const pickFeedback = (payload) => (payload?.success ? payload.feedback || [] : []);
const pickAnalytics = (payload) => (payload?.success ? payload.analytics || [] : []);

export default function VentureFeedbackPage() {
  const { id } = useParams();
  const router = useRouter();
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState("overview");

  // The venture and its coaching feedback, through the shared hook: it owns the
  // cache, the cache-first paint and the discarding of a stale answer, so the page
  // keeps no copy of its own and reads its data during render.
  const { data: venture, loading: ventureLoading } = useApi(
    id ? `/api/ventures/${id}` : null,
    { defaultValue: null, transform: pickVenture, deps: [id] },
  );
  const { data: feedback, loading: feedbackLoading } = useApi(
    id ? `/api/ventures/${id}/feedback` : null,
    { defaultValue: EMPTY_LIST, transform: pickFeedback, deps: [id] },
  );
  const {
    data: coachAnalytics,
    loading: coachAnalyticsLoading,
  } = useApi(
    id ? `/api/ventures/${id}/feedback?type=analytics_coaches` : null,
    { defaultValue: EMPTY_LIST, transform: pickAnalytics, deps: [id] },
  );
  const {
    data: advisorAnalytics,
    loading: advisorAnalyticsLoading,
  } = useApi(
    id ? `/api/ventures/${id}/feedback?type=analytics_advisors` : null,
    { defaultValue: EMPTY_LIST, transform: pickAnalytics, deps: [id] },
  );
  const {
    data: sessionStats,
    loading: sessionStatsLoading,
  } = useApi(
    id ? `/api/ventures/${id}/feedback?type=analytics_sessions` : null,
    { defaultValue: null, transform: pickPayload, deps: [id] },
  );
  const {
    data: feedbackTrend,
    loading: feedbackTrendLoading,
  } = useApi(
    id ? `/api/ventures/${id}/feedback?type=analytics_feedback` : null,
    { defaultValue: null, transform: pickPayload, deps: [id] },
  );

  const loading =
    ventureLoading ||
    feedbackLoading ||
    coachAnalyticsLoading ||
    advisorAnalyticsLoading ||
    sessionStatsLoading ||
    feedbackTrendLoading;


  const renderStars = (rating) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star key={star} className={`w-3 h-3 ${star <= Math.round(rating || 0) ? "text-amber-400 fill-amber-400" : "text-slate-600"}`} />
      ))}
    </div>
  );

  const progressBar = (percentage, color = "bg-[var(--brand-orange)]") => (
    <div className="w-full bg-tertiary rounded-full h-1.5 overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(percentage||0, 100)}%` }} />
    </div>
  );

  const statCard = (label, value, sub) => (
    <div className="p-4 rounded-2xl bg-tertiary border border-[var(--border-primary)]">
      <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{label}</p>
      <p className="text-2xl font-black text-[var(--text-primary)] mt-1">{value}</p>
      {sub && <p className="text-[8px] text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );

  if (loading) return (
    <><div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-[var(--brand-orange)]" /></div></>
  );

  return (
    <>
      <div className="space-y-8 pb-20">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <button onClick={() => router.push(`/admin/ventures/${id}`)}
              className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-[var(--text-primary)] transition-all mb-2">
              <ArrowLeft className="w-3 h-3" /> Back to Dashboard
            </button>
            <h1 className="text-2xl font-black text-[var(--text-primary)] flex items-center gap-3">
              <Star className="w-6 h-6 text-amber-400" /> Mentor Feedback & Analytics
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">{venture?.company_name||""}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-[var(--border-primary)]">
          {[
            { id: "overview", label: "Overview", icon: TrendingUp },
            { id: "coaches", label: `Coaches (${coachAnalytics.length})`, icon: Users },
            { id: "advisors", label: `Advisors (${advisorAnalytics.length})`, icon: Users },
            { id: "feedback", label: `Feedback (${feedback.length})`, icon: MessageCircle },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5 border-b-2 transition-all ${activeTab===tab.id ? "border-[var(--brand-orange)] text-[var(--brand-orange)]" : "border-transparent text-slate-500"}`}>
                <Icon className="w-3 h-3" />{tab.label}
              </button>
            );
          })}
        </div>

        {/* Overview */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {statCard("Total Sessions", sessionStats?.total_sessions||0, `${sessionStats?.completed||0} completed`)}
              {statCard("Avg Rating", sessionStats?.average_rating ? sessionStats.average_rating.toFixed(1) : "—", `${sessionStats?.feedback_count||0} ratings`)}
              {statCard("Completion Rate", `${sessionStats?.completion_rate||0}%`, "")}
              {statCard("Hours", `${sessionStats?.total_hours||0}h`, "")}
            </div>

            {/* Feedback Distribution */}
            {feedbackTrend.distribution?.length > 0 && (
              <div className="card">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Rating Distribution</h3>
                <div className="space-y-2">
                  {[5,4,3,2,1].map((rating) => {
                    const item = (feedbackTrend.distribution||[]).find((entry) => parseInt(entry.rating_overall) === rating);
                    const max = Math.max(...(feedbackTrend.distribution||[]).map((entry) => parseInt(entry.c)), 1);
                    const count = parseInt(item?.c||0);
                    return (
                      <div key={rating} className="flex items-center gap-3">
                        <span className="text-[9px] font-bold text-slate-500 w-4">{rating}</span>
                        {renderStars(rating)}
                        <div className="flex-1 bg-tertiary rounded-full h-2 overflow-hidden">
                          <div className="h-full rounded-full bg-amber-400" style={{ width: `${(count/max)*100}%` }} />
                        </div>
                        <span className="text-[8px] text-slate-500 w-6 text-right">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Top Coaches */}
            {coachAnalytics.length > 0 && (
              <div className="card">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Top Rated Coaches</h3>
                <div className="space-y-3">
                  {coachAnalytics.slice(0, 5).map((coach) => (
                    <div key={coach.coach_id} className="flex items-center justify-between p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[var(--brand-orange)]/10 flex items-center justify-center text-[10px] font-black text-[var(--brand-orange)]">{coach.full_name?.charAt(0)}</div>
                        <div>
                          <p className="text-[10px] font-bold text-[var(--text-primary)]">{coach.full_name}</p>
                          <div className="flex items-center gap-2 text-[8px] text-slate-500">
                            {renderStars(coach.average_rating)} <span>{coach.average_rating?.toFixed(1)}</span>
                            <span>· {coach.sessions_completed} sessions</span>
                          </div>
                        </div>
                      </div>
                      <span className="text-[9px] font-bold text-emerald-400">{coach.engagement_score}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Coaches Analytics */}
        {activeTab === "coaches" && (
          <div className="space-y-3">
            {coachAnalytics.length === 0 ? <p className="text-sm text-slate-500 text-center py-8">No coach analytics yet</p> : (
              coachAnalytics.map((coach) => (
                <div key={coach.coach_id} className="p-5 rounded-2xl bg-tertiary border border-[var(--border-primary)]">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[var(--brand-orange)]/10 flex items-center justify-center text-sm font-black text-[var(--brand-orange)]">{coach.full_name?.charAt(0)}</div>
                      <div>
                        <p className="text-sm font-bold text-[var(--text-primary)]">{coach.full_name}</p>
                        <p className="text-[8px] text-slate-500">{coach.organization||""}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1">{renderStars(coach.average_rating)}</div>
                      <p className="text-[9px] font-bold text-slate-500">{coach.average_rating?.toFixed(1) || "—"}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                    <div><p className="text-[7px] font-black text-slate-500 uppercase">{t("vadmin.feedback.sessions")}</p><p className="text-sm font-bold">{coach.sessions_completed||0}</p></div>
                    <div><p className="text-[7px] font-black text-slate-500 uppercase">{t("vadmin.feedback.attendanceAbbr")}</p><p className="text-sm font-bold text-emerald-400">{coach.attendance_rate||0}%</p></div>
                    <div><p className="text-[7px] font-black text-slate-500 uppercase">{t("vadmin.feedback.cancelRate")}</p><p className="text-sm font-bold text-rose-400">{coach.cancellation_rate||0}%</p></div>
                    <div><p className="text-[7px] font-black text-slate-500 uppercase">{t("vadmin.feedback.hours")}</p><p className="text-sm font-bold">{coach.mentoring_hours||0}h</p></div>
                  </div>
                  {progressBar(coach.engagement_score, coach.engagement_score>=70?"bg-emerald-500":coach.engagement_score>=40?"bg-amber-500":"bg-rose-500")}
                </div>
              ))
            )}
          </div>
        )}

        {/* Advisors Analytics */}
        {activeTab === "advisors" && (
          <div className="space-y-3">
            {advisorAnalytics.length === 0 ? <p className="text-sm text-slate-500 text-center py-8">No advisor analytics yet</p> : (
              advisorAnalytics.map((advisor) => (
                <div key={advisor.coach_id} className="p-4 rounded-xl bg-tertiary border border-[var(--border-primary)]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center text-[10px] font-black text-purple-400">{advisor.full_name?.charAt(0)}</div>
                      <div>
                        <p className="text-xs font-bold text-[var(--text-primary)]">{advisor.full_name}</p>
                        <p className="text-[8px] text-slate-500">{advisor.organization||""}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">{renderStars(advisor.average_rating)} <span className="text-[9px] font-bold">{advisor.average_rating?.toFixed(1)}</span></div>
                  </div>
                  <div className="flex gap-3 mt-2 text-[8px] text-slate-500">
                    <span>{advisor.sessions_completed||0} sessions</span>
                    <span>{advisor.assigned_ventures||0} ventures</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Feedback List */}
        {activeTab === "feedback" && (
          <div className="space-y-3">
            {feedback.length === 0 ? <p className="text-sm text-slate-500 text-center py-8">No feedback yet</p> : (
              feedback.map((feedbackEntry) => (
                <div key={feedbackEntry.id} className="p-4 rounded-xl bg-tertiary border border-[var(--border-primary)]">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-[var(--text-primary)]">{feedbackEntry.session_title || `Session #${feedbackEntry.session_id}`}</span>
                      <span className="text-[7px] text-slate-500 capitalize">{feedbackEntry.session_type}</span>
                    </div>
                    {renderStars(feedbackEntry.rating_overall)}
                  </div>
                  <div className="flex gap-2 mb-2">
                    {feedbackEntry.rating_communication && <span className="text-[7px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400">Comm: {feedbackEntry.rating_communication}/5</span>}
                    {feedbackEntry.rating_expertise && <span className="text-[7px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">Exp: {feedbackEntry.rating_expertise}/5</span>}
                    {feedbackEntry.rating_availability && <span className="text-[7px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400">Avail: {feedbackEntry.rating_availability}/5</span>}
                    {feedbackEntry.rating_helpfulness && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400">Help: {feedbackEntry.rating_helpfulness}/5</span>}
                  </div>
                  {feedbackEntry.comments && <p className="text-sm text-[var(--text-secondary)]">&quot;{feedbackEntry.comments}&quot;</p>}
                  <div className="flex items-center gap-2 mt-2 text-[10px] text-[var(--text-secondary)]">
                    <span>{feedbackEntry.coach_name || "Unknown coach"}</span>
                    <span>· {new Date(feedbackEntry.created_at).toLocaleDateString()}</span>
                    {feedbackEntry.is_anonymous && <span>· Anonymous</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </>
  );
}

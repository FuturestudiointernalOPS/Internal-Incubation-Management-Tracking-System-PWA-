"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Loader2, CheckCircle2, AlertCircle, Star, MessageCircle, TrendingUp, Users, Calendar,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useI18n } from "@/lib/i18n";

export default function VentureFeedbackPage() {
  const { id } = useParams();
  const router = useRouter();
  const { t } = useI18n();
  const [venture, setVenture] = useState(null);
  const [feedback, setFeedback] = useState([]);
  const [coachAnalytics, setCoachAnalytics] = useState([]);
  const [advisorAnalytics, setAdvisorAnalytics] = useState([]);
  const [sessionStats, setSessionStats] = useState(null);
  const [feedbackTrend, setFeedbackTrend] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [vRes, fRes, caRes, aaRes, ssRes, ftRes] = await Promise.all([
        fetch(`/api/ventures/${id}`),
        fetch(`/api/ventures/${id}/feedback`),
        fetch(`/api/ventures/${id}/feedback?type=analytics_coaches`),
        fetch(`/api/ventures/${id}/feedback?type=analytics_advisors`),
        fetch(`/api/ventures/${id}/feedback?type=analytics_sessions`),
        fetch(`/api/ventures/${id}/feedback?type=analytics_feedback`),
      ]);
      const v = await vRes.json(); const f = await fRes.json(); const ca = await caRes.json();
      const aa = await aaRes.json(); const ss = await ssRes.json(); const ft = await ftRes.json();
      if (v.success) setVenture(v.venture);
      if (f.success) setFeedback(f.feedback || []);
      if (ca.success) setCoachAnalytics(ca.analytics || []);
      if (aa.success) setAdvisorAnalytics(aa.analytics || []);
      if (ss.success) setSessionStats(ss);
      if (ft.success) setFeedbackTrend(ft);
    } catch {} finally { setLoading(false); }
  };

  const renderStars = (rating) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} className={`w-3 h-3 ${s <= Math.round(rating || 0) ? "text-amber-400 fill-amber-400" : "text-slate-600"}`} />
      ))}
    </div>
  );

  const progressBar = (pct, color = "bg-[var(--brand-orange)]") => (
    <div className="w-full bg-tertiary rounded-full h-1.5 overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(pct||0, 100)}%` }} />
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
    <DashboardLayout role="super_admin"><div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-[var(--brand-orange)]" /></div></DashboardLayout>
  );

  return (
    <DashboardLayout role="super_admin">
      <div className="space-y-8 pb-20">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <button onClick={() => router.push(`/admin/ventures/${id}/dashboard`)}
              className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-[var(--text-primary)] transition-all mb-2">
              <ArrowLeft className="w-3 h-3" /> {t("vadmin.feedback.backToDashboard")}
            </button>
            <h1 className="text-2xl font-black text-[var(--text-primary)] flex items-center gap-3">
              <Star className="w-6 h-6 text-amber-400" /> {t("vadmin.feedback.title")}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">{venture?.company_name||""}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-[var(--border-primary)]">
          {[
            { id: "overview", label: t("vadmin.feedback.overview"), icon: TrendingUp },
            { id: "coaches", label: t("vadmin.feedback.coaches", { count: coachAnalytics.length }), icon: Users },
            { id: "advisors", label: t("vadmin.feedback.advisors", { count: advisorAnalytics.length }), icon: Users },
            { id: "feedback", label: t("vadmin.feedback.tabFeedback", { count: feedback.length }), icon: MessageCircle },
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
              {statCard(t("vadmin.feedback.totalSessions"), sessionStats?.total_sessions||0, t("vadmin.feedback.completedCount", { count: sessionStats?.completed||0 }))}
              {statCard(t("vadmin.feedback.avgRating"), sessionStats?.average_rating ? sessionStats.average_rating.toFixed(1) : "—", t("vadmin.feedback.ratingsCount", { count: sessionStats?.feedback_count||0 }))}
              {statCard(t("vadmin.feedback.completionRate"), `${sessionStats?.completion_rate||0}%`, "")}
              {statCard(t("vadmin.feedback.hours"), `${sessionStats?.total_hours||0}h`, "")}
            </div>

            {/* Feedback Distribution */}
            {feedbackTrend.distribution?.length > 0 && (
              <div className="card">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">{t("vadmin.feedback.ratingDistribution")}</h3>
                <div className="space-y-2">
                  {[5,4,3,2,1].map((r) => {
                    const item = (feedbackTrend.distribution||[]).find((d) => parseInt(d.rating_overall) === r);
                    const max = Math.max(...(feedbackTrend.distribution||[]).map((d) => parseInt(d.c)), 1);
                    const cnt = parseInt(item?.c||0);
                    return (
                      <div key={r} className="flex items-center gap-3">
                        <span className="text-[9px] font-bold text-slate-500 w-4">{r}</span>
                        {renderStars(r)}
                        <div className="flex-1 bg-tertiary rounded-full h-2 overflow-hidden">
                          <div className="h-full rounded-full bg-amber-400" style={{ width: `${(cnt/max)*100}%` }} />
                        </div>
                        <span className="text-[8px] text-slate-500 w-6 text-right">{cnt}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Top Coaches */}
            {coachAnalytics.length > 0 && (
              <div className="card">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">{t("vadmin.feedback.topRatedCoaches")}</h3>
                <div className="space-y-3">
                  {coachAnalytics.slice(0, 5).map((c) => (
                    <div key={c.coach_id} className="flex items-center justify-between p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[var(--brand-orange)]/10 flex items-center justify-center text-[10px] font-black text-[var(--brand-orange)]">{c.full_name?.charAt(0)}</div>
                        <div>
                          <p className="text-[10px] font-bold text-[var(--text-primary)]">{c.full_name}</p>
                          <div className="flex items-center gap-2 text-[8px] text-slate-500">
                            {renderStars(c.average_rating)} <span>{c.average_rating?.toFixed(1)}</span>
                            <span>· {t("vadmin.feedback.sessionsCount", { count: c.sessions_completed })}</span>
                          </div>
                        </div>
                      </div>
                      <span className="text-[9px] font-bold text-emerald-400">{c.engagement_score}%</span>
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
            {coachAnalytics.length === 0 ? <p className="text-sm text-slate-500 text-center py-8">{t("vadmin.feedback.noCoachAnalytics")}</p> : (
              coachAnalytics.map((c) => (
                <div key={c.coach_id} className="p-5 rounded-2xl bg-tertiary border border-[var(--border-primary)]">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[var(--brand-orange)]/10 flex items-center justify-center text-sm font-black text-[var(--brand-orange)]">{c.full_name?.charAt(0)}</div>
                      <div>
                        <p className="text-sm font-bold text-[var(--text-primary)]">{c.full_name}</p>
                        <p className="text-[8px] text-slate-500">{c.organization||""}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1">{renderStars(c.average_rating)}</div>
                      <p className="text-[9px] font-bold text-slate-500">{c.average_rating?.toFixed(1) || "—"}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                    <div><p className="text-[7px] font-black text-slate-500 uppercase">{t("vadmin.feedback.sessions")}</p><p className="text-sm font-bold">{c.sessions_completed||0}</p></div>
                    <div><p className="text-[7px] font-black text-slate-500 uppercase">{t("vadmin.feedback.attendanceAbbr")}</p><p className="text-sm font-bold text-emerald-400">{c.attendance_rate||0}%</p></div>
                    <div><p className="text-[7px] font-black text-slate-500 uppercase">{t("vadmin.feedback.cancelRate")}</p><p className="text-sm font-bold text-rose-400">{c.cancellation_rate||0}%</p></div>
                    <div><p className="text-[7px] font-black text-slate-500 uppercase">{t("vadmin.feedback.hours")}</p><p className="text-sm font-bold">{c.mentoring_hours||0}h</p></div>
                  </div>
                  {progressBar(c.engagement_score, c.engagement_score>=70?"bg-emerald-500":c.engagement_score>=40?"bg-amber-500":"bg-rose-500")}
                </div>
              ))
            )}
          </div>
        )}

        {/* Advisors Analytics */}
        {activeTab === "advisors" && (
          <div className="space-y-3">
            {advisorAnalytics.length === 0 ? <p className="text-sm text-slate-500 text-center py-8">{t("vadmin.feedback.noAdvisorAnalytics")}</p> : (
              advisorAnalytics.map((c) => (
                <div key={c.coach_id} className="p-4 rounded-xl bg-tertiary border border-[var(--border-primary)]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center text-[10px] font-black text-purple-400">{c.full_name?.charAt(0)}</div>
                      <div>
                        <p className="text-xs font-bold text-[var(--text-primary)]">{c.full_name}</p>
                        <p className="text-[8px] text-slate-500">{c.organization||""}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">{renderStars(c.average_rating)} <span className="text-[9px] font-bold">{c.average_rating?.toFixed(1)}</span></div>
                  </div>
                  <div className="flex gap-3 mt-2 text-[8px] text-slate-500">
                    <span>{t("vadmin.feedback.sessionsCount", { count: c.sessions_completed||0 })}</span>
                    <span>{t("vadmin.feedback.venturesCount", { count: c.assigned_ventures||0 })}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Feedback List */}
        {activeTab === "feedback" && (
          <div className="space-y-3">
            {feedback.length === 0 ? <p className="text-sm text-slate-500 text-center py-8">{t("vadmin.feedback.noFeedback")}</p> : (
              feedback.map((f) => (
                <div key={f.id} className="p-4 rounded-xl bg-tertiary border border-[var(--border-primary)]">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-[var(--text-primary)]">{f.session_title || t("vadmin.feedback.sessionNumber", { id: f.session_id })}</span>
                      <span className="text-[7px] text-slate-500 capitalize">{f.session_type}</span>
                    </div>
                    {renderStars(f.rating_overall)}
                  </div>
                  <div className="flex gap-2 mb-2">
                    {f.rating_communication && <span className="text-[7px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400">{t("vadmin.feedback.commRating", { value: f.rating_communication })}</span>}
                    {f.rating_expertise && <span className="text-[7px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">{t("vadmin.feedback.expRating", { value: f.rating_expertise })}</span>}
                    {f.rating_availability && <span className="text-[7px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400">{t("vadmin.feedback.availRating", { value: f.rating_availability })}</span>}
                    {f.rating_helpfulness && <span className="text-[7px] font-bold px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400">{t("vadmin.feedback.helpRating", { value: f.rating_helpfulness })}</span>}
                  </div>
                  {f.comments && <p className="text-[9px] text-slate-500 italic">"{f.comments}"</p>}
                  <div className="flex items-center gap-2 mt-2 text-[7px] text-slate-600">
                    <span>{f.coach_name || t("vadmin.feedback.unknownCoach")}</span>
                    <span>· {new Date(f.created_at).toLocaleDateString()}</span>
                    {f.is_anonymous && <span>· {t("vadmin.feedback.anonymous")}</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

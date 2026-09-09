"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import {
  RefreshCw,
  Loader2,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Layers,
  Rocket,
  Calendar,
  Users,
  Target,
  FileText,
  Bell,
  Zap,
  Shield,
  BookOpen,
  TrendingUp,
  Activity,
  Briefcase,
  Building2,
  User,
  Clock,
  ChevronRight,
  Plus,
  Mail,
  Crown,
  Ban,
  Send,
} from "lucide-react";
import { cacheGet, cacheSet } from "@/lib/hooks/useApi";

// ─── Widget Components ────────────────────────────────────────────────────

function WidgetCard({ title, icon: Icon, iconColor, children, loading, error, onRefresh, empty, emptyMessage }) {
  const { t } = useI18n();
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${iconColor || "bg-[var(--brand-orange)]/10"}`}>
            <Icon className="w-4 h-4 text-[var(--brand-orange)]" />
          </div>
          <h3 className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide">{title}</h3>
        </div>
        {onRefresh && (
          <button onClick={onRefresh} className="p-1.5 hover:bg-white/5 rounded-lg transition-all">
            <RefreshCw className={`w-3 h-3 text-slate-500 ${loading ? "animate-spin" : ""}`} />
          </button>
        )}
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--brand-orange)]" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <AlertCircle className="w-8 h-8 text-rose-400 mb-2" />
          <p className="text-[10px] font-bold text-rose-400">{error}</p>
        </div>
      ) : empty ? (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <Icon className="w-8 h-8 text-slate-600 mb-2" />
          <p className="text-[10px] font-bold text-[var(--text-secondary)]">{emptyMessage || t("vadmin.dashboard.noDataAvailable")}</p>
        </div>
      ) : (
        children
      )}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="card animate-pulse">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-slate-700/50" />
        <div className="h-3 w-32 rounded bg-slate-700/50" />
      </div>
      <div className="space-y-3">
        <div className="h-4 w-3/4 rounded bg-slate-700/50" />
        <div className="h-4 w-1/2 rounded bg-slate-700/50" />
        <div className="h-4 w-2/3 rounded bg-slate-700/50" />
      </div>
    </div>
  );
}

// ─── Main Dashboard Component ────────────────────────────────────────────

export default function VentureDashboard({ id, embedded = false }) {
  const router = useRouter();
  const { t, lang } = useI18n();

  const [venture, setVenture] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Individual widget states
  const [widgetStates, setWidgetStates] = useState({});

  useEffect(() => {
    // The hub page already fetches the venture record for its own header; only
    // the standalone route needs this component to fetch it too.
    if (!embedded) fetchVenture();
    fetchDashboard();
  }, [refreshKey, embedded, id]);

  const fetchVenture = async (bypassCache = false) => {
    const url = `/api/ventures/${id}`;
    const apply = (data) => {
      if (data.success) setVenture(data.venture);
    };
    let painted = false;
    try {
      // Cache-first paint: returning to this page renders instantly from a
      // fresh snapshot; mutation flows pass bypassCache=true so the venture
      // always reflects the last action.
      if (!bypassCache) {
        const cached = cacheGet(url);
        if (cached !== null && cached.success) {
          apply(cached);
          setLoading(false);
          painted = true;
        }
      }
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) cacheSet(url, data);
      apply(data);
    } catch (e) {
      if (!painted) setError(t("vadmin.dashboard.loadFailed"));
    }
  };

  const fetchDashboard = async (bypassCache = false) => {
    const url = `/api/ventures/${id}/dashboard`;
    const apply = (data) => {
      if (!data.success) {
        setError(t(data.error || "Failed to load dashboard") || data.error || "Failed to load dashboard");
        return;
      }
      setDashboard(data.dashboard);
      // Set individual widget states based on which data loaded
      const states = {};
      for (const [key, val] of Object.entries(data.dashboard)) {
        states[key] = {
          loading: false,
          error: val === null ? t("vadmin.dashboard.loadFailed") : null,
          empty: val === null ? false : isWidgetEmpty(key, val),
          data: val,
        };
      }
      setWidgetStates(states);
    };
    let painted = false;
    setLoading(true);
    setError(null);
    try {
      // Cache-first paint: returning to this page renders instantly from a
      // fresh snapshot; mutation flows pass bypassCache=true so the widgets
      // always reflect the last action.
      if (!bypassCache) {
        const cached = cacheGet(url);
        if (cached !== null && cached.success) {
          apply(cached);
          setLoading(false);
          painted = true;
        }
      }
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) cacheSet(url, data);
      apply(data);
    } catch (e) {
      if (!painted) setError(t("vadmin.dashboard.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  const isWidgetEmpty = (key, data) => {
    if (!data) return true;
    if (Array.isArray(data)) return data.length === 0;
    if (typeof data === "object") {
      if (data.recent && Array.isArray(data.recent)) return data.recent.length === 0 && !data.unread;
      if (data.items && Array.isArray(data.items)) return data.items.length === 0;
      return Object.keys(data).length === 0;
    }
    return false;
  };

  const refreshWidget = (key) => {
    setWidgetStates((prev) => ({ ...prev, [key]: { ...prev[key], loading: true, error: null } }));
    fetch(`/api/ventures/${id}/dashboard`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setDashboard(data.dashboard);
          const val = data.dashboard[key];
          setWidgetStates((prev) => ({
            ...prev,
            [key]: { loading: false, error: null, empty: isWidgetEmpty(key, val), data: val },
          }));
        }
      })
      .catch(() => {
        setWidgetStates((prev) => ({ ...prev, [key]: { ...prev[key], loading: false, error: t("vadmin.dashboard.refreshFailed") } }));
      });
  };

  const ws = (key) => widgetStates[key] || { loading: true, error: null, empty: false, data: null };

  // Verification widget status → localized label; unknown statuses stay raw.
  const verificationStatusLabel = (status) => {
    const key =
      status === "verified" ? "verified" :
      status === "pending_review" ? "pending" :
      status === "rejected" ? "rejected" :
      status === "draft" ? "draft" : null;
    return key ? t(`vadmin.dashboard.${key}`) : (status ? status.replace(/_/g, " ") : t("vadmin.dashboard.draft"));
  };

  // When embedded in the Venture hub page, the hub provides the outer chrome
  // (venture header, tabs, back link); the standalone route keeps its own.
  const wrapperClass = embedded ? "space-y-8" : "max-w-6xl mx-auto space-y-8 pb-20";

  // ── Loading state (skeleton) ──
  if (loading && !dashboard) {
    return (
      <>
        <div className={wrapperClass}>
          {!embedded && (
            <div className="animate-pulse">
              <div className="h-8 w-64 rounded bg-slate-700/50 mb-2" />
              <div className="h-4 w-96 rounded bg-slate-700/50" />
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        </div>
      </>
    );
  }

  // ── Error state (inline card — the hub header stays visible when embedded) ──
  if (error && !dashboard) {
    return (
      <>
        <div className={wrapperClass}>
          <div className="text-center py-16">
            <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">{t("vadmin.dashboard.dashboardError")}</h2>
            <p className="text-[var(--text-secondary)] mb-6">{error}</p>
            <button onClick={() => setRefreshKey((k) => k + 1)} className="btn btn-primary gap-2">
              <RefreshCw className="w-4 h-4" /> {t("vadmin.dashboard.retry")}
            </button>
          </div>
        </div>
      </>
    );
  }

  const d = dashboard || {};
  const v = venture || {};

  return (
    <>
      <div className={wrapperClass}>
        {!embedded && (
          <>
            {/* Header (standalone route only — the hub supplies its own) */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <button
                  onClick={() => router.push(`/admin/ventures/${id}`)}
                  className="flex items-center gap-2 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest hover:text-[var(--text-primary)] transition-all mb-2"
                >
                  <ChevronRight className="w-3 h-3 rotate-180" /> {t("vadmin.dashboard.backToVenture", { name: v.company_name || t("vadmin.dashboard.venture") })}
                </button>
                <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight flex items-center gap-3">
                  <Rocket className="w-7 h-7 text-[var(--brand-orange)]" />
                  {t("vadmin.dashboard.startupDashboard")}
                </h1>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  {v.company_name} · {v.venture_id} · {t("vadmin.dashboard.updatedAt", { time: new Date().toLocaleTimeString(lang) })}
                </p>
              </div>
              <button
                onClick={() => setRefreshKey((k) => k + 1)}
                className="px-4 py-2.5 rounded-xl border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-widest hover:bg-tertiary transition-all flex items-center gap-2"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                {t("vadmin.dashboard.refreshAll")}
              </button>
            </div>
          </>
        )}

        {/* Manager attention (Vinance 3 — what needs attention right now) */}
        <AttentionWidget id={id} />

        {/* Health Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20">
            <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-1">{t("vadmin.dashboard.profile")}</p>
            <p className="text-2xl font-black text-emerald-400">{d.profile_completion?.percentage || 0}%</p>
            <p className="text-[10px] text-emerald-500/60 mt-0.5">{d.profile_completion?.is_submitted ? t("vadmin.dashboard.submitted") : t("vadmin.dashboard.sectionsMissing", { count: d.profile_completion?.missing?.length || 0 })}</p>
          </div>
          <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/20">
            <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-1">{t("vadmin.dashboard.stage")}</p>
            <p className="text-2xl font-black text-amber-400 capitalize">{d.venture?.business_stage?.replace(/_/g, " ") || "—"}</p>
            <p className="text-[10px] text-amber-500/60 mt-0.5">{t("vadmin.dashboard.currentMilestone")}</p>
          </div>
          <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20">
            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">{t("vadmin.dashboard.team")}</p>
            <p className="text-2xl font-black text-blue-400">{d.founders?.active || 0}</p>
            <p className="text-[10px] text-blue-500/60 mt-0.5">{t("vadmin.dashboard.activeMembers")}</p>
          </div>
          <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/20">
            <p className="text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-1">{t("vadmin.dashboard.readiness")}</p>
            <p className="text-2xl font-black text-purple-400">{d.investment_readiness?.score || 0}%</p>
            <p className="text-[10px] text-purple-500/60 mt-0.5">{t("vadmin.dashboard.investmentScore")}</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card">
          <h3 className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide mb-3 flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-[var(--brand-orange)]" /> {t("vadmin.dashboard.quickActions")}
          </h3>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => router.push(`/ventures/${id}/wizard`)} className="px-3 py-2 bg-[var(--brand-orange)]/10 text-[var(--brand-orange)] rounded-xl text-[10px] font-bold uppercase tracking-wider hover:brightness-110 transition-all flex items-center gap-1.5">
              <Layers className="w-3 h-3" /> {t("vadmin.dashboard.profileWizard")}
            </button>
            <button onClick={() => router.push(`/admin/ventures/${id}/verification`)} className="px-3 py-2 bg-emerald-500/10 text-emerald-400 rounded-xl text-[10px] font-bold uppercase tracking-wider hover:brightness-110 transition-all flex items-center gap-1.5">
              <Shield className="w-3 h-3" /> {t("vadmin.dashboard.uploadDocuments")}
            </button>
            <button onClick={() => router.push(`/admin/ventures/${id}/founders`)} className="px-3 py-2 bg-blue-500/10 text-blue-400 rounded-xl text-[10px] font-bold uppercase tracking-wider hover:brightness-110 transition-all flex items-center gap-1.5">
              <User className="w-3 h-3" /> {t("vadmin.dashboard.inviteFounder")}
            </button>
            <button onClick={() => router.push(`/admin/ventures/${id}/edit`)} className="px-3 py-2 bg-amber-500/10 text-amber-400 rounded-xl text-[10px] font-bold uppercase tracking-wider hover:brightness-110 transition-all flex items-center gap-1.5">
              <Building2 className="w-3 h-3" /> {t("vadmin.dashboard.editVenture")}
            </button>
            <button onClick={() => router.push(`/admin/knowledge`)} className="px-3 py-2 bg-purple-500/10 text-purple-400 rounded-xl text-[10px] font-bold uppercase tracking-wider hover:brightness-110 transition-all flex items-center gap-1.5">
              <BookOpen className="w-3 h-3" /> {t("vadmin.dashboard.knowledgeHub")}
            </button>
          </div>
        </div>

        {/* Progress & Metrics Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Column 1 */}
          <div className="space-y-6">
            {/* 1. Profile Completion */}
            <WidgetCard title={t("vadmin.dashboard.profileCompletion")} icon={Layers} iconColor="bg-purple-500/10"
              loading={ws("profile_completion").loading} error={ws("profile_completion").error}
              empty={ws("profile_completion").empty} emptyMessage={t("vadmin.dashboard.startProfileWizard")}
              onRefresh={() => refreshWidget("profile_completion")}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-3xl font-black text-[var(--text-primary)]">{d.profile_completion?.percentage || 0}%</span>
                  <button onClick={() => router.push(`/ventures/${id}/wizard`)} className="text-[10px] font-bold text-[var(--brand-orange)] uppercase tracking-wider hover:underline flex items-center gap-1">
                    {t("vadmin.dashboard.open")} <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
                <div className="w-full bg-tertiary rounded-full h-2 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[var(--brand-orange)] to-orange-400 rounded-full transition-all" style={{ width: `${d.profile_completion?.percentage || 0}%` }} />
                </div>
                <div className="space-y-1.5">
                  {(d.profile_completion?.items || []).map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      {item.completed ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                      ) : (
                        <div className="w-3 h-3 rounded-full border-2 border-slate-600 shrink-0" />
                      )}
                      <span className={`text-[10px] font-bold ${item.completed ? "text-emerald-400" : "text-[var(--text-secondary)]"}`}>{item.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </WidgetCard>

            {/* 2. Investment Readiness */}
            <WidgetCard title={t("vadmin.dashboard.investmentReadiness")} icon={TrendingUp} iconColor="bg-purple-500/10"
              loading={ws("investment_readiness").loading} error={ws("investment_readiness").error}
              empty={ws("investment_readiness").empty} emptyMessage={t("vadmin.dashboard.completeProfileForScore")}
              onRefresh={() => refreshWidget("investment_readiness")}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-3xl font-black text-purple-400">{d.investment_readiness?.score || 0}%</span>
                  <span className="text-[10px] font-bold text-[var(--text-secondary)] capitalize">{d.investment_readiness?.stage?.replace(/_/g, " ") || t("vadmin.dashboard.unknown")}</span>
                </div>
                <div className="w-full bg-tertiary rounded-full h-2 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-purple-500 to-purple-400 rounded-full transition-all" style={{ width: `${d.investment_readiness?.score || 0}%` }} />
                </div>
                {(d.investment_readiness?.next_milestones || []).length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">{t("vadmin.dashboard.nextMilestones")}</p>
                    {d.investment_readiness.next_milestones.map((m, i) => (
                      <div key={i} className="flex items-center gap-2 text-[10px] text-[var(--text-secondary)]">
                        <Target className="w-3 h-3 text-[var(--brand-orange)] shrink-0" />
                        {m}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </WidgetCard>

            {/* 3. Verification Status */}
            <WidgetCard title={t("vadmin.dashboard.verification")} icon={Shield} iconColor="bg-emerald-500/10"
              loading={ws("verification").loading} error={ws("verification").error}
              empty={ws("verification").empty} emptyMessage={t("vadmin.dashboard.noVerificationData")}
              onRefresh={() => refreshWidget("verification")}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded ${
                    d.verification?.status === "verified" ? "bg-emerald-500/10 text-emerald-400" :
                    d.verification?.status === "pending_review" ? "bg-amber-500/10 text-amber-400" :
                    d.verification?.status === "rejected" ? "bg-rose-500/10 text-rose-400" :
                    "bg-slate-500/10 text-slate-400"
                  }`}>{verificationStatusLabel(d.verification?.status)}</span>
                  <span className="text-[10px] font-bold text-[var(--text-secondary)]">{t("vadmin.dashboard.verifiedCount", { verified: d.verification?.verified_count || 0, total: d.verification?.total_count || 6 })}</span>
                </div>
                <div className="space-y-1.5">
                  {(d.verification?.categories || []).map((cat, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-tertiary rounded-lg">
                      <span className="text-[10px] font-bold text-[var(--text-secondary)]">{cat.label}</span>
                      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        cat.status === "verified" ? "bg-emerald-500/10 text-emerald-400" :
                        cat.status === "rejected" ? "bg-rose-500/10 text-rose-400" :
                        cat.status === "under_review" ? "bg-amber-500/10 text-amber-400" :
                        "bg-slate-500/10 text-slate-500"
                      }`}>{verificationStatusLabel(cat.status)}</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => router.push(`/admin/ventures/${id}/verification`)} className="w-full py-2 bg-[var(--brand-orange)]/10 text-[var(--brand-orange)] rounded-xl text-[10px] font-bold uppercase tracking-wider hover:brightness-110 transition-all">
                  {t("vadmin.dashboard.openVerification")}
                </button>
              </div>
            </WidgetCard>
          </div>

          {/* Column 2 */}
          <div className="space-y-6">
            {/* 4. Team / Founders */}
            <WidgetCard title={t("vadmin.dashboard.team")} icon={Users} iconColor="bg-blue-500/10"
              loading={ws("founders").loading} error={ws("founders").error}
              empty={ws("founders").empty} emptyMessage={t("vadmin.dashboard.noTeamMembersYet")}
              onRefresh={() => refreshWidget("founders")}
            >
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2 bg-tertiary rounded-lg text-center">
                    <p className="text-lg font-black text-[var(--text-primary)]">{d.founders?.active || 0}</p>
                    <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">{t("vadmin.dashboard.active")}</p>
                  </div>
                  <div className="p-2 bg-tertiary rounded-lg text-center">
                    <p className="text-lg font-black text-amber-400">{d.founders?.pending || 0}</p>
                    <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">{t("vadmin.dashboard.pending")}</p>
                  </div>
                  <div className="p-2 bg-tertiary rounded-lg text-center">
                    <p className="text-lg font-black text-rose-400">{d.founders?.suspended || 0}</p>
                    <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">{t("vadmin.dashboard.suspended")}</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {(d.founders?.founders || []).slice(0, 4).map((f) => (
                    <div key={f.id} className="flex items-center justify-between p-2 bg-tertiary rounded-lg">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-full bg-primary border border-[var(--border-primary)] flex items-center justify-center text-[10px] font-bold shrink-0">{f.name?.charAt(0)}</div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-[var(--text-primary)] truncate">{f.name}</p>
                          <p className="text-[10px] text-[var(--text-secondary)] truncate">{f.role_label || f.role}</p>
                        </div>
                      </div>
                      {f.is_owner && <Crown className="w-3 h-3 text-amber-400 shrink-0" />}
                      {f.is_suspended && <Ban className="w-3 h-3 text-rose-400 shrink-0" />}
                    </div>
                  ))}
                </div>
                <button onClick={() => router.push(`/admin/ventures/${id}/founders`)} className="w-full py-2 bg-blue-500/10 text-blue-400 rounded-xl text-[10px] font-bold uppercase tracking-wider hover:brightness-110 transition-all">
                  {t("vadmin.dashboard.manageTeam")}
                </button>
              </div>
            </WidgetCard>

            {/* 6. Coaching / Advisors */}
            <WidgetCard title={t("vadmin.dashboard.coachingAndAdvisors")} icon={BookOpen} iconColor="bg-indigo-500/10"
              loading={ws("coaching").loading} error={ws("coaching").error}
              empty={ws("coaching").empty} emptyMessage={t("vadmin.dashboard.noCoachesOrAdvisors")}
              onRefresh={() => refreshWidget("coaching")}
            >
              <div className="space-y-3">
                {(d.coaching?.coaches || []).length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">{t("vadmin.dashboard.coaches")}</p>
                    {d.coaching.coaches.slice(0, 3).map((c, i) => (
                      <div key={c.cid || i} className="flex items-center gap-2 p-1.5">
                        <div className="w-5 h-5 rounded-full bg-primary border border-[var(--border-primary)] flex items-center justify-center text-[10px] font-bold">{c.name?.charAt(0)}</div>
                        <span className="text-[10px] font-bold text-[var(--text-primary)]">{c.name}</span>
                      </div>
                    ))}
                  </div>
                )}
                {(d.coaching?.advisors || []).length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">{t("vadmin.dashboard.advisors")}</p>
                    {d.coaching.advisors.slice(0, 3).map((a, i) => (
                      <div key={a.cid || i} className="flex items-center gap-2 p-1.5">
                        <div className="w-5 h-5 rounded-full bg-primary border border-[var(--border-primary)] flex items-center justify-center text-[10px] font-bold">{a.name?.charAt(0)}</div>
                        <span className="text-[10px] font-bold text-[var(--text-primary)]">{a.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </WidgetCard>
          </div>

          {/* Column 3 */}
          <div className="space-y-6">
            {/* 7. Upcoming Meetings */}
            <WidgetCard title={t("vadmin.dashboard.upcomingMeetings")} icon={Calendar} iconColor="bg-blue-500/10"
              loading={ws("meetings").loading} error={ws("meetings").error}
              empty={ws("meetings").empty} emptyMessage={t("vadmin.dashboard.noUpcomingMeetings")}
              onRefresh={() => refreshWidget("meetings")}
            >
              <div className="space-y-2">
                {(d.meetings || []).length === 0 ? (
                  <div className="flex flex-col items-center py-4">
                    <Calendar className="w-8 h-8 text-slate-600 mb-2" />
                    <p className="text-[10px] text-[var(--text-secondary)]">{t("vadmin.dashboard.noScheduledMeetings")}</p>
                  </div>
                ) : (
                  (d.meetings || []).slice(0, 4).map((m, i) => (
                    <div key={m.id || i} className="flex items-start gap-3 p-3 bg-tertiary rounded-xl">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        m.type === "coaching" ? "bg-indigo-500/10 text-indigo-400" :
                        m.type === "advisor" ? "bg-purple-500/10 text-purple-400" :
                        "bg-blue-500/10 text-blue-400"
                      }`}>
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-[var(--text-primary)] truncate">{m.title}</p>
                        <p className="text-[10px] text-[var(--text-secondary)]">{m.date ? new Date(m.date).toLocaleDateString(lang) : ""}{m.time ? ` ${t("vadmin.dashboard.atTime", { time: m.time })}` : ""}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </WidgetCard>

            {/* 8. Activity */}
            <WidgetCard title={t("vadmin.dashboard.recentActivity")} icon={Activity} iconColor="bg-amber-500/10"
              loading={ws("recent_activity").loading} error={ws("recent_activity").error}
              empty={ws("recent_activity").empty} emptyMessage={t("vadmin.dashboard.noRecentActivity")}
              onRefresh={() => refreshWidget("recent_activity")}
            >
              <div className="space-y-1.5">
                {(d.recent_activity || []).slice(0, 5).map((a, i) => (
                  <div key={a.id || i} className="flex items-start gap-3 p-2 rounded-lg hover:bg-tertiary transition-all">
                    <div className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${
                      a.action?.includes("APPROVED") || a.action?.includes("CREATED") ? "bg-emerald-500/10 text-emerald-400" :
                      a.action?.includes("REJECTED") || a.action?.includes("REMOVED") ? "bg-rose-500/10 text-rose-400" :
                      "bg-amber-500/10 text-amber-400"
                    }`}>
                      <Activity className="w-3 h-3" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-[var(--text-primary)] truncate">{a.action?.replace(/_/g, " ")}</p>
                      <p className="text-[10px] text-[var(--text-secondary)]">{a.actor} · {a.created_at ? new Date(a.created_at).toLocaleDateString(lang) : ""}</p>
                    </div>
                  </div>
                ))}
              </div>
            </WidgetCard>

            {/* 9. Documents */}
            <WidgetCard title={t("vadmin.dashboard.recentDocuments")} icon={FileText} iconColor="bg-[var(--brand-orange)]/10"
              loading={ws("documents").loading} error={ws("documents").error}
              empty={ws("documents").empty} emptyMessage={t("vadmin.dashboard.noDocumentsUploaded")}
              onRefresh={() => refreshWidget("documents")}
            >
              <div className="space-y-2">
                {(d.documents?.recent || []).length === 0 ? (
                  <div className="flex flex-col items-center py-4">
                    <FileText className="w-8 h-8 text-slate-600 mb-2" />
                    <p className="text-[10px] text-[var(--text-secondary)]">{t("vadmin.dashboard.uploadFirstDocument")}</p>
                  </div>
                ) : (
                  (d.documents?.recent || []).slice(0, 4).map((doc, i) => (
                    <div key={doc.id || i} className="flex items-center gap-3 p-2 bg-tertiary rounded-lg">
                      <FileText className="w-4 h-4 text-[var(--brand-orange)] shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-[var(--text-primary)] truncate">{doc.file_name}</p>
                        <p className="text-[10px] text-[var(--text-secondary)]">{doc.category?.replace(/_/g, " ")} · {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString(lang) : ""}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </WidgetCard>

            {/* 10. Notifications */}
            <WidgetCard title={`${t("vadmin.dashboard.notifications")}${d.notifications?.unread > 0 ? ` (${d.notifications.unread})` : ""}`} icon={Bell} iconColor="bg-rose-500/10"
              loading={ws("notifications").loading} error={ws("notifications").error}
              empty={ws("notifications").empty} emptyMessage={t("vadmin.dashboard.noNotifications")}
              onRefresh={() => refreshWidget("notifications")}
            >
              <div className="space-y-1.5">
                {(d.notifications?.recent || []).slice(0, 4).map((n, i) => (
                  <div key={n.id || i} className={`flex items-start gap-3 p-2 rounded-lg ${!n.is_read ? "bg-rose-500/5 border border-rose-500/10" : "hover:bg-tertiary"}`}>
                    <Bell className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${n.is_read ? "text-slate-600" : "text-rose-400"}`} />
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-[var(--text-primary)] truncate">{n.title}</p>
                      <p className="text-[10px] text-[var(--text-secondary)] truncate">{n.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </WidgetCard>
          </div>
        </div>
      </div>
    </>
  );
}

/** Manager attention block (Vinance 3 Phase 2, doc §5) — what needs attention right now. */
function AttentionWidget({ id }) {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/ventures/${id}/journey-report`);
        const d = await res.json();
        if (d.success) setData(d.journey_report);
        else setError(d.error || "failed");
      } catch (_) {
        setError("failed");
      }
    })();
  }, [id]);

  const overdue = (data?.overdue || []).length;
  const awaitingReview = (data?.tasks_by_status || {}).review || 0;
  const upcomingSessions = data?.sessions?.upcoming || 0;
  const awaitingApproval = (data?.milestones_by_status || {}).under_review || 0;
  const stageTotal = data?.journey_progression?.total || 0;
  const stagePct = data?.journey_progression?.progress_pct || 0;
  const currentJourney = (data?.stages || []).find((s) => s.status === "active")?.name || (data?.stages || [])[0]?.name || null;

  const items = [
    { n: overdue, label: t("venture.attention.overdue") },
    { n: awaitingReview, label: t("venture.attention.awaitingReview") },
    { n: upcomingSessions, label: t("venture.attention.upcomingSessions") },
    { n: awaitingApproval, label: t("venture.attention.awaitingApproval") },
  ];

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide">{t("venture.attention.title")}</h3>
        {stageTotal > 0 && (
          <span className="text-[9px] font-bold text-slate-500">{t("venture.attention.journeyProgress")}: {stagePct}%</span>
        )}
      </div>
      {error ? (
        <p className="text-xs text-rose-400">{t("venture.attention.failed")}</p>
      ) : !data ? (
        <div className="flex items-center justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-[var(--brand-orange)]" /></div>
      ) : (
        <>
          {currentJourney && (
            <p className="text-xs text-[var(--text-secondary)] mb-3">
              {t("venture.attention.currentJourney")}: <span className="font-bold text-[var(--text-primary)]">{currentJourney}</span>
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            {items.map((it) => (
              <div key={it.label} className="p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
                <p className={`text-xl font-black ${it.n > 0 ? "text-amber-400" : "text-[var(--text-primary)]"}`}>{it.n}</p>
                <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">{it.label}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

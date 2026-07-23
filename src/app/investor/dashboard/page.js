"use client";

import { useState, useEffect } from "react";
import {
  Briefcase, TrendingUp, Star, Eye, BarChart3, Users,
  Building2, Clock, ArrowRight, Loader2, Search, Filter,
  Bookmark, BookmarkCheck, Target, DollarSign,
} from "lucide-react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import AppCard from "@/components/ui/AppCard";
import AppButton from "@/components/ui/AppButton";
import GlobalToast from "@/components/ui/GlobalToast";

const PIPELINE_STAGES = [
  "interested", "watching", "meeting_requested",
  "due_diligence", "negotiation", "invested", "declined",
];

const STAGE_COLORS = {
  interested: "bg-slate-500/10 text-slate-400",
  watching: "bg-blue-500/10 text-blue-400",
  meeting_requested: "bg-amber-500/10 text-amber-400",
  due_diligence: "bg-purple-500/10 text-purple-400",
  negotiation: "bg-orange-500/10 text-orange-400",
  invested: "bg-emerald-500/10 text-emerald-400",
  declined: "bg-rose-500/10 text-rose-400",
};

const STAGE_LABELS = {
  interested: "Interested",
  watching: "Watching",
  meeting_requested: "Meeting Requested",
  due_diligence: "Due Diligence",
  negotiation: "Negotiation",
  invested: "Invested",
  declined: "Declined",
};

export default function InvestorDashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [pipeline, setPipeline] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [activeTab, setActiveTab] = useState("discover");
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");

  useEffect(() => { fetchDashboard(); }, []);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/investor/dashboard");
      const data = await res.json();
      if (data.success) {
        setProfile(data.profile);
        setPipeline(data.pipeline || []);
        setWatchlist(data.watchlist || []);
        setRecommendations(data.recommendations || []);
        setStats(data.stats || {});
      }
    } catch (_) {}
    setLoading(false);
  };

  const addToPipeline = async (ventureId, stage) => {
    try {
      const res = await fetch("/api/investor/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venture_id: ventureId, stage }),
      });
      const data = await res.json();
      if (data.success) {
        setToast({ type: "success", message: `Venture ${STAGE_LABELS[stage]}` });
        fetchDashboard();
      }
    } catch (_) {}
  };

  const toggleWatchlist = async (ventureId) => {
    const exists = watchlist.find(w => w.venture_id === ventureId);
    try {
      await fetch("/api/investor/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venture_id: ventureId, stage: exists ? "declined" : "watching" }),
      });
      fetchDashboard();
    } catch (_) {}
  };

  if (loading) {
    return (
      <DashboardLayout role="investor">
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--brand-orange)]" />
        </div>
      </DashboardLayout>
    );
  }

  if (!profile || profile.approval_status !== "approved") {
    return (
      <DashboardLayout role="investor">
        <div className="max-w-2xl mx-auto py-20 text-center space-y-6">
          <Building2 className="w-16 h-16 text-[var(--text-tertiary)] mx-auto" />
          <h2 className="text-2xl font-black text-[var(--text-primary)] uppercase">
            {!profile ? "Complete Your Investor Profile" : "Account Pending Approval"}
          </h2>
          <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto">
            {!profile
              ? "Create your investor profile to access venture discovery and investment opportunities."
              : "Your investor account is under review. You'll be notified once approved."}
          </p>
          {!profile && (
            <AppButton variant="primary" onClick={() => router.push("/investor/onboarding")}>
              Set Up Profile
            </AppButton>
          )}
        </div>
      </DashboardLayout>
    );
  }

  const filteredPipeline = stageFilter === "all"
    ? pipeline
    : pipeline.filter(p => p.stage === stageFilter);

  const filteredRecommendations = recommendations.filter(r =>
    !search || r.name?.toLowerCase().includes(search.toLowerCase()) ||
    r.industry?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout role="investor">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
        <GlobalToast toast={toast} onClose={() => setToast(null)} />

        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-[var(--text-primary)] uppercase tracking-tighter">
              Investor Dashboard
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              {profile.organization_name || "Individual Investor"}
            </p>
          </div>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Pipeline", value: stats.total_pipeline || 0, icon: BarChart3, color: "text-[var(--brand-orange)]" },
            { label: "Invested", value: stats.invested_count || 0, icon: Target, color: "text-emerald-400" },
            { label: "Evaluating", value: stats.active_evaluations || 0, icon: Eye, color: "text-purple-400" },
            { label: "Watchlist", value: stats.watchlist_count || 0, icon: Bookmark, color: "text-blue-400" },
          ].map((s, i) => (
            <AppCard key={i} padding="md">
              <div className="flex items-center gap-3">
                <s.icon className={`w-5 h-5 ${s.color}`} />
                <div>
                  <p className="text-2xl font-black text-[var(--text-primary)]">{s.value}</p>
                  <p className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">{s.label}</p>
                </div>
              </div>
            </AppCard>
          ))}
        </div>

        {/* TABS */}
        <div className="flex gap-1 border-b border-[var(--border-primary)]">
          {[
            { id: "discover", label: "Discover", icon: Search },
            { id: "pipeline", label: "Pipeline", icon: BarChart3 },
            { id: "watchlist", label: "Watchlist", icon: Bookmark },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-[10px] font-black uppercase tracking-wider transition-colors relative ${
                activeTab === tab.id
                  ? "text-[var(--brand-orange)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--brand-orange)]" />
              )}
            </button>
          ))}
        </div>

        {/* DISCOVER TAB */}
        {activeTab === "discover" && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search ventures by name or industry..."
                className="w-full pl-11 pr-4 py-3 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--brand-orange)]/60"
              />
            </div>

            {filteredRecommendations.length === 0 ? (
              <div className="text-center py-16">
                <Building2 className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-4" />
                <p className="text-sm font-bold text-[var(--text-secondary)]">No ventures found</p>
                <p className="text-xs text-[var(--text-tertiary)] mt-1">Update your investment preferences for better recommendations.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredRecommendations.map(v => {
                  const isWatching = watchlist.some(w => w.venture_id === v.id);
                  return (
                    <AppCard key={v.id} padding="md" hover>
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="text-sm font-black text-[var(--text-primary)]">{v.name}</h4>
                            <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">{v.industry || "—"}</p>
                          </div>
                          <button
                            onClick={() => toggleWatchlist(v.id)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              isWatching ? "text-[var(--brand-orange)]" : "text-[var(--text-tertiary)] hover:text-[var(--brand-orange)]"
                            }`}
                          >
                            {isWatching ? <BookmarkCheck className="w-4 h-4 fill-current" /> : <Bookmark className="w-4 h-4" />}
                          </button>
                        </div>
                        {v.description && (
                          <p className="text-xs text-[var(--text-secondary)] line-clamp-2">{v.description}</p>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-[var(--text-tertiary)]">{v.country || ""}</span>
                          <button
                            onClick={() => addToPipeline(v.id, "interested")}
                            className="flex items-center gap-1 text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-wider hover:underline"
                          >
                            Express Interest <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </AppCard>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* PIPELINE TAB */}
        {activeTab === "pipeline" && (
          <div className="space-y-4">
            <div className="flex gap-2 overflow-x-auto pb-2">
              <button
                onClick={() => setStageFilter("all")}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider whitespace-nowrap transition-colors ${
                  stageFilter === "all" ? "bg-[var(--brand-orange)] text-white" : "bg-[var(--surface-3)] text-[var(--text-secondary)]"
                }`}
              >
                All ({pipeline.length})
              </button>
              {PIPELINE_STAGES.map(stage => {
                const count = pipeline.filter(p => p.stage === stage).length;
                if (count === 0 && stageFilter !== stage) return null;
                return (
                  <button
                    key={stage}
                    onClick={() => setStageFilter(stage)}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider whitespace-nowrap transition-colors ${
                      stageFilter === stage ? "bg-[var(--brand-orange)] text-white" : STAGE_COLORS[stage]
                    }`}
                  >
                    {STAGE_LABELS[stage]} ({count})
                  </button>
                );
              })}
            </div>

            {filteredPipeline.length === 0 ? (
              <div className="text-center py-16">
                <BarChart3 className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-4" />
                <p className="text-sm font-bold text-[var(--text-secondary)]">Pipeline empty</p>
                <p className="text-xs text-[var(--text-tertiary)] mt-1">Discover ventures and add them to your pipeline.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredPipeline.map(p => (
                  <AppCard key={p.id} padding="md">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Building2 className="w-8 h-8 text-[var(--brand-orange)]/60" />
                        <div>
                          <p className="text-sm font-bold text-[var(--text-primary)]">{p.venture_name || p.venture_id}</p>
                          <p className="text-[10px] text-[var(--text-tertiary)]">
                            {new Date(p.stage_changed_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${STAGE_COLORS[p.stage]}`}>
                          {STAGE_LABELS[p.stage]}
                        </span>
                        <select
                          value={p.stage}
                          onChange={e => addToPipeline(p.venture_id, e.target.value)}
                          className="bg-[var(--surface-3)] border border-[var(--border-primary)] rounded-lg px-2 py-1 text-[10px] font-bold text-[var(--text-primary)] outline-none"
                        >
                          {PIPELINE_STAGES.map(s => (
                            <option key={s} value={s}>{STAGE_LABELS[s]}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </AppCard>
                ))}
              </div>
            )}
          </div>
        )}

        {/* WATCHLIST TAB */}
        {activeTab === "watchlist" && (
          <div className="space-y-4">
            {watchlist.length === 0 ? (
              <div className="text-center py-16">
                <Bookmark className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-4" />
                <p className="text-sm font-bold text-[var(--text-secondary)]">No saved ventures</p>
                <p className="text-xs text-[var(--text-tertiary)] mt-1">Bookmark ventures from the Discover tab.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {watchlist.map(w => (
                  <AppCard key={w.id} padding="md">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-[var(--text-primary)]">{w.venture_name || w.venture_id}</p>
                        {w.personal_notes && (
                          <p className="text-xs text-[var(--text-secondary)] mt-1">{w.personal_notes}</p>
                        )}
                      </div>
                      <AppButton variant="secondary" size="sm" onClick={() => addToPipeline(w.venture_id, "interested")}>
                        Add to Pipeline
                      </AppButton>
                    </div>
                  </AppCard>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

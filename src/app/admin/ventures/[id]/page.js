"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Rocket,
  ArrowLeft,
  Building2,
  User,
  Mail,
  Phone,
  Globe,
  Calendar,
  Clock,
  TrendingUp,
  Users,
  FileText,
  Loader2,
  ChevronRight,
  ExternalLink,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Edit3,
  Send,
  Shield,
  Layers,
  Target,
  Briefcase,
  Crown,
  Ban,
  BarChart3,
  RefreshCw,
  Trash2,
  Flag,
  Columns,
  BookOpen,
  Star,
  X,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";

const STAGE_CONFIG = {
  idea: { label: "Idea", color: "text-blue-400 bg-blue-500/10", order: 1 },
  validation: { label: "Validation", color: "text-purple-400 bg-purple-500/10", order: 2 },
  early_traction: { label: "Early Traction", color: "text-amber-400 bg-amber-500/10", order: 3 },
  growth: { label: "Growth", color: "text-emerald-400 bg-emerald-500/10", order: 4 },
  scaling: { label: "Scaling", color: "text-[var(--brand-orange)] bg-[var(--brand-orange)]/10", order: 5 },
};

const WIZARD_STEPS = [
  { step: 1, name: "Startup Identity", icon: Building2 },
  { step: 2, name: "Business Information", icon: Briefcase },
  { step: 3, name: "Founder Information", icon: User },
  { step: 4, name: "Team Information", icon: Users },
  { step: 5, name: "Supporting Documents", icon: FileText },
  { step: 6, name: "Review & Submit", icon: CheckCircle2 },
];

const ACTIVITY_ICONS = {
  VENTURE_CREATED: Rocket,
  FOUNDER_INVITED: Send,
  VENTURE_UPDATED: Edit3,
  PROFILE_WIZARD_INIT: Layers,
  VENTURE_REGISTERED: CheckCircle2,
  PROGRAM_PROMOTED: Rocket,
  PROMOTED: Rocket,
  PROFILE_SUBMITTED: CheckCircle2,
  FOUNDER_ACCEPTED: User,
  FOUNDER_REMOVED: Trash2,
  ROLE_UPDATED: Edit3,
  OWNERSHIP_TRANSFERRED: Crown,
  USER_SUSPENDED: Ban,
  USER_REACTIVATED: RefreshCw,
  VERIFICATION_SUBMITTED: Send,
  VERIFICATION_APPROVED: CheckCircle2,
  VERIFICATION_REJECTED: X,
  VERIFICATION_RESUBMITTED: RefreshCw,
  VERIFICATION_SUSPENDED: Ban,
  MILESTONE_CREATED: Flag,
  MILESTONE_UPDATED: Edit3,
  MILESTONE_COMPLETED: CheckCircle2,
  DELIVERABLE_SUBMITTED: Send,
  DELIVERABLE_APPROVED: CheckCircle2,
  DELIVERABLE_REJECTED: X,
};

const ACTIVITY_COLORS = {
  VENTURE_CREATED: "text-emerald-500 bg-emerald-500/10",
  FOUNDER_INVITED: "text-blue-500 bg-blue-500/10",
  VENTURE_UPDATED: "text-amber-500 bg-amber-500/10",
  PROFILE_WIZARD_INIT: "text-purple-500 bg-purple-500/10",
  VENTURE_REGISTERED: "text-emerald-500 bg-emerald-500/10",
  PROGRAM_PROMOTED: "text-indigo-500 bg-indigo-500/10",
  PROMOTED: "text-indigo-500 bg-indigo-500/10",
  PROFILE_SUBMITTED: "text-emerald-500 bg-emerald-500/10",
  FOUNDER_ACCEPTED: "text-emerald-500 bg-emerald-500/10",
  FOUNDER_REMOVED: "text-rose-500 bg-rose-500/10",
  ROLE_UPDATED: "text-amber-500 bg-amber-500/10",
  OWNERSHIP_TRANSFERRED: "text-amber-500 bg-amber-500/10",
  USER_SUSPENDED: "text-rose-500 bg-rose-500/10",
  USER_REACTIVATED: "text-emerald-500 bg-emerald-500/10",
  VERIFICATION_SUBMITTED: "text-blue-500 bg-blue-500/10",
  VERIFICATION_APPROVED: "text-emerald-500 bg-emerald-500/10",
  VERIFICATION_REJECTED: "text-rose-500 bg-rose-500/10",
  VERIFICATION_RESUBMITTED: "text-amber-500 bg-amber-500/10",
  VERIFICATION_SUSPENDED: "text-red-500 bg-red-500/10",
  MILESTONE_CREATED: "text-blue-500 bg-blue-500/10",
  MILESTONE_UPDATED: "text-amber-500 bg-amber-500/10",
  MILESTONE_COMPLETED: "text-emerald-500 bg-emerald-500/10",
  DELIVERABLE_SUBMITTED: "text-amber-500 bg-amber-500/10",
  DELIVERABLE_APPROVED: "text-emerald-500 bg-emerald-500/10",
  DELIVERABLE_REJECTED: "text-rose-500 bg-rose-500/10",
};

export default function VentureDetailPage({ params }) {
  const router = useRouter();
  const { id } = React.use(params);
  const [venture, setVenture] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    if (id) fetchVenture();
  }, [id]);

  const fetchVenture = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/ventures/${id}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Venture not found");
        return;
      }
      setVenture(data.venture);
    } catch (e) {
      setError("Failed to load venture data");
    } finally {
      setLoading(false);
    }
  };

  const getStageConfig = (stage) => STAGE_CONFIG[stage] || STAGE_CONFIG.idea;
  const getActivityIcon = (action) => ACTIVITY_ICONS[action] || Activity;
  const getActivityColor = (action) => ACTIVITY_COLORS[action] || "text-slate-500 bg-slate-500/10";

  if (loading) {
    return (
      <DashboardLayout role="super_admin">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--brand-orange)]" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !venture) {
    return (
      <DashboardLayout role="super_admin">
        <div className="text-center py-20">
          <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">
            Venture Not Found
          </h2>
          <p className="text-slate-500 mb-6">{error || "The venture could not be loaded."}</p>
          <button
            onClick={() => router.push("/admin/ventures")}
            className="btn btn-primary"
          >
            Back to Ventures
          </button>
        </div>
      </DashboardLayout>
    );
  }

  const stage = getStageConfig(venture.business_stage);

  const TABS = [
    { id: "dashboard", label: "Dashboard", icon: Rocket },
    { id: "investment", label: "Investment", icon: TrendingUp },
    { id: "timeline", label: "Timeline", icon: BarChart3 },
    { id: "reports", label: "Reports", icon: TrendingUp },
    { id: "feedback", label: "Feedback", icon: Star },
    { id: "sessions", label: "Sessions", icon: Calendar },
    { id: "coaches", label: "Coaches", icon: BookOpen },
    { id: "knowledge", label: "Knowledge", icon: BookOpen },
    { id: "milestones", label: "Milestones", icon: Flag },
    { id: "tasks", label: "Tasks", icon: CheckCircle2 },
    { id: "overview", label: "Overview", icon: Building2 },
    { id: "founders", label: "Founders", icon: User },
    { id: "verification", label: "Verification", icon: Shield },
    { id: "activity", label: "Activity", icon: Activity },
    { id: "wizard", label: "Profile Wizard", icon: Layers },
    { id: "management", label: "Team Management", icon: Shield },
  ];

  return (
    <DashboardLayout role="super_admin">
      <div className="space-y-8 pb-20">
        {/* Back button */}
        <button
          onClick={() => router.push("/admin/ventures")}
          className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-[var(--text-primary)] transition-all"
        >
          <ArrowLeft className="w-3 h-3" /> Back to Ventures
        </button>

        {/* Venture Header */}
        <div className="card">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-[var(--brand-orange)]/10 flex items-center justify-center">
                <Rocket className="w-8 h-8 text-[var(--brand-orange)]" />
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-2xl font-black text-[var(--text-primary)]">
                    {venture.company_name}
                  </h1>
                  <span className={`text-[8px] font-black uppercase px-2 py-1 rounded ${stage.color}`}>
                    {stage.label}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-[10px] text-slate-500">
                  <span className="font-mono">{venture.venture_id}</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Registered {new Date(venture.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => router.push(`/admin/ventures/${id}/edit`)}
                className="px-4 py-2 rounded-xl border border-[var(--border-primary)] text-[9px] font-black uppercase tracking-widest hover:bg-tertiary transition-all flex items-center gap-2"
              >
                <Edit3 className="w-3 h-3" /> Edit
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-8 border-b border-[var(--border-primary)] overflow-x-auto scrollbar-thin">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-5 py-3 text-[9px] font-black uppercase tracking-widest flex items-center gap-2 transition-all border-b-2 whitespace-nowrap ${
                    isActive
                      ? "border-[var(--brand-orange)] text-[var(--brand-orange)]"
                      : "border-transparent text-slate-500 hover:text-[var(--text-primary)]"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === "dashboard" && (
          <div className="card">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-[var(--brand-orange)]/10 flex items-center justify-center">
                  <Rocket className="w-6 h-6 text-[var(--brand-orange)]" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-[var(--text-primary)]">Startup Dashboard</h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Complete operational overview with widgets, progress, and quick actions
                  </p>
                </div>
              </div>
              <button
                onClick={() => router.push(`/admin/ventures/${id}/dashboard`)}
                className="px-5 py-2.5 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all flex items-center gap-2"
              >
                <Rocket className="w-3.5 h-3.5" /> Open Full Dashboard
              </button>
            </div>
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-tertiary rounded-xl border border-[var(--border-primary)]">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Founders</p>
                <p className="text-2xl font-black text-[var(--text-primary)] mt-1">{(venture.founders || []).length}</p>
              </div>
              <div className="p-4 bg-tertiary rounded-xl border border-[var(--border-primary)]">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Members</p>
                <p className="text-2xl font-black text-[var(--text-primary)] mt-1">{(venture.members || []).length}</p>
              </div>
              <div className="p-4 bg-tertiary rounded-xl border border-[var(--border-primary)]">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Wizard</p>
                <p className="text-2xl font-black text-[var(--text-primary)] mt-1">
                  {(venture.history || []).filter(h => h.event_type === "PROFILE_WIZARD_INIT" && h.metadata?.completed).length}/6
                </p>
              </div>
              <div className="p-4 bg-tertiary rounded-xl border border-[var(--border-primary)]">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Activity</p>
                <p className="text-2xl font-black text-[var(--text-primary)] mt-1">{(venture.activity || []).length}</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "investment" && (
          <div className="card">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-[var(--text-primary)]">Investment Readiness</h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Score, recommendations, and category breakdown
                  </p>
                </div>
              </div>
              <button
                onClick={() => router.push(`/admin/ventures/${id}/investment`)}
                className="px-5 py-2.5 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all flex items-center gap-2"
              >
                <TrendingUp className="w-3.5 h-3.5" /> Open Assessment
              </button>
            </div>
          </div>
        )}

        {activeTab === "timeline" && (
          <div className="card">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-[var(--text-primary)]">Project Timeline & Progress</h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Gantt chart, progress tracking, and delay detection
                  </p>
                </div>
              </div>
              <button
                onClick={() => router.push(`/admin/ventures/${id}/timeline`)}
                className="px-5 py-2.5 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all flex items-center gap-2"
              >
                <BarChart3 className="w-3.5 h-3.5" /> Open Timeline
              </button>
            </div>
          </div>
        )}

        {activeTab === "reports" && (
          <div className="card">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-[var(--text-primary)]">Reports & Analytics</h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    KPIs, project health, team productivity, and export
                  </p>
                </div>
              </div>
              <button
                onClick={() => router.push(`/admin/ventures/${id}/reports`)}
                className="px-5 py-2.5 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all flex items-center gap-2"
              >
                <TrendingUp className="w-3.5 h-3.5" /> Open Reports
              </button>
            </div>
          </div>
        )}

        {activeTab === "sessions" && (
          <div className="card">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-[var(--text-primary)]">Mentoring Sessions</h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Schedule and manage coaching, mentoring, and advisory sessions
                  </p>
                </div>
              </div>
              <button
                onClick={() => router.push(`/admin/ventures/${id}/sessions`)}
                className="px-5 py-2.5 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all flex items-center gap-2"
              >
                <Calendar className="w-3.5 h-3.5" /> Open Sessions
              </button>
            </div>
          </div>
        )}

        {activeTab === "feedback" && (
          <div className="card">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                  <Star className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-[var(--text-primary)]">Mentor Feedback & Analytics</h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Session ratings, coach performance, and mentoring KPIs
                  </p>
                </div>
              </div>
              <button
                onClick={() => router.push(`/admin/ventures/${id}/feedback`)}
                className="px-5 py-2.5 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all flex items-center gap-2"
              >
                <Star className="w-3.5 h-3.5" /> Open Analytics
              </button>
            </div>
          </div>
        )}

        {activeTab === "knowledge" && (
          <div className="card">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-[var(--text-primary)]">Knowledge Hub</h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Learning resources, guides, templates, and best practices
                  </p>
                </div>
              </div>
              <button
                onClick={() => router.push(`/admin/ventures/${id}/knowledge`)}
                className="px-5 py-2.5 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all flex items-center gap-2"
              >
                <BookOpen className="w-3.5 h-3.5" /> Open Knowledge Hub
              </button>
            </div>
          </div>
        )}

        {activeTab === "coaches" && (
          <div className="card">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-[var(--brand-orange)]/10 flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-[var(--brand-orange)]" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-[var(--text-primary)]">Coaches & Advisors</h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Assign and manage coaches and advisors for this venture
                  </p>
                </div>
              </div>
              <button
                onClick={() => router.push(`/admin/ventures/${id}/coaches`)}
                className="px-5 py-2.5 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all flex items-center gap-2"
              >
                <BookOpen className="w-3.5 h-3.5" /> Open Coaches
              </button>
            </div>
          </div>
        )}

        {activeTab === "milestones" && (
          <div className="card">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-[var(--brand-orange)]/10 flex items-center justify-center">
                  <Flag className="w-6 h-6 text-[var(--brand-orange)]" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-[var(--text-primary)]">Milestones & Deliverables</h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Track execution progress with milestones and deliverables
                  </p>
                </div>
              </div>
              <button
                onClick={() => router.push(`/admin/ventures/${id}/milestones`)}
                className="px-5 py-2.5 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all flex items-center gap-2"
              >
                <Flag className="w-3.5 h-3.5" /> Open Milestones
              </button>
            </div>
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-tertiary rounded-xl border border-[var(--border-primary)]">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Milestones</p>
                <p className="text-2xl font-black text-[var(--text-primary)] mt-1">0</p>
              </div>
              <div className="p-4 bg-tertiary rounded-xl border border-[var(--border-primary)]">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">In Progress</p>
                <p className="text-2xl font-black text-blue-400 mt-1">0</p>
              </div>
              <div className="p-4 bg-tertiary rounded-xl border border-[var(--border-primary)]">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Completed</p>
                <p className="text-2xl font-black text-emerald-400 mt-1">0</p>
              </div>
              <div className="p-4 bg-tertiary rounded-xl border border-[var(--border-primary)]">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Delayed</p>
                <p className="text-2xl font-black text-rose-400 mt-1">0</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "tasks" && (
          <div className="card">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-[var(--brand-orange)]/10 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-[var(--brand-orange)]" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-[var(--text-primary)]">Task Management & Kanban</h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Kanban board, list view, and task tracking
                  </p>
                </div>
              </div>
              <button
                onClick={() => router.push(`/admin/ventures/${id}/tasks`)}
                className="px-5 py-2.5 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all flex items-center gap-2"
              >
                <Columns className="w-3.5 h-3.5" /> Open Kanban
              </button>
            </div>
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-tertiary rounded-xl border border-[var(--border-primary)]">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Backlog</p>
                <p className="text-2xl font-black text-slate-400 mt-1">0</p>
              </div>
              <div className="p-4 bg-tertiary rounded-xl border border-[var(--border-primary)]">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">In Progress</p>
                <p className="text-2xl font-black text-amber-400 mt-1">0</p>
              </div>
              <div className="p-4 bg-tertiary rounded-xl border border-[var(--border-primary)]">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Review</p>
                <p className="text-2xl font-black text-purple-400 mt-1">0</p>
              </div>
              <div className="p-4 bg-tertiary rounded-xl border border-[var(--border-primary)]">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Done</p>
                <p className="text-2xl font-black text-emerald-400 mt-1">0</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Info */}
            <div className="lg:col-span-2 space-y-6">
              {/* Company Details */}
              <div className="card">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-[var(--brand-orange)]" />
                  Company Details
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-tertiary rounded-xl">
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Industry</p>
                    <p className="text-sm font-bold text-[var(--text-primary)]">{venture.industry}</p>
                  </div>
                  <div className="p-3 bg-tertiary rounded-xl">
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Business Stage</p>
                    <p className={`text-sm font-bold ${stage.color}`}>{stage.label}</p>
                  </div>
                  {venture.registration_number && (
                    <div className="p-3 bg-tertiary rounded-xl">
                      <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Registration #</p>
                      <p className="text-sm font-bold text-[var(--text-primary)]">{venture.registration_number}</p>
                    </div>
                  )}
                  {venture.website && (
                    <div className="p-3 bg-tertiary rounded-xl">
                      <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Website</p>
                      <a
                        href={venture.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-bold text-[var(--brand-orange)] hover:underline flex items-center gap-1"
                      >
                        {new URL(venture.website).hostname}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                  {venture.description && (
                    <div className="col-span-2 p-3 bg-tertiary rounded-xl">
                      <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Description</p>
                      <p className="text-sm text-[var(--text-secondary)]">{venture.description}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Wizard Progress */}
              <div className="card">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-purple-500" />
                  Startup Profile Wizard
                </h3>
                <div className="space-y-3">
                  {WIZARD_STEPS.map((ws) => {
                    const completed = (venture.history || []).some(
                      (h) => h.event_type === "PROFILE_WIZARD_INIT" && h.metadata?.step === ws.step && h.metadata?.completed
                    );
                    const Icon = ws.icon;
                    return (
                      <div
                        key={ws.step}
                        className={`flex items-center gap-4 p-3 rounded-xl ${
                          completed ? "bg-emerald-500/[0.03] border border-emerald-500/10" : "bg-tertiary border border-[var(--border-primary)]"
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          completed ? "bg-emerald-500/20 text-emerald-500" : "bg-slate-500/10 text-slate-500"
                        }`}>
                          {completed ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <Icon className="w-4 h-4" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className={`text-[11px] font-bold ${
                            completed ? "text-emerald-500" : "text-slate-500"
                          }`}>
                            Step {ws.step}: {ws.name}
                          </p>
                        </div>
                        {completed && (
                          <span className="text-[8px] font-black text-emerald-500 uppercase">Completed</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Quick Stats */}
              <div className="card">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Quick Stats</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-tertiary rounded-xl">
                    <div className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-blue-500" />
                      <span className="text-[10px] font-bold text-slate-500">Founders</span>
                    </div>
                    <span className="text-sm font-black">{(venture.founders || []).length}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-tertiary rounded-xl">
                    <div className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-[10px] font-bold text-slate-500">Members</span>
                    </div>
                    <span className="text-sm font-black">{(venture.members || []).length}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-tertiary rounded-xl">
                    <div className="flex items-center gap-2">
                      <Activity className="w-3.5 h-3.5 text-amber-500" />
                      <span className="text-[10px] font-bold text-slate-500">Activity Events</span>
                    </div>
                    <span className="text-sm font-black">{(venture.activity || []).length}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-tertiary rounded-xl">
                    <div className="flex items-center gap-2">
                      <Layers className="w-3.5 h-3.5 text-purple-500" />
                      <span className="text-[10px] font-bold text-slate-500">Wizard Progress</span>
                    </div>
                    <span className="text-sm font-black">
                      {(venture.history || []).filter(h => h.event_type === "PROFILE_WIZARD_INIT" && h.metadata?.completed).length}/{WIZARD_STEPS.length}
                    </span>
                  </div>
                </div>
              </div>

              {/* Recent Activity (sidebar) */}
              <div className="card">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Recent Activity</h3>
                <div className="space-y-2">
                  {(venture.activity || []).slice(0, 5).map((act, i) => {
                    const Icon = getActivityIcon(act.action);
                    const color = getActivityColor(act.action);
                    return (
                      <div key={act.id || i} className="flex items-start gap-3 p-2 rounded-lg hover:bg-tertiary transition-all">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[9px] font-bold text-[var(--text-primary)] truncate">{act.action}</p>
                          <p className="text-[8px] text-slate-500">
                            {act.actor_name} · {new Date(act.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  {(venture.activity || []).length === 0 && (
                    <p className="text-[10px] text-slate-500 italic py-3 text-center">No activity yet</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "founders" && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-[var(--brand-orange)]" />
                Founders
              </h3>
              <button
                onClick={() => router.push(`/admin/ventures/${id}/founders`)}
                className="px-3 py-1.5 bg-[var(--brand-orange)] text-black rounded-xl text-[8px] font-black uppercase tracking-widest hover:brightness-110 transition-all flex items-center gap-1.5"
              >
                <Shield className="w-3 h-3" /> Manage
              </button>
            </div>
            {(venture.founders || []).length === 0 ? (
              <p className="text-[10px] text-slate-500 italic py-6 text-center">No founders registered</p>
            ) : (
              <div className="space-y-3">
                {(venture.founders || []).map((founder, i) => (
                  <div key={founder.id || i} className="flex items-center justify-between p-4 bg-tertiary rounded-xl border border-[var(--border-primary)]">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary border border-[var(--border-primary)] flex items-center justify-center text-sm font-black">
                        {founder.name?.charAt(0) || "?"}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[var(--text-primary)]">{founder.name}</p>
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500">
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" /> {founder.email}
                          </span>
                          {founder.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3" /> {founder.phone}
                            </span>
                          )}
                          {founder.title && (
                            <span>{founder.title}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-[8px] font-black uppercase px-2 py-1 rounded ${
                        founder.status === "accepted"
                          ? "bg-emerald-500/10 text-emerald-500"
                          : founder.status === "pending"
                            ? "bg-amber-500/10 text-amber-500"
                            : "bg-slate-500/10 text-slate-500"
                      }`}>
                        {founder.status}
                      </span>
                      {founder.invitation_sent_at && (
                        <span className="text-[8px] text-slate-500">
                          Invited {new Date(founder.invitation_sent_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "activity" && (
          <div className="card">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-[var(--brand-orange)]" />
              Activity Log
            </h3>
            {(venture.activity || []).length === 0 ? (
              <p className="text-[10px] text-slate-500 italic py-6 text-center">No activity recorded</p>
            ) : (
              <div className="space-y-1">
                {(venture.activity || []).map((act, i) => {
                  const Icon = getActivityIcon(act.action);
                  const color = getActivityColor(act.action);
                  return (
                    <div key={act.id || i} className="flex items-start gap-4 p-3 rounded-lg hover:bg-tertiary transition-all">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-[11px] font-bold text-[var(--text-primary)]">{act.action}</p>
                          <span className="text-[8px] text-slate-500">
                            by {act.actor_name || "System"}
                          </span>
                        </div>
                        <p className="text-[9px] text-slate-500 mt-0.5">
                          {new Date(act.created_at).toLocaleString()}
                        </p>
                        {act.details && (
                          <p className="text-[9px] text-slate-600 mt-1 font-mono">
                            {JSON.stringify(act.details).substring(0, 200)}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === "wizard" && (
          <div className="space-y-6">
            {/* Link to Full Wizard */}
            <div className="card">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center">
                    <Layers className="w-6 h-6 text-purple-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-[var(--text-primary)]">Startup Profile Wizard</h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Complete or continue your startup onboarding profile
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => router.push(`/ventures/${id}/wizard`)}
                  className="px-5 py-2.5 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all flex items-center gap-2"
                >
                  <Layers className="w-3.5 h-3.5" /> Open Wizard
                </button>
              </div>
            </div>

            {/* Progress Overview */}
            <div className="card">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-purple-500" />
                Progress Overview
              </h3>
              <div className="space-y-3">
                {WIZARD_STEPS.map((ws) => {
                  const completed = (venture.history || []).some(
                    (h) => h.event_type === "PROFILE_WIZARD_INIT" && h.metadata?.step === ws.step && h.metadata?.completed
                  );
                  const Icon = ws.icon;
                  return (
                    <div
                      key={ws.step}
                      className={`flex items-center gap-4 p-3 rounded-xl ${
                        completed ? "bg-emerald-500/[0.03] border border-emerald-500/10" : "bg-tertiary border border-[var(--border-primary)]"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        completed ? "bg-emerald-500/20 text-emerald-500" : "bg-slate-500/10 text-slate-500"
                      }`}>
                        {completed ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          <Icon className="w-4 h-4" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className={`text-[11px] font-bold ${
                          completed ? "text-emerald-500" : "text-slate-500"
                        }`}>
                          Step {ws.step}: {ws.name}
                        </p>
                      </div>
                      {completed && (
                        <span className="text-[8px] font-black text-emerald-500 uppercase">Completed</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Wizard History */}
            <div className="card">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-purple-500" />
                Startup Profile Wizard History
              </h3>
              {(venture.history || []).length === 0 ? (
                <p className="text-[10px] text-slate-500 italic py-6 text-center">No wizard history yet</p>
              ) : (
                <div className="space-y-2">
                  {(venture.history || []).map((entry, i) => (
                    <div key={entry.id || i} className="flex items-start gap-4 p-3 rounded-lg bg-tertiary border border-[var(--border-primary)]">
                      <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 text-purple-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-[var(--text-primary)]">{entry.event_type}</p>
                        <p className="text-[9px] text-slate-500 mt-0.5">{entry.description}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[8px] text-slate-600">
                            {new Date(entry.created_at).toLocaleString()}
                          </span>
                          {entry.metadata?.step && (
                            <span className="text-[8px] font-bold text-purple-500">
                              Step {entry.metadata.step}/{entry.metadata.total_steps}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "verification" && (
          <div className="card">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-[var(--text-primary)]">Startup Verification</h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Verify company legitimacy, founder identity, and documentation
                  </p>
                </div>
              </div>
              <button
                onClick={() => router.push(`/admin/ventures/${id}/verification`)}
                className="px-5 py-2.5 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all flex items-center gap-2"
              >
                <Shield className="w-3.5 h-3.5" /> Open Verification
              </button>
            </div>
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-tertiary rounded-xl border border-[var(--border-primary)]">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Status</p>
                <p className="text-sm font-black text-[var(--text-primary)] mt-1 capitalize">{(venture.profile_progress?.is_completed ? "Verified" : "Pending")}</p>
              </div>
              <div className="p-4 bg-tertiary rounded-xl border border-[var(--border-primary)]">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Categories</p>
                <p className="text-sm font-black text-[var(--text-primary)] mt-1">6 required</p>
              </div>
              <div className="p-4 bg-tertiary rounded-xl border border-[var(--border-primary)]">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Documents</p>
                <p className="text-sm font-black text-[var(--text-primary)] mt-1">0 uploaded</p>
              </div>
              <div className="p-4 bg-tertiary rounded-xl border border-[var(--border-primary)]">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Last Review</p>
                <p className="text-sm font-black text-slate-500 mt-1">—</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "management" && (
          <div className="card">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-[var(--brand-orange)]/10 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-[var(--brand-orange)]" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-[var(--text-primary)]">Team Management</h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Manage founders, co-founders, roles, and ownership
                  </p>
                </div>
              </div>
              <button
                onClick={() => router.push(`/admin/ventures/${id}/founders`)}
                className="px-5 py-2.5 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all flex items-center gap-2"
              >
                <Shield className="w-3.5 h-3.5" /> Open Founder Management
              </button>
            </div>
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-tertiary rounded-xl border border-[var(--border-primary)]">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Total Members</p>
                <p className="text-2xl font-black text-[var(--text-primary)] mt-1">{(venture.founders || []).length}</p>
              </div>
              <div className="p-4 bg-tertiary rounded-xl border border-[var(--border-primary)]">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Roles</p>
                <p className="text-2xl font-black text-[var(--text-primary)] mt-1">
                  {new Set((venture.founders || []).map((f) => f.role || f.title)).size}
                </p>
              </div>
              <div className="p-4 bg-tertiary rounded-xl border border-[var(--border-primary)]">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Pending</p>
                <p className="text-2xl font-black text-amber-400 mt-1">
                  {(venture.founders || []).filter((f) => f.status === "pending").length}
                </p>
              </div>
              <div className="p-4 bg-tertiary rounded-xl border border-[var(--border-primary)]">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Active</p>
                <p className="text-2xl font-black text-emerald-400 mt-1">
                  {(venture.founders || []).filter((f) => f.status === "accepted").length}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

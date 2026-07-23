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
  { step: 1, name: "Company Information", icon: Building2 },
  { step: 2, name: "Founder Details", icon: User },
  { step: 3, name: "Product / Service", icon: Rocket },
  { step: 4, name: "Market & Traction", icon: TrendingUp },
  { step: 5, name: "Investment Readiness", icon: Target },
];

const ACTIVITY_ICONS = {
  VENTURE_CREATED: Rocket,
  FOUNDER_INVITED: Send,
  VENTURE_UPDATED: Edit3,
  PROFILE_WIZARD_INIT: Layers,
  VENTURE_REGISTERED: CheckCircle2,
};

const ACTIVITY_COLORS = {
  VENTURE_CREATED: "text-emerald-500 bg-emerald-500/10",
  FOUNDER_INVITED: "text-blue-500 bg-blue-500/10",
  VENTURE_UPDATED: "text-amber-500 bg-amber-500/10",
  PROFILE_WIZARD_INIT: "text-purple-500 bg-purple-500/10",
  VENTURE_REGISTERED: "text-emerald-500 bg-emerald-500/10",
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
    { id: "overview", label: "Overview", icon: Building2 },
    { id: "founders", label: "Founders", icon: User },
    { id: "activity", label: "Activity", icon: Activity },
    { id: "wizard", label: "Profile Wizard", icon: Layers },
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
          <div className="flex gap-1 mt-8 border-b border-[var(--border-primary)]">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-5 py-3 text-[9px] font-black uppercase tracking-widest flex items-center gap-2 transition-all border-b-2 ${
                    isActive
                      ? "border-[var(--brand-orange)] text-[var(--brand-orange)]"
                      : "border-transparent text-slate-500 hover:text-[var(--text-primary)]"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
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
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-[var(--brand-orange)]" />
              Founders
            </h3>
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
          <div className="card">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-purple-500" />
              Startup Profile Wizard History
            </h3>
            {(venture.history || []).length === 0 ? (
              <p className="text-[10px] text-slate-500 italic py-6 text-center">No wizard history</p>
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
        )}
      </div>
    </DashboardLayout>
  );
}

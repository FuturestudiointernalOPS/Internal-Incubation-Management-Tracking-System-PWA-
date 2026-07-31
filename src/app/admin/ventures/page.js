"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Rocket,
  Plus,
  Search,
  ChevronRight,
  Users,
  Clock,
  TrendingUp,
  Loader2,
  ExternalLink,
  Link2,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";

const VENTURE_STAGES = {
  idea: { label: "Idea", color: "text-blue-400 bg-blue-500/10" },
  validation: { label: "Validation", color: "text-purple-400 bg-purple-500/10" },
  early_traction: { label: "Early Traction", color: "text-amber-400 bg-amber-500/10" },
  growth: { label: "Growth", color: "text-emerald-400 bg-emerald-500/10" },
  scaling: { label: "Scaling", color: "text-[var(--brand-orange)] bg-[var(--brand-orange)]/10" },
};

const STATUS_CONFIG = {
  active: { label: "Active", color: "text-emerald-400 bg-emerald-500/10", dot: "bg-emerald-400" },
  pending: { label: "Pending", color: "text-amber-400 bg-amber-500/10", dot: "bg-amber-400" },
  archived: { label: "Archived", color: "text-slate-400 bg-slate-500/10", dot: "bg-slate-400" },
};

export default function VenturesPage() {
  const router = useRouter();
  const [ventures, setVentures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchVentures();
  }, []);

  const fetchVentures = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ventures");
      const data = await res.json();
      if (data.success) {
        setVentures(data.ventures || []);
      }
    } catch (e) {
      console.error("Failed to fetch ventures:", e);
    } finally {
      setLoading(false);
    }
  };

  const filteredVentures = ventures.filter((v) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      v.company_name?.toLowerCase().includes(q) ||
      v.venture_id?.toLowerCase().includes(q) ||
      v.industry?.toLowerCase().includes(q)
    );
  });

  const stageConfig = (stage) => VENTURE_STAGES[stage] || VENTURE_STAGES.idea;
  const statusConfig = (status) => STATUS_CONFIG[status] || STATUS_CONFIG.active;

  return (
    <DashboardLayout role="super_admin">
      <div className="space-y-8 pb-20">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 border-b border-[var(--border-primary)] pb-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[var(--brand-orange)]" />
              <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.3em]">
                Venture OS
              </span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-[var(--text-primary)] flex items-center gap-3">
              <Rocket className="w-8 h-8 text-[var(--brand-orange)]" />
              Ventures
            </h1>
          </div>
          <div className="flex gap-3">
            <button
              onClick={async () => {
                try {
                  const res = await fetch("/api/venture-invites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ max_uses: 1, expires_in_days: 7 }) });
                  const d = await res.json();
                  if (d.success) {
                    await navigator.clipboard.writeText(d.link);
                    alert("Invite link copied! Send it to anyone to let them create a venture directly.\n\n" + d.link);
                  } else {
                    alert(d.error || "Failed to generate invite link");
                  }
                } catch (e) {
                  alert("Failed to generate invite link");
                }
              }}
              className="btn gap-2"
            >
              <Link2 className="w-4 h-4" /> Copy Invite Link
            </button>
            <button
              onClick={() => router.push("/admin/ventures/register")}
              className="btn btn-primary gap-2"
            >
              <Plus className="w-4 h-4" /> Register Startup
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search ventures by name, ID, or industry..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-secondary border border-[var(--border-primary)] rounded-xl text-sm text-[var(--text-primary)] placeholder-slate-500 focus:outline-none focus:border-[var(--brand-orange)]/50 transition-all"
          />
        </div>

        {/* Ventures Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--brand-orange)]" />
          </div>
        ) : filteredVentures.length === 0 ? (
          <div className="text-center py-20">
            <Rocket className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">
              {searchQuery ? "No ventures match your search" : "No ventures yet"}
            </h3>
            <p className="text-sm text-slate-500 mb-6">
              {searchQuery
                ? "Try a different search term"
                : "Register your first startup in Venture OS"}
            </p>
            {!searchQuery && (
              <button
                onClick={() => router.push("/admin/ventures/register")}
                className="btn btn-primary gap-2"
              >
                <Plus className="w-4 h-4" /> Register Startup
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredVentures.map((venture) => {
              const stage = stageConfig(venture.business_stage);
              const status = statusConfig(venture.status);
              const founderCount = venture.founder_count || 0;
              const memberCount = venture.member_count || 0;

              return (
                <div
                  key={venture.id}
                  onClick={() => router.push(`/admin/ventures/${venture.venture_id}`)}
                  className="card cursor-pointer hover:border-[var(--brand-orange)]/30 transition-all group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 rounded-xl bg-[var(--brand-orange)]/10 text-[var(--brand-orange)] group-hover:scale-110 transition-transform">
                      <Rocket className="w-5 h-5" />
                    </div>
                    <span
                      className={`text-[8px] font-black uppercase px-2 py-1 rounded ${status.color} ${status.dot ? "before:content-[''] before:w-1.5 before:h-1.5 before:rounded-full before:inline-block before:mr-1" : ""}`}
                    >
                      {status.label}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-[var(--text-primary)] truncate mb-1">
                    {venture.company_name}
                  </h3>
                  <p className="text-[10px] text-slate-500 font-medium mb-3">
                    {venture.venture_id}
                  </p>

                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className="text-[8px] font-black uppercase px-2 py-1 rounded bg-slate-500/10 text-slate-400">
                      {venture.industry}
                    </span>
                    <span className={`text-[8px] font-black uppercase px-2 py-1 rounded ${stage.color}`}>
                      {stage.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-[10px] text-slate-500 border-t border-[var(--border-primary)] pt-3">
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      <span>{founderCount + memberCount} members</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(venture.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="mt-3 flex justify-end">
                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-[var(--brand-orange)] transition-colors" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

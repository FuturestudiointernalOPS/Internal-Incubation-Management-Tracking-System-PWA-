"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  RefreshCw,
  UserPlus,
  ShieldCheck,
  ArrowRight,
  ChevronRight,
  Search,
  Loader2,
  CheckCircle2,
  X,
  AlertTriangle,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";

export default function DevelopersPage() {
  const router = useRouter();
  const [developers, setDevelopers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showPromoteModal, setShowPromoteModal] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState("");

  const fetchDevelopers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/engineering/developers");
      const data = await res.json();
      if (data.success) {
        setDevelopers(data.developers || []);
      }
    } catch (e) {
      console.error("Failed to fetch developers", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDevelopers();
  }, [fetchDevelopers]);

  const filtered = developers.filter(
    (d) =>
      !search ||
      d.name?.toLowerCase().includes(search.toLowerCase()) ||
      d.email?.toLowerCase().includes(search.toLowerCase()),
  );

  const handlePromote = async (cid, newRole) => {
    setActionLoading(true);
    setActionMsg("");
    try {
      const res = await fetch("/api/engineering/developers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cid, role: newRole }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg(`User promoted to ${newRole} successfully`);
        setShowPromoteModal(null);
        fetchDevelopers();
      } else {
        setActionMsg(data.error || "Failed to update");
      }
    } catch (e) {
      setActionMsg("Network error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleActivate = async (cid) => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/contacts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cid, status: "active" }),
      });
      const data = await res.json();
      if (data.success) {
        fetchDevelopers();
      }
    } catch (e) {
      console.error("Failed to activate", e);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <DashboardLayout role="super_admin" activeTab="engineering">
      <div className="space-y-8 pb-20">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-[var(--border-primary)] pb-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[var(--brand-orange)]" />
              <span className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-[0.4em]">
                Engineering Operations
              </span>
            </div>
            <h1 className="text-4xl font-black text-[var(--text-primary)] uppercase tracking-tighter">
              Developers
            </h1>
            <p className="text-xs font-bold text-[var(--text-secondary)] opacity-60">
              {developers.length} team members — Manage developers and interns
            </p>
          </div>
          <button
            onClick={fetchDevelopers}
            className="flex items-center gap-2 px-4 py-2.5 bg-secondary border border-[var(--border-primary)] rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-tertiary transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </header>

        {/* Search */}
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search developers..."
            className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl pl-10 pr-4 py-3 text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/50 font-bold text-xs transition-all"
          />
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div
              className="w-6 h-6 border-2 border-t-[var(--brand-orange)] rounded-full animate-spin"
              style={{
                borderColor: "rgba(255,102,0,0.1)",
                borderTopColor: "var(--brand-orange)",
              }}
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center opacity-40">
            <Users className="w-16 h-16 text-slate-500 mb-4" />
            <p className="text-lg font-black text-[var(--text-primary)] uppercase">
              {search ? "No matches" : "No developers yet"}
            </p>
            <p className="text-xs font-bold text-slate-500 mt-1">
              {search
                ? "Try a different search"
                : "Developers will appear here after they register via invite"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((dev) => (
              <div
                key={dev.cid}
                className="ios-card !p-4 border-[var(--border-primary)] hover:border-[var(--brand-orange)]/30 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        dev.role === "developer"
                          ? "bg-orange-500/10"
                          : "bg-blue-500/10"
                      }`}
                    >
                      <Users
                        className={`w-5 h-5 ${
                          dev.role === "developer"
                            ? "text-[var(--brand-orange)]"
                            : "text-blue-400"
                        }`}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight">
                          {dev.name}
                        </p>
                        <span
                          className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                            dev.role === "developer"
                              ? "bg-orange-500/10 text-[var(--brand-orange)]"
                              : "bg-blue-500/10 text-blue-400"
                          }`}
                        >
                          {dev.role}
                        </span>
                        <span
                          className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                            dev.status === "active" || dev.status === "approved"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-amber-500/10 text-amber-400"
                          }`}
                        >
                          {dev.status}
                        </span>
                      </div>
                      <p className="text-[10px] font-bold text-[var(--text-secondary)] mt-0.5">
                        {dev.email}
                        {dev.active_tasks > 0 &&
                          ` · ${dev.active_tasks} active tasks`}
                        {dev.group_name && ` · ${dev.group_name}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {dev.status === "pending" && (
                      <button
                        onClick={() => handleActivate(dev.cid)}
                        disabled={actionLoading}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 text-[8px] font-black uppercase tracking-widest hover:bg-emerald-500/20 transition-all disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3 h-3" /> Approve
                      </button>
                    )}
                    {dev.role === "intern" && (
                      <button
                        onClick={() => setShowPromoteModal(dev)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-orange-500/10 text-[var(--brand-orange)] text-[8px] font-black uppercase tracking-widest hover:bg-orange-500/20 transition-all"
                      >
                        <ShieldCheck className="w-3 h-3" /> Promote
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Promote Modal */}
        {showPromoteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-md bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-2xl p-6 shadow-2xl space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-5 h-5 text-[var(--brand-orange)]" />
                  <h2 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider">
                    Promote {showPromoteModal.name}
                  </h2>
                </div>
                <button
                  onClick={() => setShowPromoteModal(null)}
                  className="p-2 hover:bg-tertiary rounded-lg transition-all"
                >
                  <X className="w-4 h-4 text-[var(--text-secondary)]" />
                </button>
              </div>

              <p className="text-xs font-bold text-[var(--text-secondary)]">
                Select a new role for <strong className="text-[var(--text-primary)]">{showPromoteModal.name}</strong>:
              </p>

              <div className="space-y-3">
                <button
                  onClick={() => handlePromote(showPromoteModal.cid, "developer")}
                  disabled={actionLoading}
                  className="w-full p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 hover:bg-orange-500/20 transition-all text-left"
                >
                  <p className="text-xs font-black text-[var(--brand-orange)] uppercase tracking-tight">
                    Developer
                  </p>
                  <p className="text-[9px] font-bold text-[var(--text-secondary)] mt-1">
                    Full developer access. Can standup, manage tasks, view projects.
                  </p>
                </button>
                <button
                  onClick={() => handlePromote(showPromoteModal.cid, "intern")}
                  disabled={actionLoading}
                  className="w-full p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition-all text-left"
                >
                  <p className="text-xs font-black text-blue-400 uppercase tracking-tight">
                    Intern
                  </p>
                  <p className="text-[9px] font-bold text-[var(--text-secondary)] mt-1">
                    Restricted view. Can only see their tasks and submit standups.
                  </p>
                </button>
              </div>

              {actionMsg && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <p className="text-[10px] font-bold text-emerald-400">{actionMsg}</p>
                </div>
              )}

              <button
                onClick={() => setShowPromoteModal(null)}
                className="w-full py-3 rounded-xl text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] hover:bg-tertiary transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

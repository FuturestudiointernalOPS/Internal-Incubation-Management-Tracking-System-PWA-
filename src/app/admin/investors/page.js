"use client";

import { useState, useEffect } from "react";
import {
  Users, Building2, CheckCircle2, XCircle, AlertCircle,
  Search, Loader2, Shield, Clock, Ban, UserCheck,
} from "lucide-react";
import { motion } from "framer-motion";
import DashboardLayout from "@/components/layout/DashboardLayout";
import AppCard from "@/components/ui/AppCard";
import AppButton from "@/components/ui/AppButton";

const STATUS_ICONS = {
  pending_review: { icon: Clock, color: "text-amber-400" },
  approved: { icon: CheckCircle2, color: "text-emerald-400" },
  rejected: { icon: XCircle, color: "text-rose-400" },
  suspended: { icon: Ban, color: "text-slate-400" },
};

const STATUS_LABELS = {
  pending_review: "Pending Review",
  approved: "Approved",
  rejected: "Rejected",
  suspended: "Suspended",
};

export default function AdminInvestorsPage() {
  const [investors, setInvestors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [acting, setActing] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => { fetchInvestors(); }, [statusFilter]);

  const fetchInvestors = async () => {
    setLoading(true);
    try {
      const url = `/api/investor/approval?status=${statusFilter}${search ? `&search=${encodeURIComponent(search)}` : ""}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) setInvestors(data.investors || []);
    } catch (_) {}
    setLoading(false);
  };

  const handleAction = async (profileId, action) => {
    setActing(profileId);
    try {
      const res = await fetch("/api/investor/approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_id: profileId, action }),
      });
      const data = await res.json();
      if (data.success) {
        setToast({ type: "success", message: `Investor ${action}d` });
        fetchInvestors();
      } else {
        setToast({ type: "error", message: data.error });
      }
    } catch (_) {}
    setActing(null);
  };

  const counts = {
    all: investors.length,
    pending_review: investors.filter(i => i.approval_status === "pending_review").length,
    approved: investors.filter(i => i.approval_status === "approved").length,
  };

  return (
    <DashboardLayout role="super_admin">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-[var(--text-primary)] uppercase tracking-tighter">
              Investor Management
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Approve, reject, and manage investor access to Investor OS
            </p>
          </div>
        </div>

        {/* FILTERS */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex gap-2">
            {["all", "pending_review", "approved"].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                  statusFilter === s
                    ? "bg-[var(--brand-orange)] text-white"
                    : "bg-[var(--surface-3)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                {s === "all" ? "All" : STATUS_LABELS[s]}
                <span className="ml-2 opacity-60">{counts[s] || 0}</span>
              </button>
            ))}
          </div>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === "Enter" && fetchInvestors()}
              placeholder="Search investors..."
              className="w-full pl-10 pr-4 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-xs font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--brand-orange)]/60"
            />
          </div>
        </div>

        {/* TABLE */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--brand-orange)]" />
          </div>
        ) : investors.length === 0 ? (
          <div className="text-center py-16">
            <Building2 className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-4" />
            <p className="text-sm font-bold text-[var(--text-secondary)]">No investors found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {investors.map(inv => {
              const StatusIcon = STATUS_ICONS[inv.approval_status]?.icon || Clock;
              const statusColor = STATUS_ICONS[inv.approval_status]?.color || "text-slate-400";
              return (
                <AppCard key={inv.id} padding="md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-[var(--brand-orange)]/10 border border-[var(--brand-orange)]/20 flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-[var(--brand-orange)]" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[var(--text-primary)]">
                          {inv.organization_name || inv.name}
                        </p>
                        <p className="text-xs text-[var(--text-secondary)]">{inv.email}</p>
                      </div>
                      <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${statusColor} bg-opacity-10`}>
                        <StatusIcon className="w-3 h-3" />
                        {STATUS_LABELS[inv.approval_status]}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {inv.approval_status === "pending_review" && (
                        <>
                          <AppButton
                            variant="primary"
                            size="sm"
                            icon={CheckCircle2}
                            onClick={() => handleAction(inv.id, "approve")}
                            disabled={acting === inv.id}
                          >
                            Approve
                          </AppButton>
                          <AppButton
                            variant="secondary"
                            size="sm"
                            icon={XCircle}
                            onClick={() => handleAction(inv.id, "reject")}
                            disabled={acting === inv.id}
                            style={{ color: "var(--chart-danger)" }}
                          >
                            Reject
                          </AppButton>
                        </>
                      )}
                      {inv.approval_status === "approved" && (
                        <AppButton
                          variant="secondary"
                          size="sm"
                          icon={Ban}
                          onClick={() => handleAction(inv.id, "suspend")}
                          disabled={acting === inv.id}
                        >
                          Suspend
                        </AppButton>
                      )}
                      {inv.approval_status === "suspended" && (
                        <AppButton
                          variant="primary"
                          size="sm"
                          icon={CheckCircle2}
                          onClick={() => handleAction(inv.id, "approve")}
                          disabled={acting === inv.id}
                        >
                          Re-activate
                        </AppButton>
                      )}
                    </div>
                  </div>
                </AppCard>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

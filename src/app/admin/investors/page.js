"use client";

import { useState, useEffect } from "react";
import {
  Users, Building2, CheckCircle2, XCircle, AlertCircle,
  Search, Loader2, Shield, Clock, Ban, UserCheck, Copy, Check, Link,
} from "lucide-react";
import { motion } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import AppCard from "@/components/ui/AppCard";
import AppButton from "@/components/ui/AppButton";

const STATUS_ICONS = {
  pending_review: { icon: Clock, color: "text-amber-400" },
  approved: { icon: CheckCircle2, color: "text-emerald-400" },
  rejected: { icon: XCircle, color: "text-rose-400" },
  suspended: { icon: Ban, color: "text-slate-400" },
};

const STATUS_LABELS = {
  pending_review: "investorAdmin.list.statusPendingReview",
  approved: "investorAdmin.list.statusApproved",
  rejected: "investorAdmin.list.statusRejected",
  suspended: "investorAdmin.list.statusSuspended",
};

const ACTION_LABELS = {
  approve: "investorAdmin.list.actionApproved",
  reject: "investorAdmin.list.actionRejected",
  suspend: "investorAdmin.list.actionSuspended",
};

export default function AdminInvestorsPage() {
  const [investors, setInvestors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [acting, setActing] = useState(null);
  const [detail, setDetail] = useState(null);
  const [toast, setToast] = useState(null);
  const [copied, setCopied] = useState(false);
  const { t } = useI18n();

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
        setToast({ type: "success", message: t("investorAdmin.list.actionDone", { action: t(ACTION_LABELS[action]) }) });
        fetchInvestors();
      } else {
        setToast({ type: "error", message: t(data.error || "") || data.error });
      }
    } catch (_) {}
    setActing(null);
  };

  const counts = {
    all: investors.length,
    pending_review: investors.filter(i => i.approval_status === "pending_review").length,
    approved: investors.filter(i => i.approval_status === "approved").length,
  };

  const copyRegistrationLink = () => {
    const link = `${window.location.origin}/investor/wizard`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setToast({ type: "success", message: t("investorAdmin.list.registrationLinkCopied") });
      setTimeout(() => setCopied(false), 3000);
    }).catch(() => {
      setToast({ type: "error", message: t("investorAdmin.list.failedToCopy") });
    });
  };

  return (
    <>
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-[var(--text-primary)] uppercase tracking-tighter">
              {t("investorAdmin.list.title")}
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              {t("investorAdmin.list.subtitle")}
            </p>
          </div>
          <AppButton variant="secondary" size="sm" icon={copied ? Check : Link}
            onClick={copyRegistrationLink}>
            {copied ? t("investorAdmin.list.linkCopied") : t("investorAdmin.list.copyRegistrationLink")}
          </AppButton>
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
                {s === "all" ? t("investorAdmin.list.all") : t(STATUS_LABELS[s])}
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
              placeholder={t("investorAdmin.list.searchPlaceholder")}
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
            <p className="text-sm font-bold text-[var(--text-secondary)]">{t("investorAdmin.list.noInvestors")}</p>
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
                        <p className="text-sm font-bold text-[var(--text-primary)] hover:text-[var(--brand-orange)] cursor-pointer" onClick={() => setDetail(inv)}>
                          {inv.organization_name || inv.name}
                        </p>
                        <p className="text-xs text-[var(--text-secondary)]">{inv.email}{inv.review_notes ? t("investorAdmin.list.hasReviewNotes") : ""}</p>
                      </div>
                      <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${statusColor} bg-opacity-10`}>
                        <StatusIcon className="w-3 h-3" />
                        {t(STATUS_LABELS[inv.approval_status])}
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
                            {t("investorAdmin.list.approve")}
                          </AppButton>
                          <AppButton
                            variant="secondary"
                            size="sm"
                            icon={XCircle}
                            onClick={() => handleAction(inv.id, "reject")}
                            disabled={acting === inv.id}
                            style={{ color: "var(--chart-danger)" }}
                          >
                            {t("investorAdmin.list.reject")}
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
                          {t("investorAdmin.list.suspend")}
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
                          {t("investorAdmin.list.reactivate")}
                        </AppButton>
                      )}
                    </div>
                  </div>
                </AppCard>
              );
            })}
          </div>
        )}

        {/* Detail Modal */}
        {detail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDetail(null)} />
            <div className="relative w-full max-w-lg bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-2xl shadow-2xl max-h-[85vh] overflow-y-auto">
              <div className="sticky top-0 bg-[var(--surface-1)] flex items-center justify-between px-6 py-4 border-b border-[var(--border-primary)]">
                <h3 className="text-sm font-black text-[var(--text-primary)] uppercase">{detail.organization_name || detail.name}</h3>
                <button onClick={() => setDetail(null)} className="p-1.5 rounded-lg hover:bg-[var(--surface-3)]">✕</button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    [t("investorAdmin.list.name"), detail.name], [t("investorAdmin.list.email"), detail.email],
                    [t("investorAdmin.list.status"), detail.approval_status], [t("investorAdmin.list.qualification"), detail.qualification_status || "—"],
                    [t("investorAdmin.list.website"), detail.website || "—"], [t("investorAdmin.list.linkedIn"), detail.linkedin || "—"],
                    [t("investorAdmin.list.completion"), `${detail.profile_completion || 0}%`],
                  ].map(([l, v], i) => (
                    <div key={i} className="p-3 rounded-xl bg-[var(--surface-3)]">
                      <p className="text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest">{l}</p>
                      <p className="text-xs font-bold text-[var(--text-primary)] mt-1">{v}</p>
                    </div>
                  ))}
                </div>
                {detail.biography && <div><p className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-1">{t("investorAdmin.list.biography")}</p><p className="text-xs text-[var(--text-primary)]">{detail.biography}</p></div>}
                {detail.investment_experience && <div><p className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-1">{t("investorAdmin.list.experience")}</p><p className="text-xs text-[var(--text-primary)]">{detail.investment_experience}</p></div>}
                {detail.review_notes ? (
                  <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10">
                    <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest mb-1">{t("investorAdmin.list.reviewNotes")}</p>
                    <p className="text-xs text-[var(--text-primary)]">{detail.review_notes}</p>
                    {detail.reviewed_by && <p className="text-[10px] text-[var(--text-tertiary)] mt-1">{t("investorAdmin.list.reviewedBy")} {detail.reviewed_by}</p>}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--text-tertiary)] text-center py-4">{t("investorAdmin.list.noReviewNotes")}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

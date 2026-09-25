"use client";

import { useState } from "react";
import {
  Building2, CheckCircle2, XCircle,
  Search, Loader2, Clock, Ban, Check, Copy, RefreshCw, X, UserPlus,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import AppCard from "@/components/ui/AppCard";
import AppButton from "@/components/ui/AppButton";
import { useApi } from "@/lib/hooks/useApi";
import { useSessionUser } from "@/lib/hooks/useSessionUser";
import { useDialogs } from "@/components/ui/DialogProvider";

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

// Module scope on purpose: the hook keys its internal callback on this function,
// so an inline arrow would give it a new identity on every render and refetch in
// a loop.
const pickInvestors = (payload) => (payload?.success ? payload.investors || [] : []);

export default function AdminInvestorsPage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [acting, setActing] = useState(null);
  const [detail, setDetail] = useState(null);
  const [, setToast] = useState(null);
  const { t } = useI18n();
  const { role } = useSessionUser();
  const { confirm } = useDialogs();
  const isSuperAdmin = role === "super_admin";

  // The "add an investor" link: its own small state, so opening it never touches
  // the list. `runId` is kept to rotate the link (regenerate).
  const [link, setLink] = useState({ open: false, url: "", runId: null, loading: false, error: "" });
  const [copied, setCopied] = useState(false);

  // The loader's work — each filter/search combination caching under its own URL,
  // the cache-first paint, discarding a stale response, the background refresh —
  // belongs to the hook, so the screen keeps no list state of its own and never
  // sets state from an effect. The filter and the search term stay plain
  // dependencies.
  const { data: investors, loading, refresh } = useApi(
    `/api/investor/approval?status=${statusFilter}${search ? `&search=${encodeURIComponent(search)}` : ""}`,
    { defaultValue: [], transform: pickInvestors, deps: [statusFilter, search] },
  );

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
        refresh();
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

  const openInvestorLink = async () => {
    setCopied(false);
    setLink({ open: true, url: "", runId: null, loading: true, error: "" });
    try {
      const res = await fetch("/api/platform/seed/investor-application", { method: "POST" });
      const data = await res.json();
      if (data.success && data.slug) {
        setLink({ open: true, url: `${window.location.origin}/s/${data.slug}`, runId: data.run_id, loading: false, error: "" });
      } else {
        setLink({ open: true, url: "", runId: null, loading: false, error: t(data.error || "") || data.error || t("investorAdmin.list.linkFailed") });
      }
    } catch (_) {
      setLink({ open: true, url: "", runId: null, loading: false, error: t("investorAdmin.list.linkFailed") });
    }
  };

  const copyInvestorLink = async () => {
    if (!link.url) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (_) {}
  };

  const regenerateInvestorLink = async () => {
    if (!link.runId) return;
    if (!(await confirm({ message: t("investorAdmin.list.regenerateConfirm"), tone: "danger" }))) return;
    setCopied(false);
    setLink((prev) => ({ ...prev, loading: true, error: "" }));
    try {
      const res = await fetch("/api/platform/form-runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "regenerate_link", id: link.runId }),
      });
      const data = await res.json();
      if (data.success && data.public_slug) {
        setLink((prev) => ({ ...prev, url: `${window.location.origin}/s/${data.public_slug}`, loading: false, error: "" }));
      } else {
        setLink((prev) => ({ ...prev, loading: false, error: t(data.error || "") || data.error || t("investorAdmin.list.linkFailed") }));
      }
    } catch (_) {
      setLink((prev) => ({ ...prev, loading: false, error: t("investorAdmin.list.linkFailed") }));
    }
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
          {isSuperAdmin && (
            <AppButton variant="primary" size="sm" icon={UserPlus} onClick={openInvestorLink}>
              {t("investorAdmin.list.addInvestor")}
            </AppButton>
          )}
        </div>

        {/* FILTERS */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex gap-2">
            {["all", "pending_review", "approved"].map(statusOption => (
              <button
                key={statusOption}
                onClick={() => setStatusFilter(statusOption)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                  statusFilter === statusOption
                    ? "bg-[var(--brand-orange)] text-white"
                    : "bg-[var(--surface-3)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                {statusOption === "all" ? t("investorAdmin.list.all") : t(STATUS_LABELS[statusOption])}
                <span className="ml-2 opacity-60">{counts[statusOption] || 0}</span>
              </button>
            ))}
          </div>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === "Enter" && refresh()}
              placeholder={t("investorAdmin.list.searchPlaceholder")}
              className="w-full pl-10 pr-4 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-xs font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-brand-orange/60"
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
                      <div className="w-10 h-10 rounded-xl bg-brand-orange/10 border border-brand-orange/20 flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-[var(--brand-orange)]" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[var(--text-primary)] hover:text-[var(--brand-orange)] cursor-pointer" onClick={() => setDetail(inv)}>
                          {inv.organization_name || inv.name}
                        </p>
                        <p className="text-xs text-[var(--text-secondary)]">{inv.email}{inv.review_notes ? t("investorAdmin.list.hasReviewNotes") : ""}</p>
                      </div>
                      <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusColor} bg-opacity-10`}>
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
                  ].map(([label, value], i) => (
                    <div key={i} className="p-3 rounded-xl bg-[var(--surface-3)]">
                      <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">{label}</p>
                      <p className="text-xs font-bold text-[var(--text-primary)] mt-1">{value}</p>
                    </div>
                  ))}
                </div>
                {detail.biography && <div><p className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide mb-1">{t("investorAdmin.list.biography")}</p><p className="text-xs text-[var(--text-primary)]">{detail.biography}</p></div>}
                {detail.investment_experience && <div><p className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide mb-1">{t("investorAdmin.list.experience")}</p><p className="text-xs text-[var(--text-primary)]">{detail.investment_experience}</p></div>}
                {detail.review_notes ? (
                  <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10">
                    <p className="text-[11px] font-bold text-amber-400 uppercase tracking-wide mb-1">{t("investorAdmin.list.reviewNotes")}</p>
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

        {/* Add Investor — the execution link handed to a prospective investor */}
        {isSuperAdmin && link.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setLink((prev) => ({ ...prev, open: false }))} />
            <div className="relative w-full max-w-lg bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-2xl shadow-2xl">
              <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-primary)]">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-[var(--brand-orange)]" />
                  <h3 className="text-sm font-black text-[var(--text-primary)] uppercase">{t("investorAdmin.list.addInvestor")}</h3>
                </div>
                <button onClick={() => setLink((prev) => ({ ...prev, open: false }))} className="p-1.5 rounded-lg hover:bg-[var(--surface-3)]"><X className="w-4 h-4" /></button>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-xs text-[var(--text-secondary)]">{t("investorAdmin.list.addInvestorHint")}</p>

                {link.loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-[var(--brand-orange)]" />
                  </div>
                ) : link.error ? (
                  <p className="text-xs font-bold text-rose-400">{link.error}</p>
                ) : (
                  <>
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-[var(--surface-3)] border border-[var(--border-primary)]">
                      <span className="flex-1 text-xs font-bold text-[var(--text-primary)] break-all">{link.url}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <AppButton variant="primary" size="sm" icon={copied ? Check : Copy} onClick={copyInvestorLink}>
                        {copied ? t("investorAdmin.list.linkCopied") : t("investorAdmin.list.copyLink")}
                      </AppButton>
                      <AppButton variant="secondary" size="sm" icon={RefreshCw} onClick={regenerateInvestorLink}>
                        {t("investorAdmin.list.regenerateLink")}
                      </AppButton>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

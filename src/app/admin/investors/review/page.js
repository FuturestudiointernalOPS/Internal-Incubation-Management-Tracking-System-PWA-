"use client";

import { useState, useEffect } from "react";
import {
  Shield, Loader2, ArrowLeft, Building2, User, Mail, Globe, Link,
  Target, DollarSign, MapPin, FileText, CheckCircle2, XCircle, MessageSquare,
  TrendingUp, Clock,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useSafeBack } from "@/lib/useSafeBack";
import AppCard from "@/components/ui/AppCard";
import AppButton from "@/components/ui/AppButton";
import { cacheGet, cacheSet } from "@/lib/hooks/useApi";

export default function InvestorReviewPage() {
  const goBack = useSafeBack("/admin/investors");
  const { t } = useI18n();
  const [investors, setInvestors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchInvestors(); }, []);

  const fetchInvestors = async (bypassCache = false) => {
    setLoading(true);
    try {
      const url = "/api/investor/approval?status=pending_review";
      const apply = (data) => {
        if (data.success) setInvestors(data.investors || []);
      };
      // Cache-first paint: returning to this page renders instantly from a fresh
      // snapshot; mutation flows pass bypassCache=true so the list always
      // reflects the last action.
      if (!bypassCache) {
        const cached = cacheGet(url);
        if (cached !== null && cached.success) {
          apply(cached);
          setLoading(false);
        }
      }
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        cacheSet(url, data);
        apply(data);
      }
    } catch (_) {}
    setLoading(false);
  };

  const fetchDetail = async (inv) => {
    setSelected(inv);
    setReviewNotes(inv.review_notes || "");
  };

  const handleReview = async (action) => {
    setSaving(true);
    try {
      // First update review notes
      await fetch("/api/investor/approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile_id: selected.id,
          action: action === "recommend" ? "approve" : "reject",
          reason: reviewNotes,
          reviewer: "investment_manager",
        }),
      });
      window.dispatchEvent(new CustomEvent("impactos:notify", {
        detail: { type: "success", message: action === "recommend" ? t("investorAdmin.review.recommendedForApproval") : t("investorAdmin.review.rejected") }
      }));
      setSelected(null);
      fetchInvestors(true);
    } catch (_) {}
    setSaving(false);
  };

  if (loading) {
    return <><div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[var(--brand-orange)]"/></div></>;
  }

  if (selected) {
    return (
      <>
        <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
          <button onClick={() => setSelected(null)} className="text-xs font-bold text-[var(--brand-orange)] hover:underline flex items-center gap-1"><ArrowLeft className="w-3 h-3"/>{t("investorAdmin.review.backToList")}</button>

          <AppCard padding="lg">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-14 h-14 rounded-2xl bg-[var(--brand-orange)]/10 border border-[var(--brand-orange)]/20 flex items-center justify-center">
                <Building2 className="w-7 h-7 text-[var(--brand-orange)]"/>
              </div>
              <div>
                <h2 className="text-lg font-black text-[var(--text-primary)] uppercase">{selected.organization_name || selected.name}</h2>
                <p className="text-xs text-[var(--text-secondary)]">{selected.name} · {selected.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
              {[
                { label: t("investorAdmin.review.status"), value: selected.qualification_status || selected.approval_status, icon: Clock },
                { label: t("investorAdmin.review.website"), value: selected.website || "—", icon: Globe },
                { label: t("investorAdmin.review.linkedin"), value: selected.linkedin || "—", icon: Link },
                { label: t("investorAdmin.review.investmentExperience"), value: selected.investment_experience || "—", icon: FileText },
                { label: t("investorAdmin.review.completion"), value: `${selected.profile_completion || 0}%`, icon: Target },
              ].map((m, i) => (
                <div key={i} className="p-3 rounded-xl bg-[var(--surface-3)]">
                  <p className="text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest flex items-center gap-1"><m.icon className="w-3 h-3"/>{m.label}</p>
                  <p className="text-xs font-bold text-[var(--text-primary)] mt-1 line-clamp-2">{m.value}</p>
                </div>
              ))}
            </div>

            {selected.biography && (
              <div className="mb-6">
                <p className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-2">{t("investorAdmin.review.biography")}</p>
                <p className="text-xs text-[var(--text-primary)]">{selected.biography}</p>
              </div>
            )}

            <div>
              <p className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-2 flex items-center gap-1"><MessageSquare className="w-3 h-3"/>{t("investorAdmin.review.reviewNotes")}</p>
              <textarea value={reviewNotes} onChange={e => setReviewNotes(e.target.value)}
                rows={3} placeholder={t("investorAdmin.review.reviewNotesPlaceholder")}
                className="w-full px-4 py-3 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none resize-none"/>
            </div>
          </AppCard>

          <div className="flex gap-3 justify-end">
            <AppButton variant="secondary" icon={XCircle} onClick={() => handleReview("reject")} disabled={saving} style={{color:"var(--chart-danger)"}}>
              {t("investorAdmin.review.reject")}
            </AppButton>
            <AppButton variant="primary" icon={CheckCircle2} onClick={() => handleReview("recommend")} disabled={saving}>
              {saving ? t("investorAdmin.review.saving") : t("investorAdmin.review.recommendApproval")}
            </AppButton>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={goBack} className="p-2"><ArrowLeft className="w-5 h-5"/></button>
          <div>
            <h1 className="text-xl font-black text-[var(--text-primary)] uppercase">{t("investorAdmin.review.title")}</h1>
            <p className="text-xs text-[var(--text-secondary)]">{t("investorAdmin.review.subtitle")}</p>
          </div>
        </div>

        {investors.length === 0 ? (
          <div className="text-center py-20">
            <Shield className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-4"/>
            <p className="text-sm font-bold text-[var(--text-secondary)]">{t("investorAdmin.review.noPendingReviews")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {investors.map(inv => (
              <AppCard key={inv.id} padding="md" hover onClick={() => fetchDetail(inv)}>
                <div className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-amber-400"/>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[var(--text-primary)]">{inv.organization_name || inv.name}</p>
                      <p className="text-[10px] text-[var(--text-secondary)]">{inv.email} · {inv.profile_completion || 0}% {t("investorAdmin.review.complete")}</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase bg-amber-500/10 text-amber-400">{t("investorAdmin.review.pendingReview")}</span>
                </div>
              </AppCard>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

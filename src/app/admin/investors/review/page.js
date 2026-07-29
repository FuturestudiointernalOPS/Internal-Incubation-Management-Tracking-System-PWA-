"use client";

import { useState, useEffect } from "react";
import {
  Shield, Loader2, ArrowLeft, Building2, User, Mail, Globe, Link,
  Target, DollarSign, MapPin, FileText, CheckCircle2, XCircle, MessageSquare,
  TrendingUp, Clock,
} from "lucide-react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import AppCard from "@/components/ui/AppCard";
import AppButton from "@/components/ui/AppButton";

export default function InvestorReviewPage() {
  const router = useRouter();
  const [investors, setInvestors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchInvestors(); }, []);

  const fetchInvestors = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/investor/approval?status=pending_review");
      const data = await res.json();
      if (data.success) setInvestors(data.investors || []);
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
        detail: { type: "success", message: action === "recommend" ? "Recommended for approval" : "Rejected" }
      }));
      setSelected(null);
      fetchInvestors();
    } catch (_) {}
    setSaving(false);
  };

  if (loading) {
    return <DashboardLayout role="super_admin"><div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[var(--brand-orange)]"/></div></DashboardLayout>;
  }

  if (selected) {
    return (
      <DashboardLayout role="super_admin">
        <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
          <button onClick={() => setSelected(null)} className="text-xs font-bold text-[var(--brand-orange)] hover:underline flex items-center gap-1"><ArrowLeft className="w-3 h-3"/> Back to list</button>

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
                { label: "Status", value: selected.qualification_status || selected.approval_status, icon: Clock },
                { label: "Website", value: selected.website || "—", icon: Globe },
                { label: "LinkedIn", value: selected.linkedin || "—", icon: Link },
                { label: "Investment Experience", value: selected.investment_experience || "—", icon: FileText },
                { label: "Completion", value: `${selected.profile_completion || 0}%`, icon: Target },
              ].map((m, i) => (
                <div key={i} className="p-3 rounded-xl bg-[var(--surface-3)]">
                  <p className="text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest flex items-center gap-1"><m.icon className="w-3 h-3"/>{m.label}</p>
                  <p className="text-xs font-bold text-[var(--text-primary)] mt-1 line-clamp-2">{m.value}</p>
                </div>
              ))}
            </div>

            {selected.biography && (
              <div className="mb-6">
                <p className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-2">Biography</p>
                <p className="text-xs text-[var(--text-primary)]">{selected.biography}</p>
              </div>
            )}

            <div>
              <p className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-2 flex items-center gap-1"><MessageSquare className="w-3 h-3"/>Review Notes</p>
              <textarea value={reviewNotes} onChange={e => setReviewNotes(e.target.value)}
                rows={3} placeholder="Add internal review notes..."
                className="w-full px-4 py-3 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none resize-none"/>
            </div>
          </AppCard>

          <div className="flex gap-3 justify-end">
            <AppButton variant="secondary" icon={XCircle} onClick={() => handleReview("reject")} disabled={saving} style={{color:"var(--chart-danger)"}}>
              Reject
            </AppButton>
            <AppButton variant="primary" icon={CheckCircle2} onClick={() => handleReview("recommend")} disabled={saving}>
              {saving ? "Saving..." : "Recommend Approval"}
            </AppButton>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="super_admin">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2"><ArrowLeft className="w-5 h-5"/></button>
          <div>
            <h1 className="text-xl font-black text-[var(--text-primary)] uppercase">Investor Qualification Review</h1>
            <p className="text-xs text-[var(--text-secondary)]">Review pending investor applications</p>
          </div>
        </div>

        {investors.length === 0 ? (
          <div className="text-center py-20">
            <Shield className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-4"/>
            <p className="text-sm font-bold text-[var(--text-secondary)]">No pending reviews</p>
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
                      <p className="text-[10px] text-[var(--text-secondary)]">{inv.email} · {inv.profile_completion || 0}% complete</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase bg-amber-500/10 text-amber-400">Pending Review</span>
                </div>
              </AppCard>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

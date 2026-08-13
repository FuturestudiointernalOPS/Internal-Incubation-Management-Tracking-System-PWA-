"use client";

import { useState, useEffect } from "react";
import {
  Megaphone, Plus, Loader2, Building2, Target, DollarSign,
  Calendar, Eye, Play, Pause, XCircle, CheckCircle2, BarChart3,
  Users, TrendingUp, Edit3
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import AppCard from "@/components/ui/AppCard";
import AppButton from "@/components/ui/AppButton";
import { useI18n } from "@/lib/i18n";

const STATUS_COLORS = {
  draft: "bg-slate-500/10 text-slate-400",
  active: "bg-emerald-500/10 text-emerald-400",
  paused: "bg-amber-500/10 text-amber-400",
  closed: "bg-rose-500/10 text-rose-400",
};

const STATUS_ICONS = {
  draft: Edit3,
  active: Play,
  paused: Pause,
  closed: XCircle,
};

const VIS_LABELS = {
  public: "investorAdmin.campaigns.visibilityPublic",
  invite_only: "investorAdmin.campaigns.visibilityInviteOnly",
  private: "investorAdmin.campaigns.visibilityPrivate",
};

export default function AdminCampaignsPage() {
  const { t } = useI18n();
  const [campaigns, setCampaigns] = useState([]);
  const [ventures, setVentures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [toast, setToast] = useState(null);

  // Create form
  const [form, setForm] = useState({
    venture_id: "", name: "", target_raise: "", min_investment: "",
    max_investment: "", currency: "USD", visibility: "public",
    opening_date: "", closing_date: "",
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [cRes, vRes] = await Promise.all([
        fetch("/api/investor/campaigns"),
        fetch("/api/investor/ventures?limit=100"),
      ]);
      const cData = await cRes.json();
      const vData = await vRes.json();
      if (cData.success) setCampaigns(cData.campaigns || []);
      if (vData.success) setVentures(vData.ventures || []);
    } catch (_) {}
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!form.venture_id || !form.name) {
      setToast({ type: "error", message: t("investorAdmin.campaigns.ventureNameRequired") });
      return;
    }
    try {
      const res = await fetch("/api/investor/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        setToast({ type: "success", message: t("investorAdmin.campaigns.campaignCreated") });
        setShowCreate(false);
        setForm({ venture_id: "", name: "", target_raise: "", min_investment: "", max_investment: "", currency: "USD", visibility: "public", opening_date: "", closing_date: "" });
        fetchData();
      } else {
        setToast({ type: "error", message: t(data.error || "") || data.error });
      }
    } catch (_) {}
  };

  const handleStatusChange = async (id, newStatus) => {
    const label = newStatus === "active" ? "publish" : newStatus;
    if (!confirm(t("investorAdmin.campaigns.confirmStatusChange", { action: label }))) return;
    try {
      const res = await fetch("/api/investor/campaigns", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setToast({ type: "success", message: t("investorAdmin.campaigns.campaignStatusToast", { status: newStatus }) });
        fetchData();
      } else {
        setToast({ type: "error", message: t(data.error || "") || data.error });
      }
    } catch (_) {}
  };

  const handleUpdateRaised = async (id) => {
    const amount = prompt(t("investorAdmin.campaigns.enterAmountPrompt"));
    if (amount === null) return;
    const num = parseFloat(amount);
    if (isNaN(num) || num < 0) {
      setToast({ type: "error", message: t("investorAdmin.campaigns.invalidAmount") });
      return;
    }
    try {
      const res = await fetch("/api/investor/campaigns", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, current_raised: num }),
      });
      const data = await res.json();
      if (data.success) {
        setToast({ type: "success", message: t("investorAdmin.campaigns.amountUpdated") });
        fetchData();
      } else {
        setToast({ type: "error", message: t(data.error || "") || data.error });
      }
    } catch (_) {}
  };

  const progressPct = (c) => {
    if (!c.target_raise || c.target_raise <= 0) return 0;
    return Math.min(100, Math.round((parseFloat(c.current_raised || 0) / parseFloat(c.target_raise)) * 100));
  };

  const counts = {
    all: campaigns.length,
    active: campaigns.filter(c => c.status === "active").length,
    draft: campaigns.filter(c => c.status === "draft").length,
    closed: campaigns.filter(c => c.status === "closed").length,
  };

  return (
    <DashboardLayout role="super_admin">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Toast */}
        {toast && (
          <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-xs font-bold shadow-lg ${
            toast.type === "success" ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
          }`} onClick={() => setToast(null)}>
            {toast.message}
          </div>
        )}

        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-[var(--text-primary)] uppercase tracking-tighter">
              {t("investorAdmin.campaigns.title")}
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              {t("investorAdmin.campaigns.subtitle")}
            </p>
          </div>
          <AppButton variant="primary" icon={Plus} onClick={() => setShowCreate(true)}>
            {t("investorAdmin.campaigns.newCampaign")}
          </AppButton>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: t("investorAdmin.campaigns.statTotal"), value: counts.all, icon: Megaphone, color: "text-[var(--brand-orange)]" },
            { label: t("investorAdmin.campaigns.statActive"), value: counts.active, icon: Play, color: "text-emerald-400" },
            { label: t("investorAdmin.campaigns.statDraft"), value: counts.draft, icon: Edit3, color: "text-slate-400" },
            { label: t("investorAdmin.campaigns.statClosed"), value: counts.closed, icon: XCircle, color: "text-rose-400" },
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

        {/* Create Form Modal */}
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
            <div className="relative w-full max-w-lg bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-2xl shadow-2xl max-h-[85vh] overflow-y-auto">
              <div className="sticky top-0 bg-[var(--surface-1)] flex items-center justify-between px-6 py-4 border-b border-[var(--border-primary)]">
                <h3 className="text-sm font-black text-[var(--text-primary)] uppercase">{t("investorAdmin.campaigns.createCampaign")}</h3>
                <button onClick={() => setShowCreate(false)} className="p-1.5 rounded-lg hover:bg-[var(--surface-3)]">✕</button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">{t("investorAdmin.campaigns.ventureLabel")}</label>
                  <select value={form.venture_id} onChange={e => setForm({ ...form, venture_id: e.target.value })}
                    className="w-full mt-1 px-3 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/60">
                    <option value="">{t("investorAdmin.campaigns.selectVenture")}</option>
                    {ventures.map(v => (
                      <option key={v.id} value={v.id}>{v.name} ({v.industry || t("investorAdmin.campaigns.na")})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">{t("investorAdmin.campaigns.campaignNameLabel")}</label>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder={t("investorAdmin.campaigns.campaignNamePlaceholder")}
                    className="w-full mt-1 px-3 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-xs font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--brand-orange)]/60" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">{t("investorAdmin.campaigns.targetRaiseLabel")}</label>
                    <input type="number" value={form.target_raise} onChange={e => setForm({ ...form, target_raise: e.target.value })}
                      placeholder="250000"
                      className="w-full mt-1 px-3 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-xs font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--brand-orange)]/60" />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">{t("investorAdmin.campaigns.minInvestmentLabel")}</label>
                    <input type="number" value={form.min_investment} onChange={e => setForm({ ...form, min_investment: e.target.value })}
                      placeholder="25000"
                      className="w-full mt-1 px-3 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-xs font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--brand-orange)]/60" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">{t("investorAdmin.campaigns.openingDateLabel")}</label>
                    <input type="date" value={form.opening_date} onChange={e => setForm({ ...form, opening_date: e.target.value })}
                      className="w-full mt-1 px-3 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/60" />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">{t("investorAdmin.campaigns.closingDateLabel")}</label>
                    <input type="date" value={form.closing_date} onChange={e => setForm({ ...form, closing_date: e.target.value })}
                      className="w-full mt-1 px-3 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/60" />
                  </div>
                </div>
                <div>
                  <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">{t("investorAdmin.campaigns.visibilityLabel")}</label>
                  <div className="flex gap-2 mt-1">
                    {["public", "invite_only", "private"].map(v => (
                      <button key={v} onClick={() => setForm({ ...form, visibility: v })}
                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${
                          form.visibility === v ? "bg-[var(--brand-orange)] text-white" : "bg-[var(--surface-3)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        }`}>{t(VIS_LABELS[v])}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 px-6 pb-5">
                <AppButton variant="secondary" size="sm" onClick={() => setShowCreate(false)}>{t("investorAdmin.campaigns.cancel")}</AppButton>
                <AppButton variant="primary" size="sm" icon={Plus} onClick={handleCreate}>{t("investorAdmin.campaigns.createDraft")}</AppButton>
              </div>
            </div>
          </div>
        )}

        {/* Campaign List */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--brand-orange)]" />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-16">
            <Megaphone className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-4" />
            <p className="text-sm font-bold text-[var(--text-secondary)]">{t("investorAdmin.campaigns.emptyTitle")}</p>
            <p className="text-xs text-[var(--text-tertiary)] mt-1">{t("investorAdmin.campaigns.emptyHint")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {campaigns.map(c => {
              const pct = progressPct(c);
              const StatusIcon = STATUS_ICONS[c.status] || Edit3;
              return (
                <AppCard key={c.id} padding="md">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-black text-[var(--text-primary)]">{c.name}</h4>
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${STATUS_COLORS[c.status]}`}>
                            {c.status}
                          </span>
                          <span className="text-[9px] text-[var(--text-tertiary)]">{t(VIS_LABELS[c.visibility])}</span>
                        </div>
                        <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">{c.venture_name || c.venture_id}{c.industry ? ` · ${c.industry}` : ""}{c.country ? ` · ${c.country}` : ""}</p>
                      </div>
                    </div>

                    {/* Progress bar */}
                    {c.target_raise > 0 && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-[9px]">
                          <span className="font-bold text-[var(--text-secondary)]">{t("investorAdmin.campaigns.raisedAmount", { amount: Number(c.current_raised || 0).toLocaleString() })}</span>
                          <span className="font-black text-[var(--text-primary)]">{t("investorAdmin.campaigns.ofTarget", { pct, amount: Number(c.target_raise).toLocaleString() })}</span>
                        </div>
                        <div className="w-full h-2 bg-[var(--surface-3)] rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )}

                    {/* Stats row */}
                    <div className="flex items-center gap-4 text-[10px] text-[var(--text-tertiary)]">
                      {c.investor_count > 0 && <span className="flex items-center gap-1"><Users className="w-3 h-3"/>{t("investorAdmin.campaigns.investorCount", { count: c.investor_count })}</span>}
                      {c.active_dd_count > 0 && <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3"/>{t("investorAdmin.campaigns.inDdCount", { count: c.active_dd_count })}</span>}
                      {c.opening_date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3"/>{new Date(c.opening_date).toLocaleDateString()}</span>}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-1">
                      {c.status === "draft" && (
                        <AppButton variant="primary" size="sm" icon={Play} onClick={() => handleStatusChange(c.id, "active")}>{t("investorAdmin.campaigns.publish")}</AppButton>
                      )}
                      {c.status === "active" && (
                        <>
                          <AppButton variant="secondary" size="sm" icon={DollarSign} onClick={() => handleUpdateRaised(c.id)}>{t("investorAdmin.campaigns.updateRaised")}</AppButton>
                          <AppButton variant="secondary" size="sm" icon={Pause} onClick={() => handleStatusChange(c.id, "paused")}>{t("investorAdmin.campaigns.pause")}</AppButton>
                          <AppButton variant="secondary" size="sm" icon={XCircle} onClick={() => handleStatusChange(c.id, "closed")}>{t("investorAdmin.campaigns.close")}</AppButton>
                        </>
                      )}
                      {c.status === "paused" && (
                        <>
                          <AppButton variant="primary" size="sm" icon={Play} onClick={() => handleStatusChange(c.id, "active")}>{t("investorAdmin.campaigns.resume")}</AppButton>
                          <AppButton variant="secondary" size="sm" icon={XCircle} onClick={() => handleStatusChange(c.id, "closed")}>{t("investorAdmin.campaigns.close")}</AppButton>
                        </>
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

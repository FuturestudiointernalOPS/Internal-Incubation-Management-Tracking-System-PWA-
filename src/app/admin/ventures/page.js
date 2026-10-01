"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Rocket,
  Plus,
  Search,
  ChevronRight,
  Loader2,
  Building2,
  Mail,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import AppModal from "@/components/ui/AppModal";
import AppInput from "@/components/ui/AppInput";
import AppButton from "@/components/ui/AppButton";

const VENTURE_STAGES = {
  idea: { label: "vadmin.list.stageIdea", color: "text-blue-400 bg-blue-500/10" },
  validation: { label: "vadmin.list.stageValidation", color: "text-purple-400 bg-purple-500/10" },
  early_traction: { label: "vadmin.list.stageEarlyTraction", color: "text-amber-400 bg-amber-500/10" },
  growth: { label: "vadmin.list.stageGrowth", color: "text-emerald-400 bg-emerald-500/10" },
  scaling: { label: "vadmin.list.stageScaling", color: "text-[var(--brand-orange)] bg-brand-orange/10" },
};

const STATUS_CONFIG = {
  active: { label: "vadmin.list.statusActive", color: "text-emerald-400 bg-emerald-500/10", dot: "bg-emerald-400" },
  pending: { label: "vadmin.list.statusPending", color: "text-amber-400 bg-amber-500/10", dot: "bg-amber-400" },
  archived: { label: "vadmin.list.statusArchived", color: "text-slate-400 bg-slate-500/10", dot: "bg-slate-400" },
};

// Module scope on purpose: the hook keys its internal callback on this function,
// so an inline arrow would give it a new identity on every render and refetch in
// a loop.
const pickVentures = (payload) => (payload?.success ? payload.ventures || [] : []);

export default function VenturesPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ company_name: "", founder_email: "" });
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState("");
  // The loader's work — painting from the cache first, discarding a stale
  // response, the background refresh — belongs to the hook, so the screen keeps
  // no list state of its own and never sets state from an effect. Adding a
  // venture calls refresh(), which bypasses the cache.
  const { data: ventures, loading, refresh } = useApi("/api/ventures", {
    defaultValue: [],
    transform: pickVentures,
  });

  const filteredVentures = ventures.filter((venture) => {
    if (!searchQuery) return true;
    const normalizedQuery = searchQuery.toLowerCase();
    return (
      venture.company_name?.toLowerCase().includes(normalizedQuery) ||
      venture.venture_id?.toLowerCase().includes(normalizedQuery) ||
      venture.industry?.toLowerCase().includes(normalizedQuery)
    );
  });

  const stageConfig = (stage) => VENTURE_STAGES[stage] || VENTURE_STAGES.idea;
  const statusConfig = (status) => STATUS_CONFIG[status] || STATUS_CONFIG.active;

  const readinessConfig = (venture) => {
    if (venture.is_ready) {
      return { label: t("vadmin.list.ready"), cls: "bg-emerald-500/10 text-emerald-400" };
    }
    if (venture.readiness_percent != null) {
      return {
        label: `${t("vadmin.list.notReady")} · ${venture.readiness_percent}%`,
        cls: "bg-rose-500/10 text-rose-400",
      };
    }
    return { label: t("vadmin.list.readinessUndefined"), cls: "bg-slate-500/10 text-slate-400" };
  };

  const notify = (type, message, duration = 4000) => {
    window.dispatchEvent(
      new CustomEvent("impactos:notify", { detail: { type, message, duration } }),
    );
  };

  const closeAddModal = () => {
    setShowAddModal(false);
    setAddError("");
  };

  // "Add a Venture": record the venture by name and invite its founder, who
  // receives a link to create their account and access the venture.
  const handleAddVenture = async (event) => {
    event.preventDefault();
    const companyName = addForm.company_name.trim();
    const founderEmail = addForm.founder_email.trim();
    if (companyName.length < 2) {
      setAddError(t("vadmin.list.addVentureNameRequired"));
      return;
    }
    if (!founderEmail) {
      setAddError(t("vadmin.list.addVentureEmailRequired"));
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(founderEmail)) {
      setAddError(t("vadmin.list.addVentureEmailInvalid"));
      return;
    }

    setAddSubmitting(true);
    setAddError("");
    try {
      const response = await fetch("/api/admin/ventures/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_name: companyName, founder_email: founderEmail }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        setAddError(t(payload.error || "vadmin.list.addVentureFailed"));
        return;
      }
      // The venture is created either way; a transport failure only means the
      // invitation email did not leave, which the admin must be told explicitly.
      notify(
        payload.email_sent === false ? "error" : "success",
        t(payload.email_sent === false ? "vadmin.list.addVentureEmailFailed" : "vadmin.list.addVentureSuccess"),
        5000,
      );
      closeAddModal();
      setAddForm({ company_name: "", founder_email: "" });
      refresh();
    } catch {
      setAddError(t("vadmin.list.addVentureFailed"));
    } finally {
      setAddSubmitting(false);
    }
  };

  return (
    <>
      <div className="space-y-8 pb-20">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 border-b border-[var(--border-primary)] pb-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[var(--brand-orange)]" />
              <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                {t("vadmin.list.ventureOs")}
              </span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-[var(--text-primary)] flex items-center gap-3">
              <Rocket className="w-8 h-8 text-[var(--brand-orange)]" />
              {t("vadmin.list.title")}
            </h1>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowAddModal(true)}
              className="btn btn-primary gap-2"
            >
              <Plus className="w-4 h-4" /> {t("vadmin.list.addVenture")}
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder={t("vadmin.list.searchPlaceholder")}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-secondary border border-[var(--border-primary)] rounded-xl text-sm text-[var(--text-primary)] placeholder-slate-500 focus:outline-none focus:border-brand-orange/50 transition-all"
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
              {searchQuery ? t("vadmin.list.noSearchResults") : t("vadmin.list.noVentures")}
            </h3>
            <p className="text-sm text-slate-500 mb-6">
              {searchQuery
                ? t("vadmin.list.tryDifferentSearch")
                : t("vadmin.list.noVenturesDesc")}
            </p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                    <th className="text-left px-5 py-3">{t("vadmin.list.venture")}</th>
                    <th className="text-left px-5 py-3">{t("vadmin.list.industry")}</th>
                    <th className="text-left px-5 py-3">{t("vadmin.list.stage")}</th>
                    <th className="text-left px-5 py-3">{t("vadmin.list.status")}</th>
                    <th className="text-left px-5 py-3">{t("vadmin.list.readiness")}</th>
                    <th className="text-left px-5 py-3">{t("vadmin.list.members")}</th>
                    <th className="text-left px-5 py-3">{t("vadmin.list.created")}</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filteredVentures.map((venture) => {
                    const stage = stageConfig(venture.business_stage);
                    const status = statusConfig(venture.status);
                    const readiness = readinessConfig(venture);
                    const founderCount = parseInt(venture.founder_count) || 0;
                    const memberCount = parseInt(venture.member_count) || 0;
                    return (
                      <tr
                        key={venture.id}
                        onClick={() => router.push(`/admin/ventures/${venture.venture_id}/verification`)}
                        className="border-b border-divider/50 cursor-pointer hover:bg-tertiary/50 transition-all group"
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-brand-orange/10 text-[var(--brand-orange)] group-hover:scale-110 transition-transform">
                              <Rocket className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-[var(--text-primary)]">{venture.company_name}</p>
                              <p className="text-[10px] text-slate-500 font-medium">{venture.venture_id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-[9px] font-black uppercase px-2 py-1 rounded bg-slate-500/10 text-slate-400">
                            {venture.industry}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span className={`text-[9px] font-black uppercase px-2 py-1 rounded ${stage.color}`}>
                            {t(stage.label)}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center gap-1.5 text-[9px] font-black uppercase px-2 py-1 rounded ${status.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${status.dot || "bg-current"}`} />
                            {t(status.label)}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center gap-1.5 text-[9px] font-black uppercase px-2 py-1 rounded ${readiness.cls}`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            {readiness.label}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-[11px] text-slate-400 font-medium">
                          {t("vadmin.list.membersCount", { count: founderCount + memberCount })}
                        </td>
                        <td className="px-5 py-3 text-[11px] text-slate-400 font-medium">
                          {new Date(venture.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-3 text-right whitespace-nowrap">
                          <ChevronRight className="w-4 h-4 text-slate-600 inline group-hover:text-[var(--brand-orange)] transition-colors" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <AppModal
        isOpen={showAddModal}
        onClose={closeAddModal}
        title={t("vadmin.list.addVentureTitle")}
        size="sm"
      >
        <form onSubmit={handleAddVenture} className="space-y-5">
          <p className="text-xs leading-relaxed -mt-2" style={{ color: "var(--text-secondary)" }}>
            {t("vadmin.list.addVentureSubtitle")}
          </p>
          <AppInput
            autoFocus
            icon={Building2}
            label={t("vadmin.list.ventureNameLabel")}
            placeholder={t("vadmin.list.ventureNamePlaceholder")}
            value={addForm.company_name}
            onChange={(event) => {
              setAddForm((previous) => ({ ...previous, company_name: event.target.value }));
              setAddError("");
            }}
          />
          <AppInput
            icon={Mail}
            type="email"
            label={t("vadmin.list.founderEmailLabel")}
            placeholder={t("vadmin.list.founderEmailPlaceholder")}
            value={addForm.founder_email}
            onChange={(event) => {
              setAddForm((previous) => ({ ...previous, founder_email: event.target.value }));
              setAddError("");
            }}
          />
          {addError && <p className="text-xs font-bold text-rose-500">{addError}</p>}
          <div className="flex justify-end gap-3 pt-1">
            <AppButton
              type="button"
              variant="ghost"
              disabled={addSubmitting}
              onClick={closeAddModal}
            >
              {t("vadmin.list.addVentureCancel")}
            </AppButton>
            <AppButton type="submit" variant="primary" icon={Plus} loading={addSubmitting}>
              {t("vadmin.list.addVentureSubmit")}
            </AppButton>
          </div>
        </form>
      </AppModal>
    </>
  );
}

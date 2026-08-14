"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Rocket,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  Building2,
  Users,
  Target,
  Shield,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useI18n } from "@/lib/i18n";
import { useSafeBack } from "@/lib/useSafeBack";

export const dynamic = "force-dynamic";

/**
 * PROMOTE TO VENTURE — Enhancement 1.1 — Workflow A
 *
 * Allows a Program Manager to promote an approved program team into Venture OS.
 * This page is accessible from the Program detail workspace.
 */

export default function PromoteToVenture() {
  const { id } = useParams();
  const router = useRouter();
  const goBack = useSafeBack(`/pm/programs/${id}`);
  const { t } = useI18n();

  const [user, setUser] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [program, setProgram] = useState(null);
  const [toast, setToast] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [promotionResult, setPromotionResult] = useState(null);
  const [promotionError, setPromotionError] = useState(null);

  // Form fields
  const [companyName, setCompanyName] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [industry, setIndustry] = useState("");
  const [businessStage, setBusinessStage] = useState("idea");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  const notify = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Fetch program data on mount
  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) setUser(JSON.parse(savedUser));
  }, []);

  useEffect(() => {
    const fetchProgram = async () => {
      try {
        const res = await fetch(`/api/pm/full-state?id=${id}&t=${Date.now()}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (data.success && data.program) {
          setProgram(data.program);
          // Pre-fill company name from program name
          setCompanyName(data.program.name || "");
        } else {
          notify(t("pmMisc.promote.failedToLoadProgram"), "error");
        }
      } catch (e) {
        notify(t("pmMisc.promote.networkErrorLoadingProgram"), "error");
      } finally {
        setLoading(false);
      }
    };
    fetchProgram();
  }, [id]);

  const handlePromote = async () => {
    // Validate
    if (!companyName.trim()) {
      notify(t("pmMisc.promote.companyNameRequired"), "error");
      return;
    }
    if (!industry.trim()) {
      notify(t("pmMisc.promote.industryRequired"), "error");
      return;
    }
    if (!businessStage.trim()) {
      notify(t("pmMisc.promote.businessStageRequired"), "error");
      return;
    }
    if (!program) {
      notify(t("pmMisc.promote.programDataNotLoaded"), "error");
      return;
    }

    setSubmitting(true);
    setPromotionError(null);

    try {
      const res = await fetch("/api/ventures/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          program_id: id,
          company_name: companyName.trim(),
          registration_number: registrationNumber.trim() || null,
          industry: industry.trim(),
          business_stage: businessStage.trim(),
          description: description.trim() || null,
          website: website.trim() || null,
          logo_url: logoUrl.trim() || null,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setPromotionResult(data);
        notify(
          t("pmMisc.promote.promotedSuccessfully", {
            name: data.venture.company_name,
          }),
          "success",
        );
        // Redirect after 2 seconds
        setTimeout(() => {
          router.push(data.redirect);
        }, 2000);
      } else {
        setPromotionError(t((data.error || t("pmMisc.promote.promotionFailed")) || "") || (data.error || t("pmMisc.promote.promotionFailed")));
        if (data.conflicts) {
          notify(data.conflicts.join(", "), "error");
        } else {
          notify(t((data.error || t("pmMisc.promote.promotionFailed")) || "") || (data.error || t("pmMisc.promote.promotionFailed")), "error");
        }
      }
    } catch (e) {
      notify(t("pmMisc.promote.networkErrorDuringPromotion"), "error");
      setPromotionError(t(e.message || "") || e.message);
    } finally {
      setSubmitting(false);
      setShowConfirmModal(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout role={user.role || "program_manager"}>
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
          <div className="w-12 h-12 border-4 border-[var(--brand-orange)] border-t-transparent rounded-full animate-spin" />
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">
            {t("common.loading")}
          </p>
        </div>
      </DashboardLayout>
    );
  }

  const canPromote =
    user.role === "super_admin" || user.role === "program_manager";

  return (
    <DashboardLayout role={user.role || "program_manager"}>
      <div className="space-y-8 animate-in">
        {/* Toast */}
        {toast && (
          <div
            className={`fixed top-6 right-6 z-50 px-6 py-3 rounded-xl shadow-2xl border text-sm font-bold uppercase tracking-wider transition-all ${
              toast.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
                : "bg-rose-500/10 border-rose-500/30 text-rose-500"
            }`}
          >
            {toast.msg}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={goBack}
              className="p-2 rounded-xl border border-[var(--border-primary)] hover:bg-tertiary transition-all"
              title={t("pmMisc.promote.goBack")}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="status-badge bg-purple-500/10 text-purple-500 border border-purple-500/20">
                  {t("pmMisc.promote.workflowA")}
                </span>
                <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                  {program?.id}
                </span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)] mt-1">
                {t("pmMisc.promote.promoteToVentureOS")}
              </h1>
              <p className="text-[var(--text-secondary)] text-sm max-w-2xl mt-1">
                {t("pmMisc.promote.headerDescription", {
                  name: program?.name,
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Program Info Card */}
        <div className="card bg-gradient-to-r from-purple-500/5 to-transparent border-l-4 border-purple-500 p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
              <Rocket className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-tight">
                {t("pmMisc.promote.programSummary")}
              </h3>
              <p className="text-[10px] font-bold text-[var(--text-secondary)] tracking-wider">
                {t("pmMisc.promote.programMeta", {
                  status: program?.status || "",
                  weeks: program?.duration_weeks || "?",
                  participants: program?.participants_count || 0,
                })}
              </p>
            </div>
          </div>
          {program?.venture_id && (
            <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              <span className="text-[10px] font-black uppercase text-amber-500">
                {t("pmMisc.promote.alreadyPromoted")}{" "}
                <span className="text-[var(--brand-orange)]">
                  {program.venture_id}
                </span>
              </span>
            </div>
          )}
        </div>

        {promotionResult ? (
          /* Success State */
          <div className="card border-emerald-500/30 bg-emerald-500/5 p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>
            <h2 className="text-2xl font-black uppercase tracking-tighter">
              {t("pmMisc.promote.promotionSuccessful")}
            </h2>
            <p className="text-[var(--text-secondary)]">
              {t("pmMisc.promote.promotionSuccessDetail", {
                name: promotionResult.venture.company_name,
              })}{" "}
              <span className="font-bold text-[var(--brand-orange)]">
                {promotionResult.venture.venture_id}
              </span>
            </p>
            <div className="flex justify-center gap-4 mt-4">
              <div className="text-center p-4 bg-primary rounded-xl border border-[var(--border-primary)]">
                <p className="text-lg font-black text-[var(--brand-orange)]">{promotionResult.founders?.length || 0}</p>
                <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("pmMisc.promote.founders")}
                </p>
              </div>
              <div className="text-center p-4 bg-primary rounded-xl border border-[var(--border-primary)]">
                <p className="text-lg font-black text-[var(--brand-orange)]">{promotionResult.members?.length || 0}</p>
                <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("pmMisc.promote.members")}
                </p>
              </div>
            </div>
            <p className="text-[10px] text-[var(--text-secondary)]">
              {t("pmMisc.promote.redirecting")}
            </p>
          </div>
        ) : (
          /* Promotion Form */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Form */}
            <div className="lg:col-span-2 space-y-6">
              <div className="card space-y-6">
                <h3 className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[var(--brand-orange)]" />
                  {t("pmMisc.promote.companyInformation")}
                </h3>

                <div className="space-y-4">
                  {/* Company Name */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                      {t("pmMisc.promote.companyName")}{" "}
                      <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder={t("pmMisc.promote.companyNamePlaceholder")}
                      className="w-full bg-tertiary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-[var(--brand-orange)] transition-all"
                      disabled={submitting}
                    />
                    <p className="text-[8px] font-bold text-[var(--text-secondary)]">
                      {t("pmMisc.promote.prefillHint")}
                    </p>
                  </div>

                  {/* Registration Number */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                      {t("pmMisc.promote.registrationNumber")}
                    </label>
                    <input
                      type="text"
                      value={registrationNumber}
                      onChange={(e) => setRegistrationNumber(e.target.value)}
                      placeholder={t("pmMisc.promote.registrationNumberPlaceholder")}
                      className="w-full bg-tertiary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-[var(--brand-orange)] transition-all"
                      disabled={submitting}
                    />
                  </div>

                  {/* Industry & Business Stage */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                        {t("pmMisc.promote.industry")}{" "}
                        <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={industry}
                        onChange={(e) => setIndustry(e.target.value)}
                        className="w-full bg-tertiary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-[var(--brand-orange)] transition-all"
                        disabled={submitting}
                      >
                        <option value="">
                          {t("pmMisc.promote.selectIndustry")}
                        </option>
                        <option value="fintech">
                          {t("pmMisc.promote.industryFintech")}
                        </option>
                        <option value="healthtech">
                          {t("pmMisc.promote.industryHealthtech")}
                        </option>
                        <option value="cleantech">
                          {t("pmMisc.promote.industryCleantech")}
                        </option>
                        <option value="edtech">
                          {t("pmMisc.promote.industryEdtech")}
                        </option>
                        <option value="agritech">
                          {t("pmMisc.promote.industryAgritech")}
                        </option>
                        <option value="ecommerce">
                          {t("pmMisc.promote.industryEcommerce")}
                        </option>
                        <option value="saas">
                          {t("pmMisc.promote.industrySaaS")}
                        </option>
                        <option value="ai-ml">
                          {t("pmMisc.promote.industryAIML")}
                        </option>
                        <option value="blockchain">
                          {t("pmMisc.promote.industryBlockchain")}
                        </option>
                        <option value="social-impact">
                          {t("pmMisc.promote.industrySocialImpact")}
                        </option>
                        <option value="other">
                          {t("pmMisc.promote.industryOther")}
                        </option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                        {t("pmMisc.promote.businessStage")}{" "}
                        <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={businessStage}
                        onChange={(e) => setBusinessStage(e.target.value)}
                        className="w-full bg-tertiary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-[var(--brand-orange)] transition-all"
                        disabled={submitting}
                      >
                        <option value="idea">
                          {t("pmMisc.promote.stageIdea")}
                        </option>
                        <option value="pre-seed">
                          {t("pmMisc.promote.stagePreSeed")}
                        </option>
                        <option value="seed">
                          {t("pmMisc.promote.stageSeed")}
                        </option>
                        <option value="early">
                          {t("pmMisc.promote.stageEarly")}
                        </option>
                        <option value="growth">
                          {t("pmMisc.promote.stageGrowth")}
                        </option>
                        <option value="scale">
                          {t("pmMisc.promote.stageScale")}
                        </option>
                      </select>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                      {t("pmMisc.promote.description")}
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={t("pmMisc.promote.descriptionPlaceholder")}
                      rows={3}
                      className="w-full bg-tertiary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-[var(--brand-orange)] transition-all resize-none"
                      disabled={submitting}
                    />
                  </div>

                  {/* Website & Logo */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                        {t("pmMisc.promote.website")}
                      </label>
                      <input
                        type="url"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        placeholder="https://example.com"
                        className="w-full bg-tertiary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-[var(--brand-orange)] transition-all"
                        disabled={submitting}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                        {t("pmMisc.promote.logoUrl")}
                      </label>
                      <input
                        type="url"
                        value={logoUrl}
                        onChange={(e) => setLogoUrl(e.target.value)}
                        placeholder="https://example.com/logo.png"
                        className="w-full bg-tertiary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-[var(--brand-orange)] transition-all"
                        disabled={submitting}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              <div className="card space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                  <Shield className="w-3 h-3 text-[var(--brand-orange)]" />
                  {t("pmMisc.promote.whatHappens")}
                </h4>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2 text-[11px] text-[var(--text-secondary)]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                    {t("pmMisc.promote.whatVentureRecord")}
                  </li>
                  <li className="flex items-start gap-2 text-[11px] text-[var(--text-secondary)]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                    {t("pmMisc.promote.whatParticipantsFounders")}
                  </li>
                  <li className="flex items-start gap-2 text-[11px] text-[var(--text-secondary)]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                    {t("pmMisc.promote.whatContactsMembers")}
                  </li>
                  <li className="flex items-start gap-2 text-[11px] text-[var(--text-secondary)]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                    {t("pmMisc.promote.whatProgramRelationship")}
                  </li>
                  <li className="flex items-start gap-2 text-[11px] text-[var(--text-secondary)]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                    {t("pmMisc.promote.whatActivityLogs")}
                  </li>
                </ul>
              </div>

              {/* Error display */}
              {promotionError && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-black uppercase text-rose-500">
                      {t("pmMisc.promote.promotionFailedTitle")}
                    </p>
                    <p className="text-[11px] text-[var(--text-secondary)] mt-1">
                      {promotionError}
                    </p>
                  </div>
                </div>
              )}

              {/* Promote Button */}
              {canPromote && !program?.venture_id && (
                <button
                  onClick={() => setShowConfirmModal(true)}
                  disabled={submitting || !companyName.trim() || !industry.trim() || !businessStage.trim()}
                  className="w-full btn btn-primary py-4 gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {t("pmMisc.promote.promoting")}
                    </>
                  ) : (
                    <>
                      <Rocket className="w-5 h-5" />
                      {t("pmMisc.promote.promoteToVentureOS")}
                    </>
                  )}
                </button>
              )}

              {program?.venture_id && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                  <p className="text-[10px] font-black uppercase text-amber-500 text-center">
                    {t("pmMisc.promote.alreadyPromotedBanner")}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Confirmation Modal */}
        {showConfirmModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="card max-w-md w-full space-y-6 p-6">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-[var(--brand-orange)]/10 flex items-center justify-center mx-auto">
                  <Rocket className="w-6 h-6 text-[var(--brand-orange)]" />
                </div>
                <h3 className="text-lg font-black uppercase tracking-tight">
                  {t("pmMisc.promote.confirmPromotion")}
                </h3>
                <p className="text-sm text-[var(--text-secondary)]">
                  {t("pmMisc.promote.confirmModalText", { name: companyName })}
                </p>
              </div>

              <div className="bg-tertiary p-4 rounded-xl space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-[var(--text-secondary)] font-bold">
                    {t("pmMisc.promote.confirmCompany")}
                  </span>
                  <span className="font-bold">{companyName}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-[var(--text-secondary)] font-bold">
                    {t("pmMisc.promote.confirmIndustry")}
                  </span>
                  <span className="font-bold">{industry}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-[var(--text-secondary)] font-bold">
                    {t("pmMisc.promote.confirmStage")}
                  </span>
                  <span className="font-bold">{businessStage}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-[var(--text-secondary)] font-bold">
                    {t("pmMisc.promote.confirmProgram")}
                  </span>
                  <span className="font-bold">{program?.name}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 btn btn-secondary"
                  disabled={submitting}
                >
                  {t("pmMisc.promote.cancel")}
                </button>
                <button
                  onClick={handlePromote}
                  disabled={submitting}
                  className="flex-1 btn btn-primary gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t("pmMisc.promote.promoting")}
                    </>
                  ) : (
                    <>
                      <Rocket className="w-4 h-4" />
                      {t("pmMisc.promote.confirmPromotion")}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

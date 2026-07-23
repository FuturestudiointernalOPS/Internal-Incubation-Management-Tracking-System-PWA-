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
          notify("Failed to load program data", "error");
        }
      } catch (e) {
        notify("Network error loading program", "error");
      } finally {
        setLoading(false);
      }
    };
    fetchProgram();
  }, [id]);

  const handlePromote = async () => {
    // Validate
    if (!companyName.trim()) {
      notify("Company name is required", "error");
      return;
    }
    if (!industry.trim()) {
      notify("Industry is required", "error");
      return;
    }
    if (!businessStage.trim()) {
      notify("Business stage is required", "error");
      return;
    }
    if (!program) {
      notify("Program data not loaded", "error");
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
          `"${data.venture.company_name}" promoted successfully! Redirecting...`,
          "success",
        );
        // Redirect after 2 seconds
        setTimeout(() => {
          router.push(data.redirect);
        }, 2000);
      } else {
        setPromotionError(data.error || "Promotion failed");
        if (data.conflicts) {
          notify(data.conflicts.join(", "), "error");
        } else {
          notify(data.error || "Promotion failed", "error");
        }
      }
    } catch (e) {
      notify("Network error during promotion", "error");
      setPromotionError(e.message);
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
            {t("loading")}
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
              onClick={() => router.back()}
              className="p-2 rounded-xl border border-[var(--border-primary)] hover:bg-tertiary transition-all"
              title="Go back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="status-badge bg-purple-500/10 text-purple-500 border border-purple-500/20">
                  WORKFLOW A
                </span>
                <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                  {program?.id}
                </span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)] mt-1">
                Promote to Venture OS
              </h1>
              <p className="text-[var(--text-secondary)] text-sm max-w-2xl mt-1">
                Promote &ldquo;{program?.name}&rdquo; from Program OS into Venture OS.
                This will create a full Venture profile with founders and team members.
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
                Program Summary
              </h3>
              <p className="text-[10px] font-bold text-[var(--text-secondary)] tracking-wider">
                {program?.status} · {program?.duration_weeks || "?"} weeks ·{" "}
                {program?.participants_count || 0} participants
              </p>
            </div>
          </div>
          {program?.venture_id && (
            <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              <span className="text-[10px] font-black uppercase text-amber-500">
                This program has already been promoted to Venture{" "}
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
              Promotion Successful
            </h2>
            <p className="text-[var(--text-secondary)]">
              {promotionResult.venture.company_name} has been promoted to Venture OS
              as <span className="font-bold text-[var(--brand-orange)]">{promotionResult.venture.venture_id}</span>
            </p>
            <div className="flex justify-center gap-4 mt-4">
              <div className="text-center p-4 bg-primary rounded-xl border border-[var(--border-primary)]">
                <p className="text-lg font-black text-[var(--brand-orange)]">{promotionResult.founders?.length || 0}</p>
                <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">Founders</p>
              </div>
              <div className="text-center p-4 bg-primary rounded-xl border border-[var(--border-primary)]">
                <p className="text-lg font-black text-[var(--brand-orange)]">{promotionResult.members?.length || 0}</p>
                <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">Members</p>
              </div>
            </div>
            <p className="text-[10px] text-[var(--text-secondary)]">
              Redirecting to Venture Dashboard...
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
                  Company Information
                </h3>

                <div className="space-y-4">
                  {/* Company Name */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                      Company Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="e.g., TechFlow Inc."
                      className="w-full bg-tertiary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-[var(--brand-orange)] transition-all"
                      disabled={submitting}
                    />
                    <p className="text-[8px] font-bold text-[var(--text-secondary)]">
                      Pre-filled from program name. You can edit it.
                    </p>
                  </div>

                  {/* Registration Number */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                      Registration Number
                    </label>
                    <input
                      type="text"
                      value={registrationNumber}
                      onChange={(e) => setRegistrationNumber(e.target.value)}
                      placeholder="e.g., RC-2024-001"
                      className="w-full bg-tertiary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-[var(--brand-orange)] transition-all"
                      disabled={submitting}
                    />
                  </div>

                  {/* Industry & Business Stage */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                        Industry <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={industry}
                        onChange={(e) => setIndustry(e.target.value)}
                        className="w-full bg-tertiary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-[var(--brand-orange)] transition-all"
                        disabled={submitting}
                      >
                        <option value="">Select industry</option>
                        <option value="fintech">Fintech</option>
                        <option value="healthtech">Healthtech</option>
                        <option value="cleantech">Cleantech</option>
                        <option value="edtech">Edtech</option>
                        <option value="agritech">Agritech</option>
                        <option value="ecommerce">E-commerce</option>
                        <option value="saas">SaaS</option>
                        <option value="ai-ml">AI / Machine Learning</option>
                        <option value="blockchain">Blockchain / Web3</option>
                        <option value="social-impact">Social Impact</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                        Business Stage <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={businessStage}
                        onChange={(e) => setBusinessStage(e.target.value)}
                        className="w-full bg-tertiary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-[var(--brand-orange)] transition-all"
                        disabled={submitting}
                      >
                        <option value="idea">Idea</option>
                        <option value="pre-seed">Pre-Seed</option>
                        <option value="seed">Seed</option>
                        <option value="early">Early Stage</option>
                        <option value="growth">Growth</option>
                        <option value="scale">Scale</option>
                      </select>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                      Description
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Brief description of the startup..."
                      rows={3}
                      className="w-full bg-tertiary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-[var(--brand-orange)] transition-all resize-none"
                      disabled={submitting}
                    />
                  </div>

                  {/* Website & Logo */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                        Website
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
                        Logo URL
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
                  What happens
                </h4>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2 text-[11px] text-[var(--text-secondary)]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                    Venture record created
                  </li>
                  <li className="flex items-start gap-2 text-[11px] text-[var(--text-secondary)]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                    Participants become founders
                  </li>
                  <li className="flex items-start gap-2 text-[11px] text-[var(--text-secondary)]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                    Contacts become team members
                  </li>
                  <li className="flex items-start gap-2 text-[11px] text-[var(--text-secondary)]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                    Program relationship preserved
                  </li>
                  <li className="flex items-start gap-2 text-[11px] text-[var(--text-secondary)]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                    Activity logs & notifications
                  </li>
                </ul>
              </div>

              {/* Error display */}
              {promotionError && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-black uppercase text-rose-500">
                      Promotion Failed
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
                      Promoting...
                    </>
                  ) : (
                    <>
                      <Rocket className="w-5 h-5" />
                      Promote to Venture OS
                    </>
                  )}
                </button>
              )}

              {program?.venture_id && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                  <p className="text-[10px] font-black uppercase text-amber-500 text-center">
                    Already promoted
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
                  Confirm Promotion
                </h3>
                <p className="text-sm text-[var(--text-secondary)]">
                  Are you sure you want to promote &ldquo;{companyName}&rdquo; to Venture OS?
                  This action will create a new venture with founders and members
                  from the current program.
                </p>
              </div>

              <div className="bg-tertiary p-4 rounded-xl space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-[var(--text-secondary)] font-bold">Company:</span>
                  <span className="font-bold">{companyName}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-[var(--text-secondary)] font-bold">Industry:</span>
                  <span className="font-bold">{industry}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-[var(--text-secondary)] font-bold">Stage:</span>
                  <span className="font-bold">{businessStage}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-[var(--text-secondary)] font-bold">Program:</span>
                  <span className="font-bold">{program?.name}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 btn btn-secondary"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  onClick={handlePromote}
                  disabled={submitting}
                  className="flex-1 btn btn-primary gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Promoting...
                    </>
                  ) : (
                    <>
                      <Rocket className="w-4 h-4" />
                      Confirm Promotion
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

"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Rocket,
  ArrowLeft,
  Building2,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Save,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";

const INDUSTRIES = [
  "Fintech",
  "Healthtech",
  "Edtech",
  "Cleantech",
  "SaaS",
  "E-commerce",
  "Agritech",
  "Logistics",
  "AI / ML",
  "Blockchain",
  "Media & Entertainment",
  "Real Estate",
  "Other",
];

const BUSINESS_STAGES = [
  { value: "idea", label: "Idea" },
  { value: "validation", label: "Validation" },
  { value: "early_traction", label: "Early Traction" },
  { value: "growth", label: "Growth" },
  { value: "scaling", label: "Scaling" },
];

export default function EditVenturePage({ params }) {
  const router = useRouter();
  const { id } = React.use(params);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    if (id) fetchVenture();
  }, [id]);

  const fetchVenture = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ventures/${id}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Venture not found");
        return;
      }
      setForm({
        company_name: data.venture.company_name || "",
        registration_number: data.venture.registration_number || "",
        industry: data.venture.industry || "",
        business_stage: data.venture.business_stage || "",
        description: data.venture.description || "",
        website: data.venture.website || "",
        logo_url: data.venture.logo_url || "",
      });
    } catch (e) {
      setError("Failed to load venture");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/ventures/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to save changes");
        return;
      }

      setSuccess("Changes saved successfully");

      // Redirect back to venture detail after 1.5s
      setTimeout(() => {
        router.push(`/admin/ventures/${id}`);
      }, 1500);
    } catch (e) {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout role="super_admin">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--brand-orange)]" />
        </div>
      </DashboardLayout>
    );
  }

  if (error && !form) {
    return (
      <DashboardLayout role="super_admin">
        <div className="text-center py-20">
          <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">Venture Not Found</h2>
          <p className="text-slate-500 mb-6">{error}</p>
          <button onClick={() => router.push("/admin/ventures")} className="btn btn-primary">
            Back to Ventures
          </button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="super_admin">
      <div className="max-w-3xl mx-auto space-y-8 pb-20">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-tertiary transition-all">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <Rocket className="w-5 h-5 text-[var(--brand-orange)]" />
              <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.3em]">
                Venture OS
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              Edit Venture
            </h1>
          </div>
        </div>

        {/* Success message */}
        {success && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <span className="text-sm font-bold text-emerald-500">{success}</span>
          </div>
        )}

        {/* Error message */}
        {error && form && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-500" />
            <span className="text-sm font-bold text-rose-500">{error}</span>
          </div>
        )}

        {/* Edit Form */}
        {form && (
          <div className="card space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-[var(--border-primary)]">
              <div className="w-8 h-8 rounded-xl bg-[var(--brand-orange)]/10 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-[var(--brand-orange)]" />
              </div>
              <div>
                <h2 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">
                  Company Information
                </h2>
                <p className="text-[9px] text-slate-500">Venture ID: {id}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">
                  Company Name
                </label>
                <input
                  type="text"
                  value={form.company_name}
                  onChange={(e) => handleChange("company_name", e.target.value)}
                  className="w-full px-4 py-3 bg-tertiary border border-[var(--border-primary)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-orange)]/50 transition-all"
                />
              </div>

              <div>
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">
                  Registration Number
                </label>
                <input
                  type="text"
                  value={form.registration_number}
                  onChange={(e) => handleChange("registration_number", e.target.value)}
                  className="w-full px-4 py-3 bg-tertiary border border-[var(--border-primary)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-orange)]/50 transition-all"
                />
              </div>

              <div>
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">
                  Website
                </label>
                <input
                  type="url"
                  value={form.website}
                  onChange={(e) => handleChange("website", e.target.value)}
                  className="w-full px-4 py-3 bg-tertiary border border-[var(--border-primary)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-orange)]/50 transition-all"
                />
              </div>

              <div>
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">
                  Industry
                </label>
                <select
                  value={form.industry}
                  onChange={(e) => handleChange("industry", e.target.value)}
                  className="w-full px-4 py-3 bg-tertiary border border-[var(--border-primary)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-orange)]/50 transition-all"
                >
                  {INDUSTRIES.map((ind) => (
                    <option key={ind} value={ind.toLowerCase()}>{ind}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">
                  Business Stage
                </label>
                <select
                  value={form.business_stage}
                  onChange={(e) => handleChange("business_stage", e.target.value)}
                  className="w-full px-4 py-3 bg-tertiary border border-[var(--border-primary)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-orange)]/50 transition-all"
                >
                  {BUSINESS_STAGES.map((stage) => (
                    <option key={stage.value} value={stage.value}>{stage.label}</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 bg-tertiary border border-[var(--border-primary)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-orange)]/50 transition-all resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-4 pt-4 border-t border-[var(--border-primary)]">
              <button
                type="button"
                onClick={() => router.back()}
                className="px-6 py-3 rounded-xl border border-[var(--border-primary)] text-[10px] font-black uppercase tracking-widest hover:bg-tertiary transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn btn-primary gap-2 px-8 py-3"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

"use client";

import { useState, useEffect } from "react";
import { Building2, Mail, Plus, Briefcase, UserCheck, Layers, Tag } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import AppInput from "@/components/ui/AppInput";
import AppSelect from "@/components/ui/AppSelect";
import AppButton from "@/components/ui/AppButton";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const STAGE_OPTIONS = [
  { value: "idea", label: "Idea" },
  { value: "prototype", label: "Prototype / MVP" },
  { value: "validation", label: "Validation" },
  { value: "early_traction", label: "Early Traction" },
  { value: "growth", label: "Growth / Scaling" },
];

const STAFF_ROLES = new Set([
  "super_admin", "staff", "program_manager",
  "facilitator", "finance", "crm", "team",
]);

/**
 * The "Add a Venture" form — record the venture, assign a program & lead handler,
 * and invite its founder.
 */
export default function AddVentureForm({
  onCancel = null,
  onCreated = null,
  cancelLabelKey = "vadmin.list.addVentureCancel",
  autoFocus = true,
  showSubtitle = true,
}) {
  const { t } = useI18n();
  const [form, setForm] = useState({
    company_name: "",
    founder_email: "",
    industry: "",
    business_stage: "idea",
    program_id: "",
    handler_id: "",
  });

  const [programs, setPrograms] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    const fetchOptions = async () => {
      setLoadingOptions(true);
      try {
        // 1. Fetch active programs
        const pRes = await fetch("/api/programs");
        const pData = await pRes.json().catch(() => ({}));
        if (mounted && pData?.success && Array.isArray(pData.programs)) {
          setPrograms(
            pData.programs.map((p) => ({
              value: p.id,
              label: p.name || p.title || "Untitled Program",
            }))
          );
        }

        // 2. Fetch staff contacts for Handler dropdown
        const cRes = await fetch("/api/contacts/search?q=a");
        const cData = await cRes.json().catch(() => ({}));
        if (mounted && cData?.success && Array.isArray(cData.contacts)) {
          const eligibleStaff = cData.contacts.filter((c) => STAFF_ROLES.has(c.role));
          setStaffList(
            eligibleStaff.map((s) => ({
              value: s.cid,
              label: `${s.name || s.email} (${s.role || "staff"})`,
            }))
          );
        }
      } catch (err) {
        console.warn("Could not load creation dropdown options:", err);
      } finally {
        if (mounted) setLoadingOptions(false);
      }
    };
    fetchOptions();
    return () => {
      mounted = false;
    };
  }, []);

  const notify = (type, message) => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent("impactos:notify", { detail: { type, message, duration: 5000 } })
    );
  };

  const change = (field) => (event) => {
    const value = event.target.value;
    setForm((previous) => ({ ...previous, [field]: value }));
    setError("");
  };

  const submit = async (event) => {
    event.preventDefault();
    const companyName = form.company_name.trim();
    const founderEmail = form.founder_email.trim();

    if (companyName.length < 2) {
      setError(t("vadmin.list.addVentureNameRequired"));
      return;
    }
    if (!founderEmail) {
      setError(t("vadmin.list.addVentureEmailRequired"));
      return;
    }
    if (!EMAIL_RE.test(founderEmail)) {
      setError(t("vadmin.list.addVentureEmailInvalid"));
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/admin/ventures/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: companyName,
          founder_email: founderEmail,
          industry: form.industry.trim() || null,
          business_stage: form.business_stage || "idea",
          program_id: form.program_id || null,
          handler_id: form.handler_id || null,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        setError(t(payload.error || "vadmin.list.addVentureFailed"));
        return;
      }

      notify(
        payload.email_sent === false ? "error" : "success",
        t(
          payload.email_sent === false
            ? "vadmin.list.addVentureEmailFailed"
            : "vadmin.list.addVentureSuccess"
        )
      );

      setForm({
        company_name: "",
        founder_email: "",
        industry: "",
        business_stage: "idea",
        program_id: "",
        handler_id: "",
      });
      if (onCreated) onCreated(payload);
    } catch {
      setError(t("vadmin.list.addVentureFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {showSubtitle && (
        <p className="text-xs leading-relaxed -mt-1" style={{ color: "var(--text-secondary)" }}>
          {t("vadmin.list.addVentureSubtitle")}
        </p>
      )}

      {/* Row 1: Company Essentials */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <AppInput
          autoFocus={autoFocus}
          icon={Building2}
          label={t("vadmin.list.ventureNameLabel")}
          placeholder={t("vadmin.list.ventureNamePlaceholder")}
          value={form.company_name}
          onChange={change("company_name")}
        />
        <AppInput
          icon={Mail}
          type="email"
          label={t("vadmin.list.founderEmailLabel")}
          placeholder={t("vadmin.list.founderEmailPlaceholder")}
          value={form.founder_email}
          onChange={change("founder_email")}
        />
      </div>

      {/* Row 2: Industry & Stage */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <AppInput
          icon={Tag}
          label={t("venture.industry")}
          placeholder="e.g. CleanTech, EdTech, FinTech"
          value={form.industry}
          onChange={change("industry")}
        />
        <AppSelect
          icon={Layers}
          label={t("venture.businessStage")}
          value={form.business_stage}
          onChange={change("business_stage")}
          options={STAGE_OPTIONS}
        />
      </div>

      {/* Row 3: Program & Lead Handler Assignment */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <AppSelect
          icon={Briefcase}
          label="Cohort / Program"
          placeholder={loadingOptions ? "Loading programs..." : "Select program (optional)..."}
          value={form.program_id}
          onChange={change("program_id")}
          options={programs}
        />
        <AppSelect
          icon={UserCheck}
          label="Lead Handler (Staff)"
          placeholder={loadingOptions ? "Loading staff..." : "Assign Handler (optional)..."}
          value={form.handler_id}
          onChange={change("handler_id")}
          options={staffList}
        />
      </div>

      {error && <p className="text-xs font-bold text-rose-500">{error}</p>}

      <div className="flex justify-end gap-3 pt-2">
        {onCancel && (
          <AppButton type="button" variant="ghost" disabled={submitting} onClick={onCancel}>
            {t(cancelLabelKey)}
          </AppButton>
        )}
        <AppButton type="submit" variant="primary" icon={Plus} loading={submitting}>
          {t("vadmin.list.addVentureSubmit")}
        </AppButton>
      </div>
    </form>
  );
}

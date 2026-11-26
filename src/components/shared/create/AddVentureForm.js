"use client";

import { useState, useEffect } from "react";
import { Building2, Mail, Plus, UserCheck, Tag } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import AppInput from "@/components/ui/AppInput";
import AppSelect from "@/components/ui/AppSelect";
import AppButton from "@/components/ui/AppButton";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const STAFF_ROLES = new Set([
  "super_admin", "staff", "program_manager",
  "facilitator", "finance", "crm", "team",
]);

/**
 * The "Add a Venture" form — record the venture, assign a lead handler and
 * invite its founder.
 *
 * The Program/Cohort and the business stage are NOT asked for here: a Venture
 * joins a program through its own intake/assignment flow, and its stage is a
 * reporting decision owned by the stage engine, not a value typed at creation.
 * The creation endpoint never read either field.
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
    handler_id: "",
  });

  const [staffList, setStaffList] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    const fetchOptions = async () => {
      setLoadingOptions(true);
      try {
        // Fetch staff contacts for the Handler dropdown.
        //
        // This used to call `/api/contacts/search?q=a`. That endpoint refuses
        // any query shorter than 2 characters and answers `contacts: []`, so the
        // list was ALWAYS empty and the select showed only its disabled
        // placeholder — a dropdown with nothing to click. The registry endpoint
        // takes the roles directly (it splits on commas), which is one request
        // and exactly the set this dropdown offers.
        const roles = encodeURIComponent([...STAFF_ROLES].join(","));
        const cRes = await fetch(`/api/contacts?role=${roles}`);
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

      {/* Row 2: Industry & Lead Handler */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <AppInput
          icon={Tag}
          label={t("venture.industry")}
          placeholder="e.g. CleanTech, EdTech, FinTech"
          value={form.industry}
          onChange={change("industry")}
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

"use client";

import { useState } from "react";
import { Building2, Mail, Plus } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import AppInput from "@/components/ui/AppInput";
import AppButton from "@/components/ui/AppButton";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * The "Add a Venture" form — record the venture and invite its founder.
 *
 * Extracted so the Super Admin modal and the delegated `/create/venture` page
 * are the SAME feature: one validation, one request, one wording. The server
 * (`POST /api/admin/ventures/create`) remains the authority on both
 * `ventures.create` and the input rules; this component only mirrors them for
 * a helpful message.
 *
 * `onCreated` runs after a successful creation so the host can refresh its list
 * (the admin modal) or keep the person on the page (the creation surface).
 */
export default function AddVentureForm({
  onCancel = null,
  onCreated = null,
  cancelLabelKey = "vadmin.list.addVentureCancel",
  autoFocus = true,
  showSubtitle = true,
}) {
  const { t } = useI18n();
  const [form, setForm] = useState({ company_name: "", founder_email: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const notify = (type, message) => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent("impactos:notify", { detail: { type, message, duration: 5000 } }),
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
        body: JSON.stringify({ company_name: companyName, founder_email: founderEmail }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        setError(t(payload.error || "vadmin.list.addVentureFailed"));
        return;
      }
      // The venture is created either way; a transport failure only means the
      // invitation email did not leave, which the person must be told explicitly.
      notify(
        payload.email_sent === false ? "error" : "success",
        t(
          payload.email_sent === false
            ? "vadmin.list.addVentureEmailFailed"
            : "vadmin.list.addVentureSuccess",
        ),
      );
      setForm({ company_name: "", founder_email: "" });
      if (onCreated) onCreated(payload);
    } catch {
      setError(t("vadmin.list.addVentureFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      {showSubtitle && (
        <p className="text-xs leading-relaxed -mt-2" style={{ color: "var(--text-secondary)" }}>
          {t("vadmin.list.addVentureSubtitle")}
        </p>
      )}
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
      {error && <p className="text-xs font-bold text-rose-500">{error}</p>}
      <div className="flex justify-end gap-3 pt-1">
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

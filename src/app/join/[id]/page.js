"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, Send, CheckCircle2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function JoinGroupPage() {
  const { t } = useI18n();
  const params = useParams();
  const router = useRouter();
  const id = params?.id;

  const [group, setGroup] = useState(null);
  const [form, setForm] = useState(null);
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({});

  useEffect(() => {
    if (!id) return;
    async function load() {
      try {
        const res = await fetch(`/api/families?registration_id=${id}`);
        const data = await res.json();
        if (!data.success || !data.families?.length) {
          setError(t("rootMisc.join.groupNotFound"));
          setLoading(false);
          return;
        }
        const g = data.families[0];
        setGroup(g);

        if (g.form_id) {
          const formRes = await fetch(`/api/platform/forms?id=${g.form_id}`);
          const formData = await formRes.json();
          if (formData.success && formData.form) {
            setForm(formData.form);
            setFields(formData.fields || []);
          }
        }
      } catch (e) {
        setError(t("rootMisc.join.failedToLoad"));
      }
      setLoading(false);
    }
    load();
  }, [id]);

  function updateField(fieldId, value) {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      // Extract name and email for CRM
      const nameField = fields.find(f => f.field_type === "text" || f.label?.toLowerCase().includes("name"));
      const emailField = fields.find(f => f.field_type === "email" || f.label?.toLowerCase().includes("email"));
      const name = nameField ? formData[nameField.id] || "" : "";
      const email = emailField ? (formData[emailField.id] || "").toLowerCase().trim() : "";

      // Create CRM contact
      if (email) {
        await fetch("/api/contacts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, group_name: group.name, role: "applicant" }),
        });
      }

      // Submit to platform if form exists
      if (form) {
        await fetch("/api/platform/form-runs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "submit",
            run_id: null,
            form_id: form.id,
            data: formData,
            status: "submitted",
          }),
        });
      }

      setSubmitted(true);
    } catch (e) {
      setError(t("rootMisc.join.submissionFailed"));
    }
    setSubmitting(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--brand-orange)]" />
      </div>
    );
  }

  if (error && !group) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <h1 className="text-xl font-black uppercase mb-3">{t("rootMisc.join.groupNotFoundTitle")}</h1>
          <p className="text-sm text-[var(--text-secondary)]">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center p-6">
        <div className="text-center max-w-md space-y-4">
          <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500" />
          <h1 className="text-xl font-black uppercase">{t("rootMisc.join.thankYou")}</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            {t("rootMisc.join.yourInfoSubmitted")}{" "}<strong>{group?.name}</strong>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary">
      <div className="max-w-lg mx-auto p-6 pt-12">
        <div className="text-center mb-8">
          <h1 className="text-xl font-black uppercase tracking-tight">{group?.name}</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-2">
            {form ? t("rootMisc.join.fillDetailsToJoin") : t("rootMisc.join.registrationFormForGroup")}
          </p>
        </div>

        {error && (
          <div className="mb-6 px-4 py-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-sm text-rose-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {fields.length > 0 ? (
            fields.map(field => (
              <div key={field.id} className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)]">
                  {field.label} {field.required && <span className="text-rose-400">*</span>}
                </label>
                {field.field_type === "textarea" ? (
                  <textarea
                    required={field.required}
                    value={formData[field.id] || ""}
                    onChange={e => updateField(field.id, e.target.value)}
                    rows={3}
                    className="w-full bg-tertiary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm outline-none focus:border-[var(--brand-orange)]"
                    placeholder={field.placeholder || ""}
                  />
                ) : (
                  <input
                    type={field.field_type === "email" ? "email" : field.field_type === "phone" ? "tel" : field.field_type === "number" ? "number" : "text"}
                    required={field.required}
                    value={formData[field.id] || ""}
                    onChange={e => updateField(field.id, e.target.value)}
                    className="w-full bg-tertiary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm outline-none focus:border-[var(--brand-orange)]"
                    placeholder={field.placeholder || ""}
                  />
                )}
              </div>
            ))
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)]">{t("rootMisc.join.fullName")} *</label>
                <input required type="text" onChange={e => updateField("name", e.target.value)}
                  className="w-full bg-tertiary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm outline-none focus:border-[var(--brand-orange)]" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)]">{t("rootMisc.join.emailAddress")} *</label>
                <input required type="email" onChange={e => updateField("email", e.target.value)}
                  className="w-full bg-tertiary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm outline-none focus:border-[var(--brand-orange)]" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)]">{t("rootMisc.join.phoneNumber")}</label>
                <input type="tel" onChange={e => updateField("phone", e.target.value)}
                  className="w-full bg-tertiary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm outline-none focus:border-[var(--brand-orange)]" />
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-[var(--brand-orange)] text-black font-black text-sm uppercase rounded-xl hover:brightness-110 disabled:opacity-50 transition-all"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {submitting ? t("rootMisc.join.submitting") : t("rootMisc.join.submit")}
          </button>
        </form>
      </div>
    </div>
  );
}

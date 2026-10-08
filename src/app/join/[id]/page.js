"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, Send, CheckCircle2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cacheGet, cacheSet } from "@/lib/hooks/useApi";

export default function JoinGroupPage() {
  const { t } = useI18n();
  const params = useParams();
  const _router = useRouter();
  const id = params?.id;

  const [group, setGroup] = useState(null);
  const [form, setForm] = useState(null);
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({});
  const [runSlug, setRunSlug] = useState(null);

  useEffect(() => {
    if (!id) return;
    async function load(bypassCache = false) {
      const groupUrl = `/api/families?registration_id=${id}`;
      const applyGroup = (data) => {
        if (!data.success || !data.families?.length) {
          setError(t("rootMisc.join.groupNotFound"));
          return null;
        }
        const matchedGroup = data.families[0];
        setGroup(matchedGroup);
        return matchedGroup;
      };
      const applyForm = (formData) => {
        if (formData.success && formData.form) {
          setForm(formData.form);
          setFields(formData.fields || []);
        }
      };

      let painted = false;
      try {
        // Cache-first paint: returning visitors see the group + form instantly
        // from fresh snapshots while the network refresh below converges.
        if (!bypassCache) {
          const cached = cacheGet(groupUrl);
          if (cached !== null && cached.success && cached.families?.length) {
            const matchedGroup = cached.families[0];
            const formUrl = matchedGroup.form_id ? `/api/platform/forms?id=${matchedGroup.form_id}` : null;
            const formCached = formUrl ? cacheGet(formUrl) : null;
            const formReady =
              !formUrl ||
              (formCached !== null && formCached.success && formCached.form);
            if (formReady) {
              if (formCached) applyForm(formCached);
              applyGroup(cached);
              painted = true;
              setLoading(false);
            }
          }
        }

        const res = await fetch(groupUrl);
        const data = await res.json();
        if (data.success) cacheSet(groupUrl, data);
        const matchedGroup = applyGroup(data);
        if (!matchedGroup) return;

        if (matchedGroup.form_id) {
          const formUrl = `/api/platform/forms?id=${matchedGroup.form_id}`;
          const formRes = await fetch(formUrl);
          const formData = await formRes.json();
          if (formData.success) cacheSet(formUrl, formData);
          applyForm(formData);
        }

        // The Execution (run) the group is assigned to is where a join
        // submission is recorded. It is resolved the same way the "Copy Join
        // Link" action does; a group with no assigned Execution has no run to
        // submit to, and the CRM contact created on submit is then the record.
        try {
          const runsUrl = `/api/platform/form-runs?group_id=${encodeURIComponent(matchedGroup.registration_id || matchedGroup.id)}`;
          const runsRes = await fetch(runsUrl);
          const runsData = await runsRes.json();
          setRunSlug(runsData.success && runsData.runs?.length ? runsData.runs[0].public_slug || null : null);
        } catch (_) {}
      } catch {
        if (!painted) setError(t("rootMisc.join.failedToLoad"));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, t]);

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

      // Submit to the group's Execution through the PUBLIC endpoint — the same
      // one the shared /s/<slug> link uses. The authed /api/platform/form-runs
      // route expects a session and a run id, neither of which a public join
      // visitor has, which is why this call never reached the platform before.
      if (runSlug) {
        await fetch("/api/s/public-submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug: runSlug, data: formData }),
        });
      }

      setSubmitted(true);
    } catch {
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

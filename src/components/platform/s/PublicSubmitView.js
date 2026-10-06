import { Clock, Send } from "lucide-react";
import BrandingLogo from "@/components/public/run-submit/BrandingLogo";
import LanguageSelector from "@/components/public/run-submit/LanguageSelector";
import SectionsStepper from "@/components/public/run-submit/SectionsStepper";
import ConsentCard from "@/components/public/run-submit/ConsentCard";
import ContactFooter from "@/components/public/run-submit/ContactFooter";

/**
 * The public run's form layout. The screen owns the state, the reads and the
 * handlers; this only renders them, and it keeps the sections that actually
 * carry fields as the only steps.
 */
export default function PublicSubmitView({
  t,
  form,
  run,
  notification,
  lang,
  translating,
  switchLang,
  sections,
  fields,
  currentSection,
  formData,
  errors,
  success,
  saving,
  updateField,
  setSectionChoice,
  raw,
  handleSubmit,
  paidRun,
  checkout,
  consent,
  setConsent,
}) {
  // The sections that actually carry fields: an empty section is never a step.
  const validSections = sections.filter((sec) =>
    fields.some((field) => String(field.section_id) === String(sec.id)),
  );

  return (
    <div className="min-h-screen bg-slate-950">
      {notification && <div className="fixed bottom-6 right-6 z-[500] px-5 py-3 rounded-xl bg-orange-500 text-white text-xs font-black uppercase">{notification}</div>}
      <div className="max-w-2xl mx-auto p-6 space-y-8">
        {/* Branding */}
        <BrandingLogo className="h-12 w-auto object-contain mb-0" />

        {/* Language Selector */}
        <LanguageSelector
          t={t}
          lang={lang}
          translating={translating}
          onLangChange={switchLang}
        />

        {/* Header */}
        <div>
          <h1 className="text-2xl font-black uppercase text-slate-100">{form?.name || run?.name}</h1>
          {form?.description && <p className="text-sm text-slate-400 mt-2">{form.description}</p>}
          {run?.closes_at && <p className="text-xs text-slate-400 mt-2 flex items-center gap-1"><Clock className="w-3 h-3" /> {t("forms.closes")} {new Date(run.closes_at).toLocaleDateString()}</p>}
        </div>

        {/* The run's own instructions — the same text the internal form shows. */}
        {run?.settings?.instructions && (
          <div className="p-4 rounded-2xl border border-orange-500/20 bg-orange-500/5">
            <p className="text-xs font-medium text-slate-200 whitespace-pre-wrap">{run.settings.instructions}</p>
          </div>
        )}

        {/* Sections — step-by-step navigation */}
        <SectionsStepper
          validSections={validSections}
          fields={fields}
          currentSection={currentSection}
          formData={formData}
          errors={errors}
          disabled={success}
          saving={saving}
          onFieldChange={updateField}
          onStep={(direction) =>
            setSectionChoice((prev) => {
              const from = prev ?? raw.draftSection;
              return direction < 0
                ? Math.max(0, from - 1)
                : Math.min(validSections.length - 1, from + 1);
            })
          }
          onSubmit={handleSubmit}
          t={t}
        />

        {/* A PAID Execution: the price, and the consent the capture requires */}
        {paidRun && run?.status === "active" && !success && (
          <ConsentCard
            t={t}
            checkout={checkout}
            consent={consent}
            onConsentChange={setConsent}
          />
        )}

        {/* Submit — only for forms with no sections (single-page layout) */}
        {!success && run?.status === "active" && validSections.length <= 1 && (
          <div className="pt-4">
            <button onClick={handleSubmit} disabled={saving} className="w-full px-6 py-4 rounded-xl bg-orange-500 text-white text-sm font-black uppercase hover:bg-orange-600 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
              <Send className="w-4 h-4" /> {saving ? t("forms.submitting") : t("forms.submit")}
            </button>
          </div>
        )}

        {/* Footer */}
        <ContactFooter className="text-center pt-4 border-t border-slate-800" />
      </div>
    </div>
  );
}

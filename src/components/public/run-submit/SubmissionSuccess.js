import { CheckCircle2 } from "lucide-react";
import { sanitizeRichText } from "@/lib/lms/richText";
import BrandingLogo from "@/components/public/run-submit/BrandingLogo";
import ContactFooter from "@/components/public/run-submit/ContactFooter";

/**
 * THE SENT SCREEN — the run's own confirmation, plus the message and the exit the
 * server decided on.
 *
 * Extracted from the public submit page. The message it renders is the one the
 * screen already resolved (placeholders filled, values escaped).
 */
export default function SubmissionSuccess({ t, successMessage, redirectUrl }) {
  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-2xl mx-auto p-6 space-y-8">
        {/* Branding */}
        <BrandingLogo className="h-12 w-auto object-contain mb-0" />

        <div className="text-center max-w-md mx-auto space-y-6">
          <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
          </div>

          <div className="space-y-3">
            <h1 className="text-2xl font-black text-white uppercase tracking-tight">
              {t("forms.submissionReceivedTitle")}
            </h1>
            <p className="text-slate-400 text-sm leading-relaxed max-w-sm mx-auto">
              {t("forms.thankYouDetail")}
            </p>
          </div>

          {successMessage ? (
            <div className="p-6 rounded-2xl bg-slate-800 border border-slate-700">
              <div
                className="text-slate-300 text-sm space-y-3 leading-relaxed"
                dangerouslySetInnerHTML={{
                  __html: sanitizeRichText(successMessage.replace(/\n/g, "<br/>")),
                }}
              />
            </div>
          ) : null}

          {redirectUrl && /^https?:\/\//i.test(redirectUrl) && (
            <a
              href={redirectUrl}
              className="inline-block px-8 py-3.5 bg-orange-500 text-black rounded-xl text-sm font-black uppercase tracking-wider hover:bg-orange-400 transition-colors"
            >
              {t("common.continue")}
            </a>
          )}

          <p className="text-[10px] text-slate-500 pt-4">{t("forms.checkEmail")}</p>
        </div>

        {/* Footer */}
        <ContactFooter />
      </div>
    </div>
  );
}
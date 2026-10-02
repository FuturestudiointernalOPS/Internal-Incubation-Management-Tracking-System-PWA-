import { CreditCard } from "lucide-react";

/**
 * THE PRICE AND THE CONSENT — what a PAID Execution costs, and the permission the
 * capture of personal data needs, asked before anything is sent.
 *
 * Extracted from the public submit page; the decision on whether the capture goes
 * through stays with the screen, which also enforces it.
 */
export default function ConsentCard({ t, checkout, consent, onConsentChange }) {
  return (
    <div className="p-6 rounded-2xl bg-slate-900 border border-orange-500/30 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <span className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-400">
          <CreditCard className="w-4 h-4" /> {t("forms.paymentAmount")}
        </span>
        <span className="text-lg font-black text-orange-400">
          {Number(checkout?.course?.amount || 0).toLocaleString()}{" "}
          {checkout?.course?.currency || ""}
        </span>
      </div>
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => onConsentChange(event.target.checked)}
          className="mt-0.5 w-4 h-4 shrink-0 accent-orange-500"
        />
        <span className="text-[11px] leading-relaxed text-slate-400">
          {checkout?.consent_text || t("forms.consentLabel")}
        </span>
      </label>
      {checkout?.misconfigured && (
        <p className="text-[11px] font-bold text-rose-400">{t("forms.paymentMisconfigured")}</p>
      )}
    </div>
  );
}
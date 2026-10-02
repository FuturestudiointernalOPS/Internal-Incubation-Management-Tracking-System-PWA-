import { Loader2, CheckCircle2, AlertTriangle, Clock, Lock, Mail, CreditCard } from "lucide-react";
import BrandingLogo from "@/components/public/run-submit/BrandingLogo";

/**
 * THE PAYMENT STEP OF A PAID EXECUTION — every state the wait can be in, drawn
 * from the one the screen is holding.
 *
 * Extracted from the public submit page. The screen owns what each stage means
 * and what the buttons do; this only renders it, and never offers a payment button
 * once the money may have settled.
 */
export default function PaymentStep({
  t,
  payStage,
  amountLabel,
  payAccessUrl,
  payment,
  resendEmail,
  resendNotice,
  onRetryPayment,
  onCheckAgain,
  onResendEmailChange,
  onResend,
}) {
  const panel = (icon, title, body, extra = null) => (
    <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-5">
      <div className="flex justify-center">{icon}</div>
      <h1 className="text-xl font-black text-white uppercase tracking-tight">{title}</h1>
      {body ? <p className="text-sm text-slate-400 leading-relaxed">{body}</p> : null}
      {extra}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-6">
        <BrandingLogo className="h-12 w-auto object-contain" />

        {payment.reference ? (
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-400">
              <CreditCard className="w-4 h-4" /> {t("forms.paymentAmount")}
            </span>
            <span className="text-lg font-black text-orange-400">{amountLabel}</span>
          </div>
        ) : null}

        {payStage === "opening" &&
          panel(<Loader2 className="w-9 h-9 animate-spin text-orange-500" />, t("forms.paymentOpening"))}

        {payStage === "confirming" &&
          panel(
            <Loader2 className="w-9 h-9 animate-spin text-orange-500" />,
            t("forms.paymentConfirming"),
            t("forms.paymentVerifyingHint"),
          )}

        {payStage === "verifying" &&
          panel(
            <Loader2 className="w-9 h-9 animate-spin text-orange-500" />,
            t("forms.paymentVerifying"),
            t("forms.paymentVerifyingHint"),
          )}

        {payStage === "success" &&
          panel(
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />,
            t("forms.paymentSuccess"),
            // With a link in hand, access is genuinely ready. Without one (the
            // short window has closed), the link travels by email — saying
            // "your access is ready" with no button would be a dead end.
            t(payAccessUrl ? "forms.paymentSuccessBody" : "forms.paymentSuccessByEmail"),
            <div className="space-y-3">
              {payAccessUrl ? (
                <a
                  href={payAccessUrl}
                  className="inline-block w-full px-8 py-3.5 rounded-xl bg-orange-500 text-black text-sm font-black uppercase tracking-wider hover:bg-orange-400 transition-colors"
                >
                  {payAccessUrl.startsWith("/setup-password")
                    ? t("forms.paymentChoosePassword")
                    : t("forms.paymentGoToCourse")}
                </a>
              ) : null}
              <p className="text-[11px] text-slate-500 leading-relaxed">{t("forms.paymentEmailNote")}</p>
            </div>,
          )}

        {payStage === "failed" &&
          panel(
            <AlertTriangle className="w-9 h-9 text-rose-500" />,
            t("forms.paymentFailed"),
            t("forms.paymentFailedBody"),
            <button
              onClick={onRetryPayment}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-800 text-slate-100 text-xs font-black uppercase tracking-wider hover:bg-slate-700 transition-colors"
            >
              <Lock className="w-4 h-4" /> {t("forms.paymentRetry")}
            </button>,
          )}

        {payStage === "pending" &&
          panel(
            <Clock className="w-9 h-9 text-slate-500" />,
            t("forms.paymentPending"),
            t("forms.paymentPendingBody"),
            <div className="space-y-3">
              <button
                onClick={onCheckAgain}
                className="px-6 py-3 rounded-xl bg-slate-800 text-slate-100 text-xs font-black uppercase tracking-wider hover:bg-slate-700 transition-colors"
              >
                {t("forms.paymentCheckAgain")}
              </button>
              {/* NEVER a payment button once the money may have settled. */}
              <p className="text-[11px] text-slate-500 leading-relaxed">{t("forms.paymentEmailNote")}</p>
            </div>,
          )}

        {(payStage === "unavailable" || payment.failed) &&
          panel(
            <AlertTriangle className="w-9 h-9 text-slate-500" />,
            t("forms.paymentUnavailable"),
            t("forms.paymentUnavailableBody"),
          )}

        {payStage === "existing" &&
          panel(
            <Lock className="w-9 h-9 text-slate-500" />,
            t("forms.existingTitle"),
            t("forms.existingBody"),
            <div className="space-y-3">
              <a
                href="/login"
                className="inline-block w-full px-6 py-3 rounded-xl bg-slate-800 text-slate-100 text-xs font-black uppercase tracking-wider hover:bg-slate-700 transition-colors"
              >
                {t("forms.existingSignIn")}
              </a>
              <input
                type="email"
                value={resendEmail}
                onChange={(event) => onResendEmailChange(event.target.value)}
                placeholder={t("forms.existingEmailPlaceholder")}
                className="w-full rounded-xl px-4 py-3 text-sm outline-none bg-slate-800 border border-slate-600 text-slate-100"
              />
              <button
                onClick={onResend}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-orange-500 text-black text-xs font-black uppercase tracking-wider hover:bg-orange-400 transition-colors"
              >
                <Mail className="w-4 h-4" /> {t("forms.existingResend")}
              </button>
              {resendNotice ? (
                <p className="text-[11px] text-slate-400 leading-relaxed">{resendNotice}</p>
              ) : null}
            </div>,
          )}
      </div>
    </div>
  );
}
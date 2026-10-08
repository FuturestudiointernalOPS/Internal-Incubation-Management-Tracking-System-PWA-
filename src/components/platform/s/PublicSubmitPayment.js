import PaymentStep from "@/components/public/run-submit/PaymentStep";

/**
 * The payment step of a PAID Execution. The screen owns the polling, the stage
 * and the handlers; this only derives the amount label and renders the step.
 */
export default function PublicSubmitPayment({
  t,
  payment,
  checkout,
  payStage,
  payAccessUrl,
  payEmail,
  resendEmail,
  resendNotice,
  retryPayment,
  pollPayment,
  setResendEmail,
  handleResend,
}) {
  const displayAmount = payment.display_amount ?? checkout?.course?.amount ?? 0;
  const amountLabel = `${Number(displayAmount).toLocaleString()} ${
    payment.currency || checkout?.course?.currency || ""
  }`.trim();

  return (
    <PaymentStep
      t={t}
      payStage={payStage}
      amountLabel={amountLabel}
      payAccessUrl={payAccessUrl}
      payment={payment}
      resendEmail={resendEmail}
      resendNotice={resendNotice}
      onRetryPayment={retryPayment}
      onCheckAgain={() =>
        payment.reference && payEmail && pollPayment(payment.reference, payEmail)
      }
      onResendEmailChange={setResendEmail}
      onResend={handleResend}
    />
  );
}

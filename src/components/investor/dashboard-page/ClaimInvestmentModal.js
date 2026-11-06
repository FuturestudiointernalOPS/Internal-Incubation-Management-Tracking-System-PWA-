"use client";

import { useState } from "react";
import AppModal from "@/components/ui/AppModal";
import AppButton from "@/components/ui/AppButton";
import AppInput from "@/components/ui/AppInput";
import AppSelect from "@/components/ui/AppSelect";
import { useI18n } from "@/lib/i18n";

const CURRENCIES = ["XOF", "USD", "EUR", "GBP"];
const INSTRUMENTS = ["equity", "convertible", "safe", "debt", "other"];

/**
 * Phase 5 — "I have invested" form. Submits a pending claim; studio must confirm.
 */
export default function ClaimInvestmentModal({
  isOpen,
  venture,
  busy = false,
  onClose,
  onSubmit,
}) {
  const { t } = useI18n();
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("XOF");
  const [instrument, setInstrument] = useState("equity");
  const [investedOn, setInvestedOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState(null);

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    const numeric = Number(amount);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      setError(t("dashboardV2.investment.amountRequired"));
      return;
    }
    if (!currency) {
      setError(t("dashboardV2.investment.currencyRequired"));
      return;
    }
    await onSubmit({
      venture_id: venture.venture_id || venture.id,
      amount: numeric,
      currency,
      instrument,
      invested_on: investedOn || null,
    });
  };

  return (
    <AppModal
      isOpen={isOpen && Boolean(venture)}
      onClose={busy ? undefined : onClose}
      title={t("dashboardV2.investment.claimTitle")}
      size="md"
    >
      {venture ? (
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">
            {t("dashboardV2.investment.claimHint", {
              name: venture.venture_name || venture.name || venture.venture_id,
            })}
          </p>

          <AppInput
            label={t("dashboardV2.investment.amount")}
            type="number"
            min="0"
            step="any"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
            disabled={busy}
          />

          <AppSelect
            label={t("dashboardV2.investment.currency")}
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
            options={CURRENCIES}
            disabled={busy}
          />

          <AppSelect
            label={t("dashboardV2.investment.instrument")}
            value={instrument}
            onChange={(event) => setInstrument(event.target.value)}
            options={INSTRUMENTS.map((code) => ({
              value: code,
              label: t(`dashboardV2.investment.instruments.${code}`),
            }))}
            disabled={busy}
          />

          <AppInput
            label={t("dashboardV2.investment.date")}
            type="date"
            value={investedOn}
            onChange={(event) => setInvestedOn(event.target.value)}
            disabled={busy}
          />

          {error && (
            <p className="text-sm text-[var(--status-danger)]" role="alert">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <AppButton type="button" variant="ghost" onClick={onClose} disabled={busy}>
              {t("common.cancel")}
            </AppButton>
            <AppButton type="submit" loading={busy}>
              {t("dashboardV2.investment.submitClaim")}
            </AppButton>
          </div>
        </form>
      ) : null}
    </AppModal>
  );
}

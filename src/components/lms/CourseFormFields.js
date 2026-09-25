"use client";

import AppInput from "@/components/ui/AppInput";
import AppSelect from "@/components/ui/AppSelect";
import RichTextEditor from "@/components/ui/RichTextEditor";
import CourseImageUpload from "./CourseImageUpload";
import { useI18n } from "@/lib/i18n";

/**
 * Shared course metadata form (create + editor details).
 * Controlled: value = { title, description, thumbnail_url, visibility, is_free,
 * price, payment_currency, payment_amount_unit, payment_consent_text }.
 * The payment settings only matter for a paid course, and leaving them empty
 * uses the platform defaults.
 */
export default function CourseFormFields({ value, onChange, errors = {} }) {
  const { t } = useI18n();
  const isFree = value.is_free !== false;

  const set = (field) => (event) => onChange({ ...value, [field]: event.target.value });
  const setFree = (event) =>
    onChange({ ...value, is_free: event.target.value === "free", price: event.target.value === "free" ? null : value.price });

  return (
    <div className="space-y-5">
      <AppInput
        label={t("lms.fields.title")}
        value={value.title || ""}
        onChange={set("title")}
        placeholder={t("lms.fields.titlePlaceholder")}
        error={errors.title ? t(errors.title) : undefined}
      />

      <div className="space-y-2">
        <label
          className="text-[10px] font-bold uppercase tracking-wider ml-1"
          style={{ color: "var(--text-secondary)" }}
        >
          {t("lms.fields.description")}
        </label>
        <RichTextEditor
          value={value.description || ""}
          onChange={(html) => onChange({ ...value, description: html })}
          placeholder={t("lms.fields.descriptionPlaceholder")}
          minHeight={120}
        />
      </div>

      <CourseImageUpload
        value={value.thumbnail_url || ""}
        onChange={(url) => onChange({ ...value, thumbnail_url: url })}
      />

      <AppSelect
        label={t("lms.fields.visibility")}
        value={value.visibility || "public"}
        onChange={set("visibility")}
        options={[
          { value: "public", label: t("lms.fields.visibilityPublic") },
          { value: "private", label: t("lms.fields.visibilityPrivate") },
        ]}
      />
      <p
        className="text-[10px] font-medium -mt-3 ml-1"
        style={{ color: "var(--text-tertiary)" }}
      >
        {t("lms.fields.visibilityHint")}
      </p>

      <AppSelect
        label={t("lms.fields.pricing")}
        value={isFree ? "free" : "paid"}
        onChange={setFree}
        options={[
          { value: "free", label: t("lms.fields.free") },
          { value: "paid", label: t("lms.fields.paid") },
        ]}
      />

      {!isFree && (
        <>
          <AppInput
            label={t("lms.fields.price")}
            type="number"
            min="0"
            step="0.01"
            value={value.price ?? ""}
            onChange={set("price")}
            placeholder={t("lms.fields.pricePlaceholder")}
            error={errors.price ? t(errors.price) : undefined}
          />

          {/* Checkout settings. Leaving them empty uses the platform defaults. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <AppInput
              label={t("lms.fields.paymentCurrency")}
              value={value.payment_currency || ""}
              onChange={set("payment_currency")}
              placeholder={t("lms.fields.paymentCurrencyPlaceholder")}
            />
            <AppSelect
              label={t("lms.fields.paymentAmountUnit")}
              value={value.payment_amount_unit || ""}
              onChange={set("payment_amount_unit")}
              placeholder={t("lms.fields.paymentAmountUnitDefault")}
              options={[
                { value: "major", label: t("lms.fields.paymentAmountUnitMajor") },
                { value: "minor", label: t("lms.fields.paymentAmountUnitMinor") },
              ]}
            />
          </div>
          <p className="text-[10px] font-medium -mt-3 ml-1" style={{ color: "var(--text-tertiary)" }}>
            {t("lms.fields.paymentUnitHint")}
          </p>

          <div className="space-y-2">
            <label
              className="text-[10px] font-bold uppercase tracking-wider ml-1"
              style={{ color: "var(--text-secondary)" }}
            >
              {t("lms.fields.paymentConsent")}
            </label>
            <textarea
              rows={3}
              value={value.payment_consent_text || ""}
              onChange={set("payment_consent_text")}
              placeholder={t("lms.fields.paymentConsentPlaceholder")}
              className="w-full rounded-md py-3 px-4 text-sm font-medium outline-none transition-all border resize-none"
              style={{
                background: "var(--bg-primary)",
                borderColor: "var(--border-primary)",
                color: "var(--text-primary)",
              }}
            />
            <p className="text-[10px] font-medium ml-1" style={{ color: "var(--text-tertiary)" }}>
              {t("lms.fields.paymentConsentHint")}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

"use client";

import AppInput from "@/components/ui/AppInput";
import AppSelect from "@/components/ui/AppSelect";
import CourseImageUpload from "./CourseImageUpload";
import { useI18n } from "@/lib/i18n";

/**
 * Shared course metadata form (create + editor details).
 * Controlled: value = { title, description, thumbnail_url, visibility, is_free, price }.
 * Price is captured as metadata only — checkout/payment is out of scope.
 */
export default function CourseFormFields({ value, onChange, errors = {} }) {
  const { t } = useI18n();
  const isFree = value.is_free !== false;

  const set = (field) => (e) => onChange({ ...value, [field]: e.target.value });
  const setFree = (e) =>
    onChange({ ...value, is_free: e.target.value === "free", price: e.target.value === "free" ? null : value.price });

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
        <textarea
          value={value.description || ""}
          onChange={set("description")}
          placeholder={t("lms.fields.descriptionPlaceholder")}
          rows={3}
          className="w-full rounded-md py-3 px-4 text-sm font-medium outline-none transition-all border resize-y"
          style={{
            background: "var(--bg-primary)",
            borderColor: "var(--border-primary)",
            color: "var(--text-primary)",
          }}
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
      )}
    </div>
  );
}

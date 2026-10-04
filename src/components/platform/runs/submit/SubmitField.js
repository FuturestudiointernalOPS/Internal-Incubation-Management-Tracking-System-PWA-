"use client";

import { Star } from "lucide-react";
import AppPhoneInput from "@/components/ui/AppPhoneInput";
import { cn } from "@/components/admin/dashboard-page/constants";

export default function SubmitField({ field, value, hasError, isDisabled, updateField, t }) {
  const baseInputClass = "w-full rounded-xl px-4 py-3 text-sm font-bold outline-none bg-primary border text-[var(--text-primary)] transition-colors";
  const normalBorder = hasError ? "border-rose-500" : "border-[var(--border-primary)] focus:border-[var(--brand-orange)]";
  const inputClass = cn(baseInputClass, normalBorder, isDisabled && "opacity-60 cursor-not-allowed");

  switch (field.field_type) {
    case "textarea":
    case "richtext":
      return (
        <textarea
          value={value}
          onChange={(event) => updateField(field.id, event.target.value)}
          rows={4}
          placeholder={field.placeholder || ""}
          disabled={isDisabled}
          className={cn(inputClass, "resize-none")}
        />
      );

    case "number":
    case "currency":
      return (
        <input
          type="number"
          value={value}
          onChange={(event) => updateField(field.id, event.target.value)}
          placeholder={field.placeholder || ""}
          disabled={isDisabled}
          className={inputClass}
          min={field.validation?.min}
          max={field.validation?.max}
        />
      );

    case "email":
      return (
        <input
          type="email"
          value={value}
          onChange={(event) => updateField(field.id, event.target.value)}
          placeholder={field.placeholder || t("platformMisc.runSubmitDetail.emailExample")}
          disabled={isDisabled}
          className={inputClass}
        />
      );

    case "phone":
      return (
        <AppPhoneInput
          value={value}
          onChange={(nextValue) => updateField(field.id, nextValue)}
          placeholder={field.placeholder || t("platformMisc.runSubmitDetail.phoneExample")}
          disabled={isDisabled}
          inputClassName={inputClass + " flex-1"}
        />
      );

    case "date":
      return (
        <input
          type="date"
          value={value}
          onChange={(event) => updateField(field.id, event.target.value)}
          disabled={isDisabled}
          className={inputClass}
        />
      );

    case "time":
      return (
        <input
          type="time"
          value={value}
          onChange={(event) => updateField(field.id, event.target.value)}
          disabled={isDisabled}
          className={inputClass}
        />
      );

    case "url":
      return (
        <input
          type="url"
          value={value}
          onChange={(event) => updateField(field.id, event.target.value)}
          placeholder={field.placeholder || "https://"}
          disabled={isDisabled}
          className={inputClass}
        />
      );

    case "select": {
      const options = field.options || [];
      return (
        <select
          value={value}
          onChange={(event) => updateField(field.id, event.target.value)}
          disabled={isDisabled}
          className={inputClass}
        >
          <option value="">{field.placeholder || t("platformMisc.runSubmitDetail.select")}</option>
          {options.map((option, index) => (
            <option key={index} value={option.value || option}>{option.label || option}</option>
          ))}
        </select>
      );
    }

    case "radio": {
      const options = field.options || [];
      return (
        <div className="space-y-2">
          {options.map((option, index) => (
            <label key={index} className={cn("flex items-center gap-2 text-[11px] font-bold text-[var(--text-primary)]", isDisabled && "opacity-60")}>
              <input
                type="radio"
                name={`field-${field.id}`}
                value={option.value || option}
                checked={String(value) === String(option.value || option)}
                onChange={(event) => updateField(field.id, event.target.value)}
                disabled={isDisabled}
                className="accent-[var(--brand-orange)]"
              />
              {option.label || option}
            </label>
          ))}
        </div>
      );
    }

    case "checkbox": {
      const checked = value === true || value === "true" || value === "on";
      return (
        <label className={cn("flex items-center gap-2 text-[11px] font-bold text-[var(--text-primary)]", isDisabled && "opacity-60")}>
          <input
            type="checkbox"
            checked={checked}
            onChange={(event) => updateField(field.id, event.target.checked)}
            disabled={isDisabled}
            className="accent-[var(--brand-orange)]"
          />
          {field.label}
        </label>
      );
    }

    case "multiselect": {
      const options = field.options || [];
      const selected = Array.isArray(value) ? value : [];
      return (
        <div className="space-y-2">
          {options.map((option, index) => {
            const optionValue = option.value || option;
            const isChecked = selected.includes(optionValue);
            return (
              <label key={index} className={cn("flex items-center gap-2 text-[11px] font-bold text-[var(--text-primary)]", isDisabled && "opacity-60")}>
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(event) => {
                    const nextValue = event.target.checked
                      ? [...selected, optionValue]
                      : selected.filter((selectedValue) => selectedValue !== optionValue);
                    updateField(field.id, nextValue);
                  }}
                  disabled={isDisabled}
                  className="accent-[var(--brand-orange)]"
                />
                {option.label || option}
              </label>
            );
          })}
        </div>
      );
    }

    case "rating": {
      const max = field.validation?.max || 5;
      const current = parseInt(value) || 0;
      return (
        <div className={cn("flex items-center gap-1", isDisabled && "opacity-60")}>
          {Array.from({ length: max }, (_, starIndex) => (
            <button
              key={starIndex}
              type="button"
              onClick={() => !isDisabled && updateField(field.id, String(starIndex + 1))}
              className={cn("transition-colors", starIndex < current ? "text-[var(--brand-orange)]" : "text-[var(--text-secondary)]")}
            >
              <Star className={cn("w-5 h-5", starIndex < current ? "fill-current" : "")} />
            </button>
          ))}
        </div>
      );
    }

    case "file":
      return (
        <div className={cn("p-3 rounded-xl border border-dashed border-[var(--border-primary)] text-center", isDisabled && "opacity-60")}>
          <input
            type="file"
            onChange={(event) => updateField(field.id, event.target.files?.[0]?.name || "")}
            disabled={isDisabled}
            className="text-[10px] text-[var(--text-secondary)]"
          />
          {value && <p className="text-[10px] font-bold text-[var(--text-primary)] mt-1">{typeof value === "string" ? value : t("platformMisc.runSubmitDetail.fileSelected")}</p>}
        </div>
      );

    case "hidden":
      return <input type="hidden" value={value} />;

    default: // text
      return (
        <input
          type="text"
          value={value}
          onChange={(event) => updateField(field.id, event.target.value)}
          placeholder={field.placeholder || ""}
          disabled={isDisabled}
          className={inputClass}
        />
      );
  }
}

import AppPhoneInput from "@/components/ui/AppPhoneInput";

/**
 * FIELD CONTROL — the input for one field, chosen by its type.
 *
 * Extracted from the public submit page. The control is handed the value, the
 * error and the disabled flag; raising the change stays with the screen, which is
 * where the draft and its auto-save live.
 */
export default function FieldControl({ field, value, hasError, isDisabled, onChange, t }) {
  const baseClass =
    "w-full rounded-xl px-4 py-3 text-sm font-medium outline-none bg-slate-800 border text-slate-100 placeholder:text-slate-400";
  const errClass = hasError ? "border-red-500" : "border-slate-600 focus:border-orange-500";
  const inputClass = `${baseClass} ${errClass}`;

  switch (field.field_type) {
    case "textarea":
      return (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder || ""}
          disabled={isDisabled}
          rows={3}
          className={`${inputClass} resize-none`}
        />
      );
    case "email":
      return (
        <input
          type="email"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder || "email@example.com"}
          disabled={isDisabled}
          className={inputClass}
        />
      );
    case "phone":
      return (
        <AppPhoneInput
          value={value}
          onChange={onChange}
          placeholder={field.placeholder || "90 84 78 20"}
          disabled={isDisabled}
          inputClassName="flex-1 rounded-xl px-4 py-3 text-sm font-medium outline-none border bg-slate-800 text-slate-100 placeholder:text-slate-400 border-slate-600 focus:border-orange-500"
        />
      );
    case "select":
    case "radio":
      return (
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={isDisabled}
          className={`${inputClass} [&>option]:bg-slate-800 [&>option]:text-slate-100 appearance-none`}
        >
          <option value="">{t("forms.selectOption")}</option>
          {(field.options || []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    case "multiselect": {
      const selected = Array.isArray(value) ? value : [];
      return (
        <div className="space-y-2">
          {(field.options || []).map((option, index) => {
            const optionValue = option.value || option;
            const isChecked = selected.includes(optionValue);
            return (
              <label
                key={index}
                className={`flex items-center gap-2 text-sm text-slate-100 ${isDisabled ? "opacity-60" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(event) => {
                    const nextValue = event.target.checked
                      ? [...selected, optionValue]
                      : selected.filter((selectedValue) => selectedValue !== optionValue);
                    onChange(nextValue);
                  }}
                  disabled={isDisabled}
                  className="w-4 h-4 accent-orange-500"
                />
                {option.label || option}
              </label>
            );
          })}
        </div>
      );
    }
    case "rating": {
      const opts =
        Array.isArray(field.options) && field.options.length > 0
          ? field.options
          : [
              { label: "1", value: "1" },
              { label: "2", value: "2" },
              { label: "3", value: "3" },
              { label: "4", value: "4" },
              { label: "5", value: "5" },
            ];
      return (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">{t("forms.selectRating")}</p>
          <div className="flex gap-3 flex-wrap">
            {opts.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onChange(option.value)}
                disabled={isDisabled}
                className={`min-w-[56px] px-4 py-3 rounded-xl text-base font-bold border-2 transition-all ${
                  value === option.value
                    ? "bg-orange-500 text-white border-orange-500 scale-110 shadow-lg shadow-orange-500/30"
                    : "bg-slate-700 text-slate-200 border-slate-500 hover:border-orange-400 hover:text-orange-400 hover:bg-slate-600"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      );
    }
    case "number":
    case "currency":
      return (
        <input
          type="number"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder || "0"}
          disabled={isDisabled}
          className={inputClass}
        />
      );
    case "date":
      return (
        <input
          type="date"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={isDisabled}
          className={inputClass}
        />
      );
    case "url":
      return (
        <input
          type="url"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder || "https://"}
          disabled={isDisabled}
          className={inputClass}
        />
      );
    default:
      return (
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder || ""}
          disabled={isDisabled}
          className={inputClass}
        />
      );
  }
}
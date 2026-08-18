"use client";

import { useMemo } from "react";
import { parsePhoneNumber, getCountryCallingCode } from "libphonenumber-js";
import { getCountryOptions } from "@/lib/countries";

/**
 * Standard phone input: country dial-code selector + national number.
 *
 * `value` and `onChange` use E.164 strings, e.g. "+2349012345678".
 */
export default function AppPhoneInput({
  value = "",
  onChange,
  defaultCountry = "BJ",
  disabled = false,
  placeholder = "",
  className = "",
  selectClassName = "",
  inputClassName = "",
}) {
  const countries = useMemo(() => getCountryOptions(), []);

  let country = defaultCountry;
  let national = "";

  if (value) {
    const parsed = parsePhoneNumber(String(value));
    if (parsed) {
      country = parsed.country || defaultCountry;
      national = parsed.nationalNumber || "";
    } else {
      // Legacy plain value without a valid country context.
      national = String(value).replace(/[^\d]/g, "");
    }
  }

  const emit = (iso, nationalDigits) => {
    const digits = String(nationalDigits || "").replace(/\D/g, "");
    if (!digits) {
      onChange?.("");
      return;
    }
    let dial = "";
    try {
      dial = `+${getCountryCallingCode(iso)}`;
    } catch (_) {}

    const candidate = `${dial}${digits}`;
    const parsed = parsePhoneNumber(candidate, iso);
    onChange?.(parsed ? parsed.number : candidate);
  };

  return (
    <div className={`flex gap-2 ${className}`}>
      <select
        value={country}
        onChange={(e) => emit(e.target.value, national)}
        disabled={disabled}
        className={selectClassName || "shrink-0 w-[150px] rounded-xl px-2 py-3 text-sm font-medium outline-none border cursor-pointer"}
        style={{
          background: "var(--bg-primary)",
          borderColor: "var(--border-primary)",
          color: "var(--text-primary)",
        }}
      >
        {countries.map((c) => (
          <option key={c.iso} value={c.iso}>
            {c.flag} {c.iso} {c.dial}
          </option>
        ))}
      </select>

      <input
        type="tel"
        value={national}
        onChange={(e) => emit(country, e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={inputClassName || "flex-1 min-w-0 rounded-xl px-4 py-3 text-sm font-medium outline-none border"}
        style={{
          background: "var(--bg-primary)",
          borderColor: "var(--border-primary)",
          color: "var(--text-primary)",
        }}
      />
    </div>
  );
}

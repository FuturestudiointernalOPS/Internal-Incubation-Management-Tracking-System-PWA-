"use client";

import { useMemo } from "react";
import { parsePhoneNumber } from "libphonenumber-js";
import { getCountryOptions, getCountryDial } from "@/lib/countries";

/**
 * Standard phone input: country dial-code selector + national number.
 *
 * `value` and `onChange` use E.164 strings, e.g. "+2349012345678".
 *
 * Important: partial/incomplete values (e.g. while the user is typing) are not
 * yet valid E.164, so `parsePhoneNumber` returns undefined for them. We must not
 * fall back to "all digits" in that case, because the E.164 digits include the
 * country dial code and would corrupt the national field.
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

  function resolvePhone(rawValue) {
    if (!rawValue) return { country: defaultCountry, national: "" };
    const raw = String(rawValue).trim();

    const parsed = parsePhoneNumber(raw);
    if (parsed) {
      return {
        country: parsed.country || defaultCountry,
        national: parsed.nationalNumber || "",
      };
    }

    const digits = raw.replace(/\D/g, "");
    if (!digits) return { country: defaultCountry, national: "" };

    // E.164-ish partial value: strip the dial prefix by matching the country list.
    if (raw.startsWith("+")) {
      for (const c of countries) {
        const dialDigits = c.dial.replace(/\D/g, "");
        if (dialDigits && digits.startsWith(dialDigits)) {
          return { country: c.iso, national: digits.slice(dialDigits.length) };
        }
      }
      // Unknown dial prefix — keep the default country and the raw digits.
      return { country: defaultCountry, national: digits };
    }

    // Legacy plain national number (no country context).
    return { country: defaultCountry, national: digits };
  }

  const { country, national } = resolvePhone(value);

  const emit = (iso, nationalDigits) => {
    let digits = String(nationalDigits || "").replace(/\D/g, "");
    const dial = getCountryDial(iso);
    const dialDigits = dial.replace(/\D/g, "");

    // Guard against double-prefixing the dial code into the number.
    if (dialDigits && digits.startsWith(dialDigits)) {
      digits = digits.slice(dialDigits.length);
    }

    if (!digits) {
      onChange?.("");
      return;
    }

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
        className={selectClassName || "shrink-0 w-[120px] sm:w-[150px] rounded-xl px-2 py-3 text-sm font-medium outline-none border cursor-pointer"}
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
        className={`min-w-0 cursor-text ${inputClassName || "flex-1 rounded-xl px-4 py-3 text-sm font-medium outline-none border"}`}
        style={{
          background: "var(--bg-primary)",
          borderColor: "var(--border-primary)",
          color: "var(--text-primary)",
        }}
      />
    </div>
  );
}

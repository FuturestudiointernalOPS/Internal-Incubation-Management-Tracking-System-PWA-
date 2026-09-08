"use client";

import { useMemo } from "react";
import { getCountryOptions, getCountryDial } from "@/lib/countries";

/**
 * Standard phone input: country dial-code selector + national number.
 *
 * Storage: E.164 string, e.g. "+2349012345678". While the user is typing we
 * keep the national part as raw digits and only concatenate the dial code —
 * no libphonenumber reformatting — so the input never appears frozen or
 * "read only".
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

  function parsePhone(raw) {
    if (!raw) return { country: defaultCountry, national: "" };
    const str = String(raw).trim();
    const digits = str.replace(/\D/g, "");
    if (!digits) return { country: defaultCountry, national: "" };

    // E.164-ish value: strip the dial prefix.
    if (str.startsWith("+")) {
      for (const c of countries) {
        const d = c.dial.replace(/\D/g, "");
        if (d && digits.startsWith(d)) {
          return { country: c.iso, national: digits.slice(d.length) };
        }
      }
      return { country: defaultCountry, national: digits };
    }

    // Legacy JSON value: { country, code, number }.
    if (str.startsWith("{")) {
      try {
        const p = JSON.parse(str);
        const code = String(p.code || "").trim();
        const num = String(p.number || "").replace(/\D/g, "");
        const byCode = countries.find((c) => c.dial === code);
        const byIso = countries.find((c) => c.iso === p.country);
        return {
          country: byCode ? byCode.iso : byIso ? byIso.iso : defaultCountry,
          national: num,
        };
      } catch (_) {
        return { country: defaultCountry, national: digits };
      }
    }

    // Plain national number (no country context).
    return { country: defaultCountry, national: digits };
  }

  const { country, national } = parsePhone(value);

  const emit = (iso, rawNational) => {
    let digits = String(rawNational || "").replace(/\D/g, "");
    const dial = getCountryDial(iso);
    const dialDigits = dial.replace(/\D/g, "");

    // Prevent double-prefixing the dial code.
    if (dialDigits && digits.startsWith(dialDigits)) {
      digits = digits.slice(dialDigits.length);
    }

    onChange?.(digits ? `${dial}${digits}` : "");
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
        inputMode="tel"
        autoComplete="tel"
        value={national}
        onChange={(e) => emit(country, e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`min-w-0 flex-1 cursor-text ${inputClassName || "rounded-xl px-4 py-3 text-sm font-medium outline-none border"}`}
        style={{
          background: "var(--bg-primary)",
          borderColor: "var(--border-primary)",
          color: "var(--text-primary)",
        }}
      />
    </div>
  );
}

"use client";

import { useId } from "react";
import { ChevronDown } from "lucide-react";

export default function AppSelect({
  label,
  options = [],
  value,
  onChange,
  error,
  placeholder = "Select...",
  className = "",
  icon: Icon,
  id,
  ...props
}) {
  // Same contract as AppInput: the label points at the field, and a validation
  // message is announced as part of it rather than floating beside it.
  const generatedId = useId();
  const selectId = id || generatedId;
  const errorId = `${selectId}-error`;

  return (
    <div className="space-y-2">
      {label && (
        <label
          htmlFor={selectId}
          className="text-[10px] font-bold uppercase tracking-wider ml-1"
          style={{ color: "var(--text-secondary)" }}
        >
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-tertiary)" }} aria-hidden="true" />
        )}
        <select
          id={selectId}
          value={value}
          onChange={onChange}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={`
            w-full rounded-xl py-3 px-4 pr-10 text-[13px] font-medium outline-none
            appearance-none cursor-pointer transition-all border
            focus:!border-[var(--brand-orange)] focus:shadow-[0_0_0_3px_rgb(255_102_0/0.18)]
            ${Icon ? "pl-12" : ""}
            ${error ? "border-rose-500" : ""}
            ${className}
          `}
          style={{
            background: "var(--surface-1)",
            borderColor: error ? undefined : "var(--border-primary)",
            color: "var(--text-primary)",
          }}
          {...props}
        >
          <option value="" disabled style={{ background: "var(--surface-1)", color: "var(--text-tertiary)" }}>
            {placeholder}
          </option>
          {options.map((option) => (
            <option key={option.value || option} value={option.value || option} style={{ background: "var(--surface-1)", color: "var(--text-primary)" }}>
              {option.label || option}
            </option>
          ))}
        </select>
        <ChevronDown
          className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
          style={{ color: "var(--text-tertiary)" }}
          aria-hidden="true"
        />
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-[10px] font-bold text-rose-500 uppercase tracking-wider mt-1">{error}</p>
      )}
    </div>
  );
}

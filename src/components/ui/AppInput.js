"use client";

import { forwardRef, useId } from "react";

const AppInput = forwardRef(function AppInput(
  {
    label,
    error,
    icon: Icon,
    className = "",
    type = "text",
    id,
    ...props
  },
  ref
) {
  // The label must point at the field and the error must be announced as part
  // of it: without these the label is decorative (a click on it does not focus
  // the field) and a screen reader never reads the message back.
  const generatedId = useId();
  const inputId = id || generatedId;
  const errorId = `${inputId}-error`;

  return (
    <div className="space-y-2">
      {label && (
        <label
          htmlFor={inputId}
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
        <input
          ref={ref}
          id={inputId}
          type={type}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={`
            w-full rounded-xl py-3 px-4 text-[13px] font-medium outline-none
            transition-all border
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
        />
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-[10px] font-bold text-rose-500 uppercase tracking-wider mt-1">{error}</p>
      )}
    </div>
  );
});

export default AppInput;

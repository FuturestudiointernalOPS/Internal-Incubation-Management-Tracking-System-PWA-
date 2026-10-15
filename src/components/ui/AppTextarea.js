"use client";

import { forwardRef, useId } from "react";

/**
 * Multi-line counterpart of AppInput: same label, border, focus ring and error
 * contract, on a <textarea>.
 */
const AppTextarea = forwardRef(function AppTextarea(
  { label, error, className = "", rows = 3, id, ...props },
  ref
) {
  const generatedId = useId();
  const textareaId = id || generatedId;
  const errorId = `${textareaId}-error`;

  return (
    <div className="space-y-2">
      {label && (
        <label
          htmlFor={textareaId}
          className="text-[10px] font-bold uppercase tracking-wider ml-1"
          style={{ color: "var(--text-secondary)" }}
        >
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={textareaId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`
          w-full rounded-xl py-3 px-4 text-[13px] font-medium outline-none
          transition-all border resize-none
          focus:!border-[var(--brand-orange)] focus:shadow-[0_0_0_3px_rgb(255_102_0/0.18)]
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
      {error && (
        <p id={errorId} role="alert" className="text-[10px] font-bold text-rose-500 uppercase tracking-wider mt-1">{error}</p>
      )}
    </div>
  );
});

export default AppTextarea;

"use client";

import { forwardRef } from "react";

const AppInput = forwardRef(function AppInput(
  {
    label,
    error,
    icon: Icon,
    className = "",
    type = "text",
    ...props
  },
  ref
) {
  return (
    <div className="space-y-2">
      {label && (
        <label className="text-[10px] font-bold uppercase tracking-wider ml-1" style={{ color: "var(--text-secondary)" }}>
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-tertiary)" }} />
        )}
        <input
          ref={ref}
          type={type}
          className={`
            w-full rounded-md py-3 px-4 text-sm font-medium outline-none
            transition-all border
            ${Icon ? "pl-12" : ""}
            ${error ? "border-rose-500" : ""}
            ${className}
          `}
          style={{
            background: "var(--bg-primary)",
            borderColor: error ? undefined : "var(--border-primary)",
            color: "var(--text-primary)",
          }}
          {...props}
        />
      </div>
      {error && (
        <p className="text-[10px] font-bold text-rose-500 uppercase tracking-wider mt-1">{error}</p>
      )}
    </div>
  );
});

export default AppInput;

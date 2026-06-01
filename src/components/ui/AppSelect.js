"use client";

export default function AppSelect({
  label,
  options = [],
  value,
  onChange,
  placeholder = "Select...",
  className = "",
  icon: Icon,
  ...props
}) {
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
        <select
          value={value}
          onChange={onChange}
          className={`
            w-full rounded-md py-3 px-4 text-sm font-medium outline-none
            appearance-none cursor-pointer transition-all border
            ${Icon ? "pl-12" : ""}
            ${className}
          `}
          style={{
            background: "var(--bg-primary)",
            borderColor: "var(--border-primary)",
            color: "var(--text-primary)",
          }}
          {...props}
        >
          <option value="" disabled style={{ background: "var(--surface-1)", color: "var(--text-tertiary)" }}>
            {placeholder}
          </option>
          {options.map((opt) => (
            <option key={opt.value || opt} value={opt.value || opt} style={{ background: "var(--surface-1)", color: "var(--text-primary)" }}>
              {opt.label || opt}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

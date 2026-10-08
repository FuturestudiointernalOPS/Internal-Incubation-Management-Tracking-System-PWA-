"use client";

import { useI18n } from "@/lib/i18n";

export default function AssigneeSelect({
  value,
  onChange,
  disabled,
  className = "",
}) {
  const { t } = useI18n();

  return (
    <select
      value={value}
      onChange={(event) =>
        onChange({
          ...event.target,
          value: event.target.value,
        })
      }
      disabled={disabled}
      className={`w-full rounded-lg px-3 py-2 text-xs font-bold outline-none transition-colors ${className}`}
      style={{
        background: "var(--bg-primary)",
        border: "1px solid var(--border-primary)",
        color: "var(--text-primary)",
      }}
    >
      <option value="all">All</option>
      <option value="team">Team</option>
      <option value="individual">Individual</option>
    </select>
  );
}
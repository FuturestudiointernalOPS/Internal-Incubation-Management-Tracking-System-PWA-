"use client";

import { useState, useRef, useEffect } from "react";
import { Search, ChevronDown, Check } from "lucide-react";

/**
 * Standard searchable single-select.
 *
 * Options: [{ value, label, search?, flag?, icon? }]
 * value / onChange work with stable codes (e.g. ISO country code, language code).
 */
export default function AppSearchSelect({
  options = [],
  value = "",
  onChange,
  placeholder = "Select...",
  label,
  className = "",
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    function onDocClick(event) {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const selected = options.find((option) => option.value === value);

  const filtered = options.filter((option) => {
    if (!query.trim()) return true;
    const normalizedQuery = query.trim().toLowerCase();
    const haystack = `${option.label || ""} ${option.search || ""} ${option.value || ""}`.toLowerCase();
    return haystack.includes(normalizedQuery);
  });

  return (
    <div className={`space-y-2 ${className}`} ref={ref}>
      {label && (
        <label
          className="text-[10px] font-bold uppercase tracking-wider ml-1"
          style={{ color: "var(--text-secondary)" }}
        >
          {label}
        </label>
      )}
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setOpen(!open);
            setQuery("");
          }}
          className="w-full flex items-center justify-between gap-2 rounded-xl px-4 py-3 text-sm font-medium outline-none border cursor-pointer disabled:opacity-60"
          style={{
            background: "var(--bg-primary)",
            borderColor: "var(--border-primary)",
            color: "var(--text-primary)",
          }}
        >
          <span className="truncate">
            {selected ? (
              <>
                {selected.flag && <span className="mr-1.5">{selected.flag}</span>}
                {selected.label}
              </>
            ) : (
              <span style={{ color: "var(--text-tertiary)" }}>{placeholder}</span>
            )}
          </span>
          <ChevronDown className="w-4 h-4 shrink-0" style={{ color: "var(--text-tertiary)" }} />
        </button>

        {open && (
          <div
            className="absolute z-50 mt-2 w-full rounded-xl border shadow-2xl"
            style={{
              background: "var(--bg-secondary)",
              borderColor: "var(--border-primary)",
            }}
          >
            <div
              className="flex items-center gap-2 px-3 py-2 border-b"
              style={{ borderColor: "var(--border-primary)" }}
            >
              <Search className="w-4 h-4 shrink-0" style={{ color: "var(--text-tertiary)" }} />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search..."
                className="w-full bg-transparent text-sm font-medium outline-none"
                style={{ color: "var(--text-primary)" }}
              />
            </div>
            <div className="max-h-60 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <p className="px-4 py-3 text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>
                  No results
                </p>
              ) : (
                filtered.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onChange?.(option.value);
                      setOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm font-medium text-left hover:brightness-110"
                    style={{ color: "var(--text-primary)", background: "transparent" }}
                  >
                    {option.flag && <span>{option.flag}</span>}
                    <span className="flex-1 truncate">{option.label}</span>
                    {option.value === value && (
                      <Check className="w-4 h-4 shrink-0" style={{ color: "var(--brand-orange)" }} />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

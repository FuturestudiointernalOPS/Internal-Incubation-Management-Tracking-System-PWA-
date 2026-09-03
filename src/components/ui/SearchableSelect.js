"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { ChevronDown, Search } from "lucide-react";

/**
 * SearchableSelect — a lightweight, accessible, Google-style combobox.
 *
 * Props:
 *   options:       [{ value, label }]
 *   value:         currently selected value
 *   onChange:      (value) => void
 *   placeholder:   shown when nothing is selected
 *   searchPlaceholder: placeholder inside the search input
 *   emptyText:     shown when no options match the query
 *   label:         optional field label
 *   icon:          optional lucide icon (rendered on the left)
 */
export default function SearchableSelect({
  options = [],
  value,
  onChange,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyText = "No results found",
  label,
  icon: Icon,
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  const selected = useMemo(
    () => options.find((o) => o.value === value),
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    function onPointerDown(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setHighlight(0);
      const id = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(id);
    }
  }, [open]);

  const selectOption = (v) => {
    onChange(v);
    setOpen(false);
  };

  const handleKeyDown = (e) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[highlight]) selectOption(filtered[highlight].value);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className={`space-y-1 ${className}`} ref={rootRef}>
      {label && (
        <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1">
          {Icon && <Icon className="w-3 h-3" />} {label}
        </p>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-lg p-3 text-[11px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all text-left"
      >
        <span className={`flex-1 truncate ${selected ? "" : "text-[var(--text-tertiary)]"}`}>
          {selected?.label || placeholder}
        </span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 text-[var(--text-tertiary)] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="relative z-30">
          <div className="absolute left-0 right-0 top-0 mt-1 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg shadow-xl overflow-hidden">
            <div className="flex items-center gap-2 px-3 border-b border-[var(--border-primary)]">
              <Search className="w-4 h-4 shrink-0 text-[var(--text-tertiary)]" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setHighlight(0);
                }}
                onKeyDown={handleKeyDown}
                placeholder={searchPlaceholder}
                className="w-full py-3 text-[11px] font-bold text-[var(--text-primary)] bg-transparent outline-none placeholder:text-[var(--text-tertiary)]"
              />
            </div>

            <ul className="max-h-60 overflow-y-auto py-1" role="listbox">
              {filtered.length === 0 ? (
                <li className="px-3 py-2.5 text-[11px] text-[var(--text-tertiary)]">
                  {emptyText}
                </li>
              ) : (
                filtered.map((o, i) => (
                  <li key={o.value} role="option" aria-selected={o.value === value}>
                    <button
                      type="button"
                      onClick={() => selectOption(o.value)}
                      onMouseEnter={() => setHighlight(i)}
                      className={`w-full text-left px-3 py-2 text-[11px] font-bold transition-colors ${
                        o.value === value
                          ? "text-[var(--brand-orange)]"
                          : i === highlight
                            ? "bg-[var(--surface-2)] text-[var(--text-primary)]"
                            : "text-[var(--text-primary)]"
                      }`}
                    >
                      {o.label}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

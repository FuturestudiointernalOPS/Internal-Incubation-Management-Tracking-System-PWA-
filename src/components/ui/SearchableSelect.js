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
    () => options.find((option) => option.value === value),
    [options, value],
  );

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return options;
    return options.filter((option) => option.label.toLowerCase().includes(normalizedQuery));
  }, [options, query]);

  useEffect(() => {
    function onPointerDown(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
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

  // Opening the popover is an ACTION, so the search it starts from is cleared
  // where the action is taken rather than by an effect watching the popover. An
  // effect that reset it could only do so one render after the popover had
  // already been painted with the previous search still in it.
  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    setQuery("");
    setHighlight(0);
    setOpen(true);
  };

  // Focusing the search box once the popover has been painted is a DOM side
  // effect and writes no state.
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(id);
  }, [open]);

  const selectOption = (optionValue) => {
    onChange(optionValue);
    setOpen(false);
  };

  const handleKeyDown = (event) => {
    if (!open) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((currentHighlight) => Math.min(currentHighlight + 1, filtered.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((currentHighlight) => Math.max(currentHighlight - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (filtered[highlight]) selectOption(filtered[highlight].value);
    } else if (event.key === "Escape") {
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
        onClick={toggle}
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
                onChange={(event) => {
                  setQuery(event.target.value);
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
                filtered.map((option, index) => (
                  <li key={option.value} role="option" aria-selected={option.value === value}>
                    <button
                      type="button"
                      onClick={() => selectOption(option.value)}
                      onMouseEnter={() => setHighlight(index)}
                      className={`w-full text-left px-3 py-2 text-[11px] font-bold transition-colors ${
                        option.value === value
                          ? "text-[var(--brand-orange)]"
                          : index === highlight
                            ? "bg-[var(--surface-2)] text-[var(--text-primary)]"
                            : "text-[var(--text-primary)]"
                      }`}
                    >
                      {option.label}
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

"use client";

import React, { useMemo, useState } from "react";
import { Search, ChevronDown } from "lucide-react";
import { allCountries, countryLabel, countryName } from "@/lib/countries";

/**
 * CountrySelect — searchable country picker with flag + name.
 *
 * Props:
 *  - value:   alpha-2 code (or legacy free-text name; rendered as-is)
 *  - onSelect(code, name): called with the stable code + human name
 *
 * Storing the stable alpha-2 code keeps the value future-proof; display uses
 * the human-readable name + flag everywhere.
 */
export default function CountrySelect({ value, onSelect, inputStyle, id }) {
  const countries = useMemo(() => allCountries(), []);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const currentLabel = value
    ? (value.length === 2 ? countryLabel(value) : countryName(value)) || value
    : "";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return countries;
    return countries.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q),
    );
  }, [countries, query]);

  const pick = (code, name) => {
    if (onSelect) onSelect(code, name);
    setOpen(false);
    setQuery("");
  };

  return (
    <div className="relative">
      {!open ? (
        <button
          type="button"
          id={id}
          onClick={() => setOpen(true)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg outline-none border text-left"
          style={{ ...(inputStyle || {}), color: "var(--text-primary)" }}
        >
          <span className="flex items-center gap-2 text-sm">
            {currentLabel ? (
              <>
                {currentLabel}
              </>
            ) : (
              <span style={{ color: "var(--text-tertiary)" }}>Select country…</span>
            )}
          </span>
          <ChevronDown size={14} style={{ color: "var(--text-secondary)" }} />
        </button>
      ) : (
        <div className="w-full rounded-lg overflow-hidden border" style={inputStyle}>
          <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: "rgb(255 255 255 / 0.1)" }}>
            <Search size={14} style={{ color: "var(--text-secondary)" }} />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type to search a country…"
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: "var(--text-primary)" }}
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>No country found.</p>
            ) : (
              filtered.slice(0, 60).map((c) => (
                <button
                  type="button"
                  key={c.code}
                  onClick={() => pick(c.code, c.name)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm hover:opacity-80"
                  style={{ color: "var(--text-primary)", background: "transparent" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgb(255 255 255 / 0.06)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <span className="text-base">{c.flag}</span>
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-[9px] font-mono" style={{ color: "var(--text-tertiary)" }}>{c.code}</span>
                </button>
              ))
            )}
            {filtered.length > 60 && (
              <p className="px-3 py-2 text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                Keep typing to narrow results…
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => { setOpen(false); setQuery(""); }}
            className="w-full px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-center border-t"
            style={{ borderColor: "rgb(255 255 255 / 0.1)", color: "var(--text-secondary)" }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

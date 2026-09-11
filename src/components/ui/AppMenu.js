"use client";

import React, { useEffect, useRef, useState } from "react";
import { MoreVertical } from "lucide-react";

/**
 * AppMenu — compact row-action menu (the "⋯" pattern).
 *
 * Replaces long rows of inline icon buttons on operational surfaces: one
 * trigger, one anchored list, grouped items, destructive items in red and
 * separated. Closes on outside click and Escape.
 *
 * items: [{
 *   key, label, icon, onSelect, disabled?, danger?, separator?
 * }]
 */
export default function AppMenu({
  items = [],
  label = "More actions",
  align = "right",
  buttonClassName = "",
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!items.length) return null;

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        onClick={() => setOpen((o) => !o)}
        className={`p-1.5 rounded-lg text-slate-400 hover:text-[var(--text-primary)] hover:bg-white/5 transition-colors ${buttonClassName}`}
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute z-[60] mt-1 min-w-[220px] max-w-[280px] rounded-xl border border-[var(--border-primary)] bg-[var(--surface-1)] shadow-2xl py-1 ${
            align === "left" ? "left-0" : "right-0"
          }`}
        >
          {items.map((item, idx) =>
            item.separator ? (
              <div key={`sep-${idx}`} className="my-1 h-px bg-[var(--border-primary)]/60" />
            ) : (
              <button
                key={item.key || idx}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onSelect?.();
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-[11px] font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  item.danger
                    ? "text-rose-400 hover:bg-rose-500/10"
                    : "text-[var(--text-primary)] hover:bg-tertiary"
                }`}
              >
                {item.icon ? (
                  <item.icon className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <span className="w-3.5 h-3.5 shrink-0" />
                )}
                <span className="truncate">{item.label}</span>
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

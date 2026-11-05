"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreVertical } from "lucide-react";

/**
 * AppMenu — compact row-action menu (the "⋯" pattern).
 *
 * Replaces long rows of inline icon buttons on operational surfaces: one
 * trigger, one anchored list, grouped items, destructive items in red and
 * separated. Closes on outside click and Escape.
 *
 * The list is drawn on <body>, positioned from the trigger and kept inside the
 * viewport, so a small or `overflow: hidden` card can never clip it.
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
  const listRef = useRef(null);
  const [position, setPosition] = useState(null);

  // Place the list under the trigger, then pull it back inside the viewport.
  useEffect(() => {
    if (!open) return undefined;
    const place = () => {
      const trigger = wrapRef.current?.getBoundingClientRect();
      const list = listRef.current;
      if (!trigger || !list) return;
      const margin = 8;
      const width = list.offsetWidth;
      const height = list.offsetHeight;
      let left = align === "left" ? trigger.left : trigger.right - width;
      left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));
      let top = trigger.bottom + 4;
      if (top + height > window.innerHeight - margin) top = Math.max(margin, trigger.top - height - 4);
      setPosition({ left, top });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, align]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (wrapRef.current?.contains(event.target) || listRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
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
        onClick={() => setOpen((previousOpen) => !previousOpen)}
        className={`p-1.5 rounded-lg text-slate-400 hover:text-[var(--text-primary)] hover:bg-white/5 transition-colors ${buttonClassName}`}
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {open && createPortal(
        <div
          ref={listRef}
          role="menu"
          style={{ position: "fixed", left: position?.left ?? 0, top: position?.top ?? 0, visibility: position ? "visible" : "hidden" }}
          className="z-[1000] min-w-[220px] max-w-[min(280px,calc(100vw-16px))] rounded-xl border border-[var(--border-primary)] bg-[var(--surface-1)] shadow-2xl py-1"
        >
          {items.map((item, index) =>
            item.separator ? (
              <div key={`sep-${index}`} className="my-1 h-px bg-divider/60" />
            ) : (
              <button
                key={item.key || index}
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
        </div>,
        document.body,
      )}
    </div>
  );
}

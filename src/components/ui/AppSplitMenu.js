"use client";

import React, { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

/**
 * AppSplitMenu — a split action button.
 *
 * One segmented control: the left part is the action on show (its icon and
 * label), the chevron on the right opens the OTHER actions. Picking one runs it
 * and it becomes the action on show. The face runs the action directly.
 *
 * Actions on condition are simply left out of the list by the caller; an item
 * alone (no others) renders as a plain button with no chevron.
 *
 * actions: [{
 *   key, label, icon, onSelect, disabled?, danger?
 * }]
 */
export default function AppSplitMenu({
  actions = [],
  initialKey,
  label = "Actions",
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const [activeKey, setActiveKey] = useState(initialKey ?? actions[0]?.key);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false);
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

  if (!actions.length) return null;

  const active = actions.find((action) => action.key === activeKey) ?? actions[0];
  const others = actions.filter((action) => action.key !== active.key);
  const ActiveIcon = active.icon;

  const faceTone = active.danger
    ? "text-rose-500 hover:bg-rose-500/10"
    : "text-[var(--text-primary)] hover:bg-[var(--surface-3)]";

  return (
    <div ref={wrapRef} className={`relative inline-flex justify-end ${className}`}>
      <div className="inline-flex items-stretch rounded-lg border border-[var(--border-primary)] bg-tertiary shadow-sm overflow-hidden">
        <button
          type="button"
          disabled={active.disabled}
          onClick={() => active.onSelect?.()}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${faceTone}`}
        >
          {ActiveIcon ? <ActiveIcon className="w-3 h-3 shrink-0" /> : null}
          <span>{active.label}</span>
        </button>

        {others.length > 0 && (
          <>
            <span aria-hidden className="w-px bg-[var(--border-primary)]" />
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={open}
              aria-label={label}
              title={label}
              onClick={() => setOpen((previous) => !previous)}
              className="flex items-center px-1.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)]"
            >
              <ChevronDown className={`w-3 h-3 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
            </button>
          </>
        )}
      </div>

      {open && others.length > 0 && (
        <div
          role="menu"
          className="absolute right-0 top-full z-[60] mt-1 min-w-[190px] max-w-[280px] rounded-xl border border-[var(--border-primary)] bg-[var(--surface-1)] py-1 shadow-2xl"
        >
          {others.map((item) => {
            const ItemIcon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  setActiveKey(item.key);
                  item.onSelect?.();
                }}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-[11px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  item.danger
                    ? "text-rose-400 hover:bg-rose-500/10"
                    : "text-[var(--text-primary)] hover:bg-tertiary"
                }`}
              >
                {ItemIcon ? (
                  <ItemIcon className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <span className="w-3.5 h-3.5 shrink-0" />
                )}
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

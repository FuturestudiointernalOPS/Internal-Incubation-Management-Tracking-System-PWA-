"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { useI18n } from "@/lib/i18n";

// Same contract as AppModal (focus in, Tab kept inside, Escape closes, focus
// handed back) — only the geometry differs: the panel slides from the right
// instead of centring, which is the shape a "review this change" flow wants
// (the table it talks about stays visible beside it).
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The shared right-side drawer. CSS-only entrance (drawer-in keyframes in
 * globals.css), no animation library.
 *
 * @param {boolean} isOpen
 * @param {() => void} onClose
 * @param {string} title    drawer heading (already translated by the caller)
 * @param {React.ReactNode} children
 * @param {React.ReactNode} [footer]   pinned action row (confirm / cancel)
 * @param {"sm"|"md"} [width]          panel width (sm = 22rem, md = 26rem)
 */
export default function AppDrawer({ isOpen, onClose, title, children, footer, width = "md" }) {
  const { t } = useI18n();
  const titleId = useId();
  const panelRef = useRef(null);
  const previouslyFocused = useRef(null);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    if (isOpen) document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    previouslyFocused.current = document.activeElement;
    const panel = panelRef.current;
    if (panel) (panel.querySelector(FOCUSABLE_SELECTOR) || panel).focus();
    return () => {
      const previous = previouslyFocused.current;
      if (previous && typeof previous.focus === "function") previous.focus();
    };
  }, [isOpen]);

  const keepFocusInside = (event) => {
    if (event.key !== "Tab") return;
    const panel = panelRef.current;
    if (!panel) return;
    const focusable = [...panel.querySelectorAll(FOCUSABLE_SELECTOR)];
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[500]">
      <div
        className="modal-backdrop-in absolute inset-0"
        style={{ background: "rgba(0,0,0,0.6)" }}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        onKeyDown={keepFocusInside}
        tabIndex={-1}
        className="drawer-in absolute inset-y-0 right-0 flex w-full flex-col overflow-y-auto overscroll-contain shadow-2xl"
        style={{
          background: "var(--surface-1)",
          borderLeft: "1px solid var(--border-primary)",
          maxWidth: width === "sm" ? "22rem" : "26rem",
        }}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-[var(--border-primary)] p-4" style={{ background: "var(--surface-1)" }}>
          <h2
            id={titleId}
            className="min-w-0 text-sm font-black uppercase tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="shrink-0 rounded-lg p-1.5 transition-all hover:rotate-90"
            style={{ color: "var(--text-tertiary)" }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-3 p-4">{children}</div>

        {footer && (
          <div className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t border-[var(--border-primary)] p-4" style={{ background: "var(--surface-1)" }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

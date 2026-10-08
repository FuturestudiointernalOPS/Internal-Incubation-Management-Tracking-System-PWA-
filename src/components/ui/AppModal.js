"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { useI18n } from "@/lib/i18n";

// Everything a keyboard can land on inside the panel. Used to place the first
// focus when the dialog opens and to keep Tab inside it while it is open.
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The shared dialog surface. The entrance is a CSS animation rather than
 * `framer-motion`: the animation library added ~790 kB of client JavaScript to
 * every page that renders a modal, for a one-shot fade/scale that CSS performs
 * natively (see the keyframes in globals.css).
 */
export default function AppModal({ isOpen, onClose, title, children, size = "md" }) {
  const { t } = useI18n();
  const titleId = useId();
  const panelRef = useRef(null);
  // Who had focus before the dialog opened, so it can be handed back on close.
  const previouslyFocused = useRef(null);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    if (isOpen) document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Move focus into the dialog on open and restore it on close. Without this a
  // keyboard user is left behind the dialog, where Tab reaches the page beneath.
  useEffect(() => {
    if (!isOpen) return;
    previouslyFocused.current = document.activeElement;
    const panel = panelRef.current;
    if (panel) {
      const first = panel.querySelector(FOCUSABLE_SELECTOR);
      (first || panel).focus();
    }
    return () => {
      const previous = previouslyFocused.current;
      if (previous && typeof previous.focus === "function") previous.focus();
    };
  }, [isOpen]);

  // Keep Tab cycling inside the panel: without a trap, Tab walks out of the
  // dialog into the page that is still rendered behind it.
  const keepFocusInside = (event) => {
    if (event.key !== "Tab") return;
    const panel = panelRef.current;
    if (!panel) return;
    const focusable = panel.querySelectorAll(FOCUSABLE_SELECTOR);
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

  const widthMap = {
    sm: "max-w-md",
    md: "max-w-xl",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-3 sm:p-6">
      {/* Backdrop */}
      <div
        className="modal-backdrop-in absolute inset-0"
        style={{ background: "rgba(0,0,0,0.7)" }}
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Modal */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        onKeyDown={keepFocusInside}
        tabIndex={-1}
        className={`modal-panel-in relative w-full ${widthMap[size] || widthMap.md} rounded-[14px] p-4 sm:p-6 lg:p-8 shadow-2xl max-h-[90vh] sm:max-h-[85vh] overflow-y-auto overscroll-contain`}
        style={{ background: "var(--surface-1)", border: "1px solid var(--border-primary)" }}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between gap-3 mb-6">
            <h2 id={titleId} className="text-base sm:text-lg font-bold uppercase tracking-tight min-w-0 truncate" style={{ color: "var(--text-primary)" }}>
              {title}
            </h2>
            <button
              onClick={onClose}
              aria-label={t("common.close")}
              className="p-2 rounded-lg transition-all hover:rotate-90 shrink-0"
              style={{ color: "var(--text-tertiary)" }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

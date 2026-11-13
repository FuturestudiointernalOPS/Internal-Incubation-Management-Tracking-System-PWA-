"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * The one window shell of the investor workspace.
 *
 * The detail sheet, the introduction request and the comparison all open in the
 * same frame — same header, same close affordance, same footer — so a window
 * never looks like it belongs to a different product. It closes on Escape and
 * announces itself as a dialog.
 */
export default function InvestorModal({
  title,
  subtitle,
  onClose,
  actions,
  footer,
  children,
  maxWidth = "max-w-2xl",
}) {
  const { t } = useI18n();
  const closeRef = useRef(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative flex max-h-[85vh] w-full flex-col overflow-hidden rounded-2xl border border-[var(--border-primary)] bg-[var(--surface-1)] shadow-2xl ${maxWidth}`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border-primary)] px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-black uppercase tracking-wider text-[var(--text-primary)]">
              {title}
            </h3>
            {subtitle && (
              <p className="mt-0.5 truncate text-[11px] font-semibold text-[var(--text-secondary)]">
                {subtitle}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {actions}
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label={t("common.close")}
              className="rounded-lg p-1.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-3)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-orange)]"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>

        {footer && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--border-primary)] px-5 py-4 sm:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

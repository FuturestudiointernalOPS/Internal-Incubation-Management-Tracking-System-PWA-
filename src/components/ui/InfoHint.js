"use client";

import { useId, useState } from "react";
import { Info } from "lucide-react";

/**
 * INFO HINT — the small (i) that explains a label or a field in one sentence.
 *
 * Why a component: an explanation written beside every field becomes noise, and
 * a native `title` attribute is invisible on touch, unstyled, and read out of
 * order by screen readers. This one is opened by hover AND by focus AND by tap,
 * and it is wired to its trigger with `aria-describedby`.
 *
 * Props:
 *  - text:  the explanation (already translated — callers pass `t("…")`)
 *  - label: the accessible name of the trigger; defaults to the text
 *
 * Theme-aware: tokens only, no literal colours. Nothing here is interactive
 * beyond the hint itself, so it never takes part in a form submission.
 */
export default function InfoHint({ text, label }) {
  const [open, setOpen] = useState(false);
  const id = useId();

  if (!text) return null;

  return (
    <span className="relative inline-flex items-center align-middle">
      <button
        type="button"
        aria-label={label || text}
        aria-describedby={open ? id : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(event) => {
          // A tap toggles: touch devices have no hover to rely on. The click
          // must never submit the form it sits inside.
          event.preventDefault();
          setOpen((current) => !current);
        }}
        className="inline-flex items-center justify-center rounded-full align-middle"
        style={{ color: "var(--text-tertiary)", lineHeight: 0 }}
      >
        <Info size={12} aria-hidden="true" />
      </button>

      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute bottom-full right-0 z-50 mb-2 w-64 rounded-lg border px-3 py-2 text-[11px] font-normal normal-case tracking-normal leading-relaxed shadow-lg"
          style={{
            background: "var(--surface-2)",
            borderColor: "var(--border-primary)",
            color: "var(--text-primary)",
          }}
        >
          {text}
        </span>
      )}
    </span>
  );
}

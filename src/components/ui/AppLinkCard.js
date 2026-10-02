"use client";

import { useRef } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

// The "I heard you" nudge for a card whose page is not built yet. Played through
// the Web Animations API so a click never re-renders the card, and the browser
// restarts it cleanly on a quick second click. Transform only: it stays on the
// compositor and never touches layout.
const NUDGE_KEYFRAMES = [
  { transform: "translateX(0)" },
  { transform: "translateX(-3px)" },
  { transform: "translateX(3px)" },
  { transform: "translateX(-2px)" },
  { transform: "translateX(0)" },
];
const NUDGE_TIMING = { duration: 320, easing: "ease-out" };

const PAD = { sm: "p-4", md: "p-6", lg: "p-8", xl: "p-10" };

/**
 * A dashboard card that opens its own page — but only once that page exists.
 *
 * - `isDeveloped && redirectTo` → a real link (Next prefetch, keyboard, middle
 *   click, a ↗ in the corner).
 * - otherwise → the card stays put and gives a short nudge on click: no 404,
 *   no navigation. Flip `isDeveloped` to `true` the day the page ships.
 *
 * Same surface as `AppCard` (radius, border, surface-1), plus a discreet hover:
 * a 2px lift and the brand border.
 */
export default function AppLinkCard({
  children,
  redirectTo,
  isDeveloped = false,
  padding = "md",
  className = "",
  ariaLabel,
}) {
  const ref = useRef(null);
  const canNavigate = Boolean(isDeveloped && redirectTo);

  const classes = `group relative block rounded-[var(--radius-md)] border border-[var(--border-primary)] bg-[var(--surface-1)] ${PAD[padding] || PAD.md} cursor-pointer transition-[transform,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-[var(--brand-orange)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${className}`;

  if (canNavigate) {
    return (
      <Link href={redirectTo} aria-label={ariaLabel} className={classes}>
        <ArrowUpRight
          aria-hidden="true"
          className="absolute top-3 right-3 w-3.5 h-3.5 text-[var(--text-tertiary)] transition-colors group-hover:text-[var(--brand-orange)]"
        />
        {children}
      </Link>
    );
  }

  const nudge = () => {
    const el = ref.current;
    if (!el?.animate) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    el.animate(NUDGE_KEYFRAMES, NUDGE_TIMING);
  };

  return (
    <div ref={ref} onClick={nudge} className={classes}>
      {children}
    </div>
  );
}

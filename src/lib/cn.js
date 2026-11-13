/**
 * Class-name joiner — the single implementation.
 *
 * Every screen used to declare its own copy of this one-liner (platform pages,
 * the calendar panel, the admin dashboard, the shared platform and tasks
 * modules…). Copies drift and, worse, force a shared component to import a
 * space just to reach one. Import it from here instead:
 *
 *   import { cn } from "@/lib/cn";
 *
 * Pure: no React, no browser, no database.
 */
export function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

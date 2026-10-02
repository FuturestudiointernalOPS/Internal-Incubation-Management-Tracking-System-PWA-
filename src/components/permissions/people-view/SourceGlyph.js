"use client";

/**
 * The mark for ONE source layer of a capability: ✓ held, ✗ blocked, — absent.
 * Shared by the matrix table and the mobile cards so the two layouts cannot
 * draw the same state differently.
 */
export default function SourceGlyph({ on, kind }) {
  if (!on) {
    return <span className="text-[var(--text-secondary)] opacity-40">—</span>;
  }
  if (kind === "restrictions") {
    return <span className="text-sm font-black text-red-400">✗</span>;
  }
  return <span className="text-sm font-black text-[var(--brand-orange)]">✓</span>;
}

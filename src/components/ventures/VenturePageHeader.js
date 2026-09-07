"use client";

import VentureStatusBadge from "./VentureStatusBadge";

/**
 * VenturePageHeader — consistent Venture identity header shared by every
 * Venture workspace screen (founder, staff). Renders logo tile, display name,
 * lifecycle status badge, VNT code and a meta line (stage · industry ·
 * country…). Pure presentation: all values are passed in.
 */
export default function VenturePageHeader({
  displayName,
  brandColor,
  ventureId,
  status,
  metaItems = [],
}) {
  const name = displayName || "Venture";
  const meta = (metaItems || []).filter(Boolean);
  return (
    <div className="flex items-start gap-4">
      <div
        className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-xl shrink-0"
        style={{ backgroundColor: brandColor || "var(--brand-orange)" }}
      >
        {name.charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 pt-0.5">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="text-2xl font-bold tracking-tight truncate">{name}</h1>
          <VentureStatusBadge status={status} />
          {ventureId && (
            <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] font-mono">
              {ventureId}
            </span>
          )}
        </div>
        {meta.length > 0 && (
          <p className="text-xs mt-1.5 text-[var(--text-secondary)]">
            {meta.join(" · ")}
          </p>
        )}
      </div>
    </div>
  );
}

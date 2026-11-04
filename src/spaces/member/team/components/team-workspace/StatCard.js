"use client";

import AppCard from "@/components/ui/AppCard";

/**
 * One of the four figure cards over the overview: an icon, a caption and the
 * value under it. The progress card adds the bar.
 * Extracted verbatim from app/team/[id]/page.js.
 */
export default function StatCard({ icon, caption, value, progress }) {
  return (
    <AppCard padding="md">
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-xl ${icon.wrap} flex items-center justify-center`}
        >
          {icon.glyph}
        </div>
        <div>
          <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
            {caption}
          </p>
          <p className="text-lg font-black text-[var(--text-primary)]">{value}</p>
        </div>
      </div>
      {progress !== undefined && (
        <div className="mt-3 h-2 bg-[var(--surface-3)] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progress}%`,
              background: "var(--brand-orange)",
            }}
          />
        </div>
      )}
    </AppCard>
  );
}
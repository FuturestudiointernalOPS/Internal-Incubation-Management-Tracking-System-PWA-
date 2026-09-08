"use client";

/**
 * Accessible LMS progress bar (design-system colors, screen-reader friendly).
 */
export default function LearnerProgressBar({ percent = 0, label }) {
  const value = Math.min(100, Math.max(0, Math.round(Number(percent) || 0)));
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label || `${value}%`}
      className="w-full"
    >
      <div
        className="h-2 rounded-full overflow-hidden"
        style={{ background: "var(--surface-3)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${value}%`, background: "var(--brand-orange)" }}
        />
      </div>
    </div>
  );
}

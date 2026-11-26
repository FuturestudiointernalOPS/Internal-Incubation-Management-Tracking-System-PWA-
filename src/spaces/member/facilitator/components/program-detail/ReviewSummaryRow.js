"use client";

/**
 * A label/value (plus optional note) line of a submitted review's summary.
 * Extracted verbatim from FacilitatorProgram.
 */
export default function ReviewSummaryRow({ label, value, note }) {
  if (!value && !note) return null;
  return (
    <div className="text-[10px]">
      <p className="text-[var(--text-secondary)]">
        <strong className="text-[var(--text-primary)]">{label}:</strong>{" "}
        {value || ""}
      </p>
      {note && (
        <p className="text-[var(--text-secondary)] mt-0.5 pl-1">{note}</p>
      )}
    </div>
  );
}

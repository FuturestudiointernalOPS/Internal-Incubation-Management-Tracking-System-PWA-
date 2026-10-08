"use client";

/**
 * VIEW TOGGLE — extracted from `EligibilityView.js`.
 *
 * The two-way switch between the identity editor (one identity at a time) and
 * the roles × features matrix. Purely presentational: it receives the current
 * mode and the setter the view owns.
 *
 * Split out verbatim, behaviour identical.
 */

export default function EligibilityViewToggle({ t, viewMode, setViewMode }) {
  return (
    <div className="flex gap-1 bg-secondary rounded-xl p-1 border border-[var(--border-primary)] w-fit">
      <button
        onClick={() => setViewMode("identity")}
        className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${viewMode === "identity" ? "bg-[var(--brand-orange)] text-black" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
      >
        {t("engineering.permissions.eligibilityIdentityView")}
      </button>
      <button
        onClick={() => setViewMode("matrix")}
        className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${viewMode === "matrix" ? "bg-[var(--brand-orange)] text-black" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
      >
        {t("engineering.permissions.eligibilityMatrixView")}
      </button>
    </div>
  );
}

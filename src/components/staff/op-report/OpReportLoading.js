/**
 * The suspense fallback the report page shows while the screen is prepared.
 * Moved out of page.js as-is, so the DOM it renders is unchanged.
 */

export default function OpReportLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[var(--brand-orange)] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

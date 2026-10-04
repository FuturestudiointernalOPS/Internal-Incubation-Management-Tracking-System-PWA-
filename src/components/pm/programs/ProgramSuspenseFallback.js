/**
 * The spinner shown while the screen's params resolve.
 *
 * Rendering only — it owns nothing.
 */
export default function ProgramSuspenseFallback() {
  return (
    <div className="min-h-screen bg-primary flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[var(--brand-orange)] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

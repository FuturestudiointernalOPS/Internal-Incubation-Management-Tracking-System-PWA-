"use client";

/**
 * The identity row shared by every venture card in the investor workspace:
 * an initial avatar, the name, and one line of context. Keeping it in one place
 * is what makes the discovery grid, the pipeline and the watchlist read the same.
 */
export function InitialAvatar({ name }) {
  const initial = String(name || "?").trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      aria-hidden="true"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-black"
      style={{
        background: "color-mix(in srgb, var(--brand-orange) 15%, transparent)",
        color: "var(--brand-orange)",
      }}
    >
      {initial}
    </span>
  );
}

export default function VentureIdentity({ name, meta, onClick }) {
  const content = (
    <>
      <InitialAvatar name={name} />
      <span className="min-w-0">
        <span
          className={`block truncate text-sm font-black text-[var(--text-primary)]${
            onClick ? " transition-colors group-hover:text-[var(--brand-orange)]" : ""
          }`}
        >
          {name}
        </span>
        {meta && (
          <span className="mt-1 block truncate text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
            {meta}
          </span>
        )}
      </span>
    </>
  );

  if (!onClick) {
    return <div className="flex min-w-0 items-center gap-3">{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-w-0 flex-1 items-center gap-3 text-left"
    >
      {content}
    </button>
  );
}

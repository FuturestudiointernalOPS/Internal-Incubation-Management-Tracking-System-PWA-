"use client";

import AppImage from "@/components/ui/AppImage";

const initialsOf = (name, fallback) => {
  const source = String(name || fallback || "?").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : source.slice(0, 2);
  return letters.toUpperCase();
};

/** Round learner photo, falling back to initials when the contact has none. */
export default function LearnerAvatar({ learner, fallback, size = 40 }) {
  const dimension = { width: size, height: size };
  if (learner?.image) {
    return (
      <AppImage
        src={learner.image}
        alt=""
        referrerPolicy="no-referrer"
        className="rounded-full object-cover shrink-0"
        style={dimension}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="rounded-full shrink-0 flex items-center justify-center font-black"
      style={{
        ...dimension,
        fontSize: Math.round(size * 0.36),
        background: "var(--surface-3)",
        color: "var(--text-secondary)",
      }}
    >
      {initialsOf(learner?.name, fallback)}
    </span>
  );
}

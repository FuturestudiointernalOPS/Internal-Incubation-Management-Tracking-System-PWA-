"use client";

/**
 * A labelled field of the section-resources form. Extracted from
 * SectionResourcesEditor so the form's blocks share one label primitive.
 */
export default function Field({ label, children }) {
  return (
    <div>
      <label
        className="block text-[9px] font-black uppercase tracking-widest mb-1.5"
        style={{ color: "var(--text-secondary)" }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

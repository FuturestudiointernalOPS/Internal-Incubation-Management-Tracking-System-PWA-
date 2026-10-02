"use client";

import { ChevronLeft } from "lucide-react";

/**
 * The facilitator programme header: the back link, the programme name and the
 * scope note.
 * Extracted verbatim from FacilitatorProgram.
 */
export default function ProgramHeader({ program }) {
  return (
    <header>
      <a
        href="/facilitator"
        className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--brand-orange)] mb-2"
      >
        <ChevronLeft className="w-3.5 h-3.5" /> My programs
      </a>
      <h1 className="text-xl font-black uppercase tracking-tight">
        {program?.name || "Program"}
      </h1>
      <p className="text-[10px] text-[var(--text-secondary)] font-bold mt-1">
        You only see data within your assigned scope.
      </p>
    </header>
  );
}

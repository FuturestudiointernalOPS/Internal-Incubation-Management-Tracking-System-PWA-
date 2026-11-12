"use client";

import { Loader2 } from "lucide-react";

/** Spinner shown while the program-teams reads are still settling. */
export default function TeamsLoadingState() {
  return (
    <>
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[var(--brand-orange)] animate-spin" />
      </div>
    </>
  );
}

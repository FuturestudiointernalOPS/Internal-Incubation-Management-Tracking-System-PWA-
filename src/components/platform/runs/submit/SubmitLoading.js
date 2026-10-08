"use client";

import { Loader2 } from "lucide-react";

export default function SubmitLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-[var(--brand-orange)]" />
    </div>
  );
}

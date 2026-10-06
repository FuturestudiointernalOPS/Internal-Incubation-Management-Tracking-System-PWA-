"use client";

import { Shield } from "lucide-react";
import AppButton from "@/components/ui/AppButton";

/**
 * The empty state shown before a due-diligence workspace exists.
 * Extracted verbatim from DueDiligenceContent.
 */
export default function NoWorkspaceState({ onStart }) {
  return (
    <div className="text-center py-20">
      <Shield className="w-16 h-16 text-[var(--text-tertiary)] mx-auto mb-4" />
      <h2 className="text-lg font-black text-[var(--text-primary)] uppercase mb-2">Start Due Diligence</h2>
      <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto mb-6">
        Create a secure due diligence workspace to evaluate this venture.
      </p>
      <AppButton variant="primary" icon={Shield} onClick={onStart}>Begin Due Diligence</AppButton>
    </div>
  );
}

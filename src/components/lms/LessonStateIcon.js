"use client";

import { CheckCircle2, PlayCircle, Circle } from "lucide-react";

/** Visual state for a lesson row: ✓ completed · ▶ current · ○ not started. */
export default function LessonStateIcon({ state }) {
  if (state === "completed") {
    return <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: "var(--chart-success)" }} />;
  }
  if (state === "current") {
    return <PlayCircle className="w-4 h-4 shrink-0" style={{ color: "var(--brand-orange)" }} />;
  }
  return <Circle className="w-4 h-4 shrink-0" style={{ color: "var(--text-tertiary)" }} />;
}

"use client";

import { Building2, ClipboardList, Users, AlertTriangle, MessageSquare } from "lucide-react";

/**
 * The Overview | Requests | Founders | Risks | Notes tab strip.
 * Extracted verbatim from DueDiligenceContent.
 */
export default function DiligenceTabs({ activeTab, onTabChange, requestCount, noteCount }) {
  return (
    <div className="flex gap-1 border-b border-[var(--border-primary)]">
      {[
        { id: "overview", label: "Overview", icon: Building2 },
        { id: "requests", label: `Requests (${requestCount})`, icon: ClipboardList },
        { id: "founders", label: "Founders", icon: Users },
        { id: "risks", label: "Risks", icon: AlertTriangle },
        { id: "notes", label: `Notes (${noteCount})`, icon: MessageSquare },
      ].map(tab => (
        <button key={tab.id} onClick={() => onTabChange(tab.id)}
          className={`flex items-center gap-2 px-4 py-3 text-[10px] font-black uppercase tracking-wider relative ${
            activeTab === tab.id ? "text-[var(--brand-orange)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}>
          <tab.icon className="w-3.5 h-3.5" />{tab.label}
          {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--brand-orange)]" />}
        </button>
      ))}
    </div>
  );
}

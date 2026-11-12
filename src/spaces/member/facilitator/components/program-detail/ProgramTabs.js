"use client";

import {
  BookOpen,
  CalendarCheck,
  ClipboardList,
  LayoutDashboard,
  Send,
  Users,
} from "lucide-react";

/**
 * The facilitator programme tab bar.
 * Extracted verbatim from FacilitatorProgram.
 */
export default function ProgramTabs({ tab, onTabChange }) {
  const tabs = [
    { key: "overview", label: "Overview", icon: LayoutDashboard },
    { key: "curriculum", label: "Curriculum", icon: BookOpen },
    { key: "participants", label: "Participants", icon: Users },
    { key: "attendance", label: "Attendance", icon: CalendarCheck },
    { key: "assignments", label: "Assignments", icon: ClipboardList },
    { key: "review", label: "My Review", icon: Send },
  ];

  return (
    <div className="flex gap-2 flex-wrap">
      {tabs.map((tabItem) => (
        <button
          key={tabItem.key}
          onClick={() => onTabChange(tabItem.key)}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border text-[10px] font-bold uppercase tracking-wide transition-all ${
            tab === tabItem.key
              ? "bg-brand-orange/10 border-[var(--brand-orange)] text-[var(--brand-orange)]"
              : "bg-secondary border-[var(--border-primary)] text-[var(--text-secondary)]"
          }`}
        >
          <tabItem.icon className="w-3.5 h-3.5" />
          {tabItem.label}
        </button>
      ))}
    </div>
  );
}

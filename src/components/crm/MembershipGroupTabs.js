"use client";

import { Shield } from "lucide-react";

export function MembershipGroupTabs({ t, groups, selectedGroup, setSelectedGroup }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={() => setSelectedGroup("")}
        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
          selectedGroup === "" ? "border-[var(--brand-orange)]" : "border-transparent"
        }`}
        style={{
          background: selectedGroup === "" ? "var(--surface-3)" : "var(--surface-1)",
          color: selectedGroup === "" ? "var(--brand-orange)" : "var(--text-secondary)",
        }}
      >
        {t("membership.page.allGroups")}
      </button>
      {groups.map((group) => {
        const active = selectedGroup === group.name;
        return (
          <button
            key={group.name}
            onClick={() => setSelectedGroup(active ? "" : group.name)}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
              active ? "border-[var(--brand-orange)]" : "border-transparent"
            }`}
            style={{
              background: active ? "var(--surface-3)" : "var(--surface-1)",
              color: active ? "var(--brand-orange)" : "var(--text-secondary)",
            }}
          >
            <span className="inline-flex items-center gap-1.5">
              {group.isProtected && <Shield className="w-3.5 h-3.5" />}
              {group.name}
              {group.isProtected && (
                <span
                  className="px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider"
                  style={{ background: "rgba(245,158,11,0.15)", color: "#F59E0B" }}
                >
                  {t("membership.page.protected")}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

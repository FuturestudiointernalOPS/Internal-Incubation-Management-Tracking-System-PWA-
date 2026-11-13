"use client";

/**
 * Tab bar of the CRM person detail. The tabs (and their icons) are built by
 * the page; this component only renders the bar and reports the click.
 */
export default function PersonTabs({ tabs, active, onChange }) {
  return (
    <div className="flex gap-1 border-b border-[var(--border-primary)] pb-0">
      {tabs.map(tabItem => (
        <button
          key={tabItem.key}
          onClick={() => onChange(tabItem.key)}
          className={`flex items-center gap-2 px-4 py-2.5 text-[11px] font-black uppercase tracking-wider border-b-2 transition-colors ${
            active === tabItem.key
              ? "border-[var(--brand-orange)] text-[var(--brand-orange)]"
              : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
        >
          <tabItem.icon className="w-3.5 h-3.5" />
          {tabItem.label}
        </button>
      ))}
    </div>
  );
}

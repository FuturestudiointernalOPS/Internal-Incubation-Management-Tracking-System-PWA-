import { cn } from "./helpers";

export default function RunTabs({ tabs, detailTab, onSelect }) {
  return (
    <div className="flex items-center gap-0 px-6 border-b border-[var(--border-primary)] shrink-0 bg-secondary">
      {tabs.map((tab) => (
        tab.href ? (
          <a key={tab.id} href={tab.href} className="flex items-center gap-1.5 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide border-b-2 transition-colors border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            <tab.icon className="w-3 h-3" /> {tab.label}
          </a>
        ) : (
          <button key={tab.id} onClick={() => onSelect(tab.id)} className={cn("flex items-center gap-1.5 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide border-b-2 transition-colors", detailTab === tab.id ? "border-[var(--brand-orange)] text-[var(--brand-orange)]" : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]")}>
            <tab.icon className="w-3 h-3" /> {tab.label}
          </button>
        )
      ))}
    </div>
  );
}

import { Plus } from "lucide-react";

export default function CollectionsHeader({ t, onNew }) {
  return (
    <div className="flex items-center justify-between flex-wrap gap-4">
      <div>
        <h1 className="text-lg font-black uppercase tracking-tight text-[var(--text-primary)]">
          {t("platformMisc.collections.title")}
        </h1>
        <p className="text-[10px] text-[var(--text-secondary)] mt-1">
          {t("platformMisc.collections.subtitle")}
        </p>
      </div>
      <button
        onClick={onNew}
        className="flex items-center gap-2 px-4 py-2.5 bg-[var(--brand-orange)] text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition-all"
      >
        <Plus className="w-3.5 h-3.5" /> {t("platformMisc.collections.newCollection")}
      </button>
    </div>
  );
}

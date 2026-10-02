import NextLink from "next/link";
import { Plus, Search, Loader2, FolderKanban } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import FormCard from "./FormCard";

export default function FormsListView({
  forms, loading, collections, search, onSearch,
  statusFilter, onStatusFilterChange, onNew,
  onOpen, onDuplicate, onArchive, onUnarchive, onDelete,
}) {
  const { t } = useI18n();
  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-lg font-black uppercase tracking-tight text-[var(--text-primary)]">{t("platformMisc.forms.listTitle")}</h1>
          <p className="text-[10px] text-[var(--text-secondary)] mt-1">{t("platformMisc.forms.listSubtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <NextLink href="/platform/collections" className="flex items-center gap-2 px-4 py-2.5 bg-tertiary border border-[var(--border-primary)] text-[var(--text-secondary)] rounded-xl text-[10px] font-black uppercase hover:text-[var(--text-primary)] transition-all">
            <FolderKanban className="w-3.5 h-3.5" /> {t("platformMisc.forms.collectionsLink")}
          </NextLink>
          <button onClick={onNew} className="flex items-center gap-2 px-4 py-2.5 bg-[var(--brand-orange)] text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition-all">
            <Plus className="w-3.5 h-3.5" /> {t("platformMisc.forms.newForm")}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-secondary)]" />
          <input type="text" placeholder={t("platformMisc.forms.searchPlaceholder")} value={search} onChange={(event) => onSearch(event.target.value)} className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-tertiary border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none focus:border-[var(--brand-orange)]" />
        </div>
        <select value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value)} className="px-3 py-2.5 rounded-xl bg-tertiary border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]">
          <option value="all">{t("platformMisc.forms.statusAll")}</option>
          <option value="draft">{t("platformMisc.forms.statusDraft")}</option>
          <option value="published">{t("platformMisc.forms.statusPublished")}</option>
          <option value="archived">{t("platformMisc.forms.statusArchived")}</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-5 h-5 animate-spin text-[var(--brand-orange)]" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {forms.filter((form) => !search || form.name.toLowerCase().includes(search.toLowerCase())).map((form) => {
            const collection = form.collection_id ? collections.find((candidate) => candidate.id === form.collection_id) : null;
            return (
              <FormCard
                key={form.id}
                form={form}
                collection={collection}
                onOpen={onOpen}
                onDuplicate={onDuplicate}
                onArchive={onArchive}
                onUnarchive={onUnarchive}
                onDelete={onDelete}
              />
            );
          })}
        </div>
      )}
    </>
  );
}

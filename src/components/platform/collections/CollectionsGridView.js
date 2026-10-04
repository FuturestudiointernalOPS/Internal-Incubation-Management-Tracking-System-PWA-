import { Archive, Clock, Edit3, FolderKanban, Loader2, RotateCcw, User } from "lucide-react";
import { cn } from "./helpers";
import { STATUS_CONFIG } from "./constants";

export default function CollectionsGridView({ t, loading, collections, onEdit, onArchive, onUnarchive }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {loading ? (
        <div className="col-span-full flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--brand-orange)]" />
        </div>
      ) : collections.length === 0 ? (
        <div className="col-span-full py-16 text-center">
          <FolderKanban className="w-10 h-10 mx-auto text-[var(--text-secondary)] opacity-20" />
          <p className="text-[11px] text-[var(--text-secondary)] mt-3 font-bold">
            {t("platformMisc.collections.noCollections")}
          </p>
          <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-1 opacity-50">
            {t("platformMisc.collections.createFirstPrompt")}
          </p>
        </div>
      ) : (
        collections.map((collection) => {
          const statusConfig = STATUS_CONFIG[collection.status] || STATUS_CONFIG.active;
          const parent = collection.parent_id
            ? collections.find((entry) => entry.id === collection.parent_id)
            : null;
          return (
            <div
              key={collection.id}
              className="p-5 rounded-2xl bg-secondary border border-[var(--border-primary)] hover:border-brand-orange/50 transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <span
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: (collection.color || "#FF6600") + "20" }}
                >
                  <FolderKanban
                    className="w-5 h-5"
                    style={{ color: collection.color || "#FF6600" }}
                  />
                </span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => onEdit(collection)}
                    className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--brand-orange)] hover:bg-tertiary"
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                  {collection.status !== "archived" ? (
                    <button
                      onClick={() => onArchive(collection.id)}
                      className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-rose-500 hover:bg-tertiary"
                      title={t("platformMisc.collections.archiveTitle")}
                    >
                      <Archive className="w-3 h-3" />
                    </button>
                  ) : (
                    <button
                      onClick={() => onUnarchive(collection.id)}
                      className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-emerald-500 hover:bg-tertiary"
                      title={t("platformMisc.collections.restoreTitle")}
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight">
                {collection.name}
              </h3>
              {collection.description && (
                <p className="text-[10px] text-[var(--text-secondary)] mt-1 leading-relaxed">
                  {collection.description}
                </p>
              )}

              {parent && (
                <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-2 opacity-50">
                  {t("platformMisc.collections.nestedIn", { name: parent.name })}
                </p>
              )}

              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase", statusConfig.color, statusConfig.bg)}>
                  {t(statusConfig.label)}
                </span>
                {Array.isArray(collection.tags) &&
                  collection.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded bg-tertiary text-[var(--text-secondary)] text-[10px] font-bold"
                    >
                      {tag}
                    </span>
                  ))}
              </div>

              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[var(--border-primary)] text-[10px] text-[var(--text-secondary)]">
                {collection.owner_name && (
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {collection.owner_name}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {collection.updated_at
                    ? new Date(collection.updated_at).toLocaleDateString()
                    : "—"}
                </span>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

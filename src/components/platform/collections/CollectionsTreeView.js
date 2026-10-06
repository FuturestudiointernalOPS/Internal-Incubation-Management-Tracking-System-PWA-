import { FolderTree, Loader2 } from "lucide-react";

export default function CollectionsTreeView({ t, loading, tree, renderTreeNode }) {
  return (
    <div className="rounded-2xl bg-secondary border border-[var(--border-primary)] p-3 space-y-1">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--brand-orange)]" />
        </div>
      ) : tree.length === 0 ? (
        <div className="py-16 text-center">
          <FolderTree className="w-10 h-10 mx-auto text-[var(--text-secondary)] opacity-20" />
          <p className="text-[11px] text-[var(--text-secondary)] mt-3 font-bold">
            {t("platformMisc.collections.noCollections")}
          </p>
          <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-1 opacity-50">
            {t("platformMisc.collections.createFirstPrompt")}
          </p>
        </div>
      ) : (
        tree.map((node) => renderTreeNode(node))
      )}
    </div>
  );
}

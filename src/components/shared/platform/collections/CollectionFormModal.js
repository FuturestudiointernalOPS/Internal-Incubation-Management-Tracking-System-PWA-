import { X } from "lucide-react";

export default function CollectionFormModal({ t, editing, form, setForm, collections, saving, onSubmit, onClose }) {
  return (
    <div
      className="fixed inset-0 z-[400] bg-black/40 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-xl space-y-5 max-h-[90vh] overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">
            {editing ? t("platformMisc.collections.editCollection") : t("platformMisc.collections.newCollection")}
          </h3>
          <button
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
              {t("platformMisc.collections.name")}
            </label>
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder={t("platformMisc.collections.namePlaceholder")}
              className="w-full rounded-xl px-4 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] focus:border-[var(--brand-orange)]"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
              {t("platformMisc.collections.description")}
            </label>
            <textarea
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              rows={2}
              placeholder={t("platformMisc.collections.descriptionPlaceholder")}
              className="w-full rounded-xl px-4 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] focus:border-[var(--brand-orange)] resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                {t("platformMisc.collections.parent")}
              </label>
              <select
                value={form.parent_id}
                onChange={(event) => setForm({ ...form, parent_id: event.target.value })}
                className="w-full rounded-xl px-3 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] focus:border-[var(--brand-orange)]"
              >
                <option value="">{t("platformMisc.collections.noParent")}</option>
                {collections
                  .filter((entry) => entry.id !== editing?.id)
                  .map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                {t("platformMisc.collections.visibility")}
              </label>
              <select
                value={form.visibility}
                onChange={(event) => setForm({ ...form, visibility: event.target.value })}
                className="w-full rounded-xl px-3 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] focus:border-[var(--brand-orange)]"
              >
                <option value="internal">{t("platformMisc.collections.visibilityInternal")}</option>
                <option value="public">{t("platformMisc.collections.visibilityPublic")}</option>
                <option value="restricted">{t("platformMisc.collections.visibilityRestricted")}</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
              {t("platformMisc.collections.tagsLabel")}
            </label>
            <input
              value={form.tags}
              onChange={(event) => setForm({ ...form, tags: event.target.value })}
              placeholder={t("platformMisc.collections.tagsPlaceholder")}
              className="w-full rounded-xl px-4 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] focus:border-[var(--brand-orange)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                {t("platformMisc.collections.status")}
              </label>
              <select
                value={form.status}
                onChange={(event) => setForm({ ...form, status: event.target.value })}
                className="w-full rounded-xl px-3 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] focus:border-[var(--brand-orange)]"
              >
                <option value="active">{t("platformMisc.collections.statusActive")}</option>
                <option value="draft">{t("platformMisc.collections.statusDraft")}</option>
                <option value="archived">{t("platformMisc.collections.statusArchived")}</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                {t("platformMisc.collections.category")}
              </label>
              <input
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
                placeholder={t("platformMisc.collections.categoryPlaceholder")}
                className="w-full rounded-xl px-3 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] focus:border-[var(--brand-orange)]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                {t("platformMisc.collections.color")}
              </label>
              <input
                type="color"
                value={form.color}
                onChange={(event) => setForm({ ...form, color: event.target.value })}
                className="w-full h-[42px] rounded-xl cursor-pointer border border-[var(--border-primary)]"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 btn btn-secondary"
          >
            {t("platformMisc.collections.cancel")}
          </button>
          <button
            onClick={onSubmit}
            disabled={saving || !form.name.trim()}
            className="flex-1 btn btn-primary"
          >
            {saving ? t("platformMisc.collections.saving") : editing ? t("platformMisc.collections.update") : t("platformMisc.collections.create")}
          </button>
        </div>
      </div>
    </div>
  );
}

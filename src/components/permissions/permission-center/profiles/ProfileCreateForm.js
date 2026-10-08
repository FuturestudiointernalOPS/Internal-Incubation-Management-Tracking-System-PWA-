/**
 * The create form: a name, an optional description, create or cancel.
 *
 * Cut out of src/components/permissions/permission-center/AccessProfilesView.js
 * as-is: the panel keeps every state value and every write, and hands this block
 * what it reads through `ctx`. The names it needs are listed in the signature —
 * nothing else.
 */

"use client";
export default function ProfileCreateForm({ ctx }) {
  const {
    createProfile,
    newProfile,
    setNewProfile,
    setShowCreateForm,
    showCreateForm,
    t,
  } = ctx;

  return (
    <>
      {showCreateForm && (
            <div className="ios-card !p-5 border-[var(--border-primary)] space-y-4">
              <h4 className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-wider">
                {t("engineering.permissions.newAccessProfile")}
              </h4>
              <div className="space-y-3">
                <input
                  value={newProfile.name}
                  onChange={(event) =>
                    setNewProfile({ ...newProfile, name: event.target.value })
                  }
                  placeholder={t("engineering.permissions.profileNamePlaceholder")}
                  className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-brand-orange/50 transition-all"
                />
                <input
                  value={newProfile.description}
                  onChange={(event) =>
                    setNewProfile({ ...newProfile, description: event.target.value })
                  }
                  placeholder={t("engineering.permissions.descriptionOptional")}
                  className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-brand-orange/50 transition-all"
                />
                <div className="flex gap-2">
                  <button
                    onClick={createProfile}
                    disabled={!newProfile.name.trim()}
                    className="px-4 py-2 rounded-xl bg-[var(--brand-orange)] text-black text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50"
                  >
                    {t("engineering.permissions.create")}
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateForm(false);
                      setNewProfile({ name: "", description: "" });
                    }}
                    className="px-4 py-2 rounded-xl bg-secondary border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-widest hover:bg-tertiary transition-all"
                  >
                    {t("engineering.permissions.cancel")}
                  </button>
                </div>
              </div>
            </div>
          )}
    </>
  );
}

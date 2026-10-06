"use client";

/**
 * Profile-safety confirmation for role-bound profiles.
 *
 * Saving capability changes to a profile that is a role default affects every
 * person holding that role, so the write asks first. Moved verbatim out of
 * `AccessProfilesView.js`; the parent keeps the pending state and the write.
 */
export default function ProfileSaveConfirmModal({ t, roles, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.7)" }}
        onClick={onCancel}
      />
      <div
        className="relative w-full max-w-md rounded-2xl p-6 shadow-2xl"
        style={{
          background: "var(--surface-1)",
          border: "1px solid var(--border-primary)",
        }}
      >
        <h4
          className="text-sm font-black uppercase tracking-tight"
          style={{ color: "var(--text-primary)" }}
        >
          {t("engineering.permissions.confirmChanges")}
        </h4>
        <p
          className="text-[10px] font-bold mt-2"
          style={{ color: "var(--text-secondary)" }}
        >
          {t("engineering.permissions.profileInUseWarning", {
            roles: roles.join(", "),
          })}
        </p>
        <p
          className="text-[10px] font-bold mt-1"
          style={{ color: "var(--text-tertiary)" }}
        >
          {t("engineering.permissions.profileChangeAffectsUsers")}
        </p>
        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl bg-secondary border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-widest hover:bg-tertiary transition-all"
          >
            {t("engineering.permissions.cancel")}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl bg-[var(--brand-orange)] text-black text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all"
          >
            {t("engineering.permissions.confirmChanges")}
          </button>
        </div>
      </div>
    </div>
  );
}

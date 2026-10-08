/**
 * The profile picker, which replaced the side list.
 *
 * Cut out of src/components/permissions/permission-center/AccessProfilesView.js
 * as-is: the panel keeps every state value and every write, and hands this block
 * what it reads through `ctx`. The names it needs are listed in the signature —
 * nothing else.
 */

"use client";
export default function ProfilePicker({ ctx }) {
  const {
    handleProfilePick,
    profiles,
    selectedProfile,
    t,
  } = ctx;

  return (
    <>
      {/* Champ déroulant des profils — remplace l'ancienne liste latérale */}
      <div className="ios-card !p-5 border-[var(--border-primary)] space-y-2">
        <label
          htmlFor="access-profile-picker"
          className="block text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]"
        >
          {t("engineering.permissions.profilePickerLabel")}
        </label>
        <select
          id="access-profile-picker"
          value={selectedProfile ? String(selectedProfile.id) : ""}
          onChange={handleProfilePick}
          className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-brand-orange/50 focus-visible:ring-2 focus-visible:ring-brand-orange/40"
        >
          <option value="">{t("engineering.permissions.selectProfileOption")}</option>
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.name}
              {!profile.is_active
                ? ` — ${t("engineering.permissions.disabled")}`
                : ""}
            </option>
          ))}
        </select>
        <p className="text-[10px] font-bold text-[var(--text-secondary)]">
          {profiles.length === 0
            ? t("engineering.permissions.noAccessProfilesHint")
            : t("engineering.permissions.profilePickerHint")}
        </p>
      </div>
    </>
  );
}

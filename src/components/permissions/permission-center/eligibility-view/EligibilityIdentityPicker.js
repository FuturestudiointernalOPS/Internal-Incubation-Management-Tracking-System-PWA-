"use client";

/**
 * IDENTITY PICKER — the filter bar above the editor, extracted from
 * `EligibilityView.js`: the role/group type switch and the identity dropdown.
 *
 * Purely presentational: the view keeps `identityType`, `identityValue` and
 * their setters, and hands the resolved identity list over.
 *
 * Split out verbatim, behaviour identical.
 */

export default function EligibilityIdentityPicker({
  t,
  identityType,
  setIdentityType,
  setIdentityValue,
  identityValue,
  identities,
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1.5">
          {t("engineering.permissions.eligibilityIdentityType")}
        </p>
        <div className="flex gap-1 bg-secondary rounded-xl p-1 border border-[var(--border-primary)] w-fit">
          {["role", "group"].map((type) => (
            <button
              key={type}
              onClick={() => {
                setIdentityType(type);
                setIdentityValue("");
              }}
              className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${identityType === type ? "bg-[var(--brand-orange)] text-black" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
            >
              {type === "role"
                ? t("engineering.permissions.eligibilityRole")
                : t("engineering.permissions.eligibilityGroup")}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 min-w-[200px]">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1.5">
          {t("engineering.permissions.eligibilityIdentity")}
        </p>
        <select
          value={identityValue}
          onChange={(event) => setIdentityValue(event.target.value)}
          className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-orange)]"
        >
          <option value="">
            {t("engineering.permissions.eligibilitySelectIdentity")}
          </option>
          {identities.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

"use client";

/**
 * ELIGIBILITY MATRIX — the roles × features criteria table, extracted verbatim
 * from `EligibilityView.js`.
 *
 * One row per baseline role and (Phase D) per profile, one column per feature,
 * each cell a tri-state verdict (eligible / denied / unset) that opens the
 * identity editor on tap. The wide table is paired with the card layout below
 * md; both read the same `stateFor(kind, value, feature)` lookup the view
 * resolved, so the two can never disagree.
 *
 * Purely presentational — the state, the reads and the handlers stay in the
 * view.
 */

export default function EligibilityMatrix({
  t,
  data,
  matrixRoles,
  matrixProfiles,
  isDatabaseRole,
  stateFor,
  setIdentityType,
  setIdentityValue,
  setViewMode,
}) {
  // One list for both identity kinds, so the table and the cards render the
  // same rows in the same order.
  const rows = [
    ...(matrixRoles || []).map((value) => ({
      kind: "role",
      value,
      tag: isDatabaseRole(value)
        ? t("engineering.permissions.databaseRoleTag")
        : null,
    })),
    ...(matrixProfiles || []).map((value) => ({
      kind: "profile",
      value,
      tag: t("engineering.permissions.eligibilityProfileTag"),
    })),
  ];

  const openEditor = (row) => {
    setIdentityType(row.kind);
    setIdentityValue(row.value);
    setViewMode("identity");
  };

  return (
    <div className="ios-card !p-0 border-[var(--border-primary)] overflow-hidden">
      <div className="p-3 bg-secondary border-b border-[var(--border-primary)]">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-primary)]">
          {t("engineering.permissions.eligibilityMatrixTitle")}
        </p>
        <p className="text-[10px] font-bold text-[var(--text-secondary)] mt-0.5">
          {t("engineering.permissions.eligibilityMatrixHint")}
        </p>
      </div>
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-[var(--border-primary)]">
              <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] sticky left-0 bg-secondary">
                {t("engineering.permissions.eligibilityIdentity")}
              </th>
              {(data.features || []).map((featureKey) => (
                <th
                  key={featureKey}
                  className="px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] whitespace-nowrap"
                >
                  {featureKey}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={`${row.kind}:${row.value}`}
                className="border-b border-[var(--border-primary)] last:border-0"
              >
                <td className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-primary)] sticky left-0 bg-secondary">
                  {row.value}
                  {row.tag && (
                    <span className="ml-1 text-[8px] font-black uppercase tracking-widest text-teal-400">
                      {row.tag}
                    </span>
                  )}
                </td>
                {(data.features || []).map((featureKey) => {
                  const state = stateFor(row.kind, row.value, featureKey);
                  return (
                    <td key={featureKey} className="px-2 py-1.5 text-center">
                      <button
                        onClick={() => openEditor(row)}
                        title={state.title}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${state.className}`}
                      >
                        {state.label}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Small screens: one card per identity, one chip per feature — the
          same tap opens the same identity editor. */}
      <div className="md:hidden divide-y divide-divider/50">
        {rows.map((row) => (
          <div key={`${row.kind}:${row.value}`} className="p-3 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-primary)]">
              {row.value}
              {row.tag && (
                <span className="ml-1 text-[8px] font-black uppercase tracking-widest text-teal-400">
                  {row.tag}
                </span>
              )}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(data.features || []).map((featureKey) => {
                const state = stateFor(row.kind, row.value, featureKey);
                return (
                  <button
                    key={featureKey}
                    onClick={() => openEditor(row)}
                    title={state.title}
                    className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border border-transparent text-left ${state.className}`}
                  >
                    <span className="block text-[9px] tracking-widest opacity-70">
                      {featureKey}
                    </span>
                    <span>{state.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

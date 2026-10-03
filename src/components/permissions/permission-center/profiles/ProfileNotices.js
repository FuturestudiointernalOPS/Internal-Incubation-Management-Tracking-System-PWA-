/**
 * The three notices: done, failed, and the eligibility refusals.
 *
 * Cut out of src/components/permissions/permission-center/AccessProfilesView.js
 * as-is: the panel keeps every state value and every write, and hands this block
 * what it reads through `ctx`. The names it needs are listed in the signature —
 * nothing else.
 */

"use client";
export default function ProfileNotices({ ctx }) {
  const {
    actionError,
    actionMsg,
    saveViolations,
    t,
  } = ctx;

  return (
    <>
      {actionMsg && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <p className="text-[10px] font-bold text-emerald-400">{actionMsg}</p>
        </div>
      )}
      {actionError && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
          <p className="text-[10px] font-bold text-red-400">{actionError}</p>
        </div>
      )}
      {saveViolations && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-400">
            {t("engineering.permissions.ineligibleCapsTitle")}
          </p>
          {saveViolations.role && (
            <p className="text-[10px] font-bold text-[var(--text-primary)]">
              {t("engineering.permissions.ineligibleCapsRole", {
                role: saveViolations.role,
              })}
            </p>
          )}
          <ul className="flex flex-wrap gap-1.5">
            {[
              ...new Set(
                saveViolations.violations.map(
                  (violation) => `${violation.module}.${violation.capability} → ${violation.feature}`,
                ),
              ),
            ].map((line) => (
              <li
                key={line}
                className="text-[10px] font-bold px-2 py-1 rounded-lg bg-primary border border-[var(--border-primary)] text-[var(--text-secondary)]"
              >
                {line}
              </li>
            ))}
          </ul>
          <p className="text-[10px] font-bold text-[var(--text-secondary)]">
            {t("engineering.permissions.ineligibleCapsHint")}
          </p>
        </div>
      )}
    </>
  );
}

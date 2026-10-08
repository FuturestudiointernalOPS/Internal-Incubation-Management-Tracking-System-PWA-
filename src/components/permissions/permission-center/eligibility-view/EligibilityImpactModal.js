"use client";

/**
 * IMPACT MODAL — the C2 confirmation dialog extracted from
 * `EligibilityView.js`.
 *
 * When a downgrade would strand capabilities that role-default templates still
 * grant, nothing is persisted and this dialog lists the impacted templates so
 * the admin can confirm explicitly. The view keeps `pendingImpacts`, the
 * `save()` write and `saving`; the dialog only renders them.
 *
 * Split out verbatim, behaviour identical.
 */

export default function EligibilityImpactModal({
  t,
  pendingImpacts,
  setPendingImpacts,
  save,
  saving,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.7)" }}
        onClick={() => setPendingImpacts(null)}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-lg rounded-2xl p-6 shadow-2xl max-h-[80vh] overflow-y-auto"
        style={{
          background: "var(--surface-1)",
          border: "1px solid var(--border-primary)",
        }}
      >
        <h4
          className="text-sm font-black uppercase tracking-tight"
          style={{ color: "var(--text-primary)" }}
        >
          {t("engineering.permissions.eligibilityImpactTitle")}
        </h4>
        <p
          className="text-[10px] font-bold mt-2"
          style={{ color: "var(--text-secondary)" }}
        >
          {t("engineering.permissions.eligibilityImpactHint")}
        </p>
        <div className="space-y-3 mt-4">
          {pendingImpacts.map((impact) => (
            <div
              key={`${impact.role}:${impact.feature}`}
              className="rounded-lg border p-3 space-y-1.5"
              style={{ borderColor: "var(--border-primary)" }}
            >
              <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-primary)]">
                {t("engineering.permissions.eligibilityImpactIdentity", {
                  role: impact.role,
                  feature: impact.feature,
                })}
              </p>
              {impact.templates.map((tpl) => (
                <div
                  key={tpl.id}
                  className="flex items-start justify-between gap-3"
                >
                  <span
                    className="text-[10px] font-bold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {tpl.name}
                  </span>
                  <span
                    className="text-[10px] font-mono text-right break-words"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {tpl.capabilities.join(", ")}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={() => setPendingImpacts(null)}
            className="px-4 py-2 rounded-xl bg-secondary border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-widest hover:bg-tertiary transition-all"
          >
            {t("engineering.permissions.cancel")}
          </button>
          <button
            onClick={() => save(true)}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-[var(--brand-orange)] text-black text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-40"
          >
            {t("engineering.permissions.eligibilityImpactConfirm")}
          </button>
        </div>
      </div>
    </div>
  );
}

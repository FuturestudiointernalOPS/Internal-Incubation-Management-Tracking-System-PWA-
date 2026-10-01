"use client";

/**
 * PHASE UI-4c — a person's contextual relationships, read-only.
 *
 * Additive, per context, and read from the same assignment data the scope
 * predicates use. This is why a participant reads as a participant: the
 * identity above stays Member. A failed lookup is stated (`contextsUnavailable`)
 * rather than flattened into "no memberships".
 */
export default function PeopleContextsCard({ t, contexts = [], contextsUnavailable = [] }) {
  return (
    <div className="rounded-xl border border-[var(--border-primary)] bg-secondary/40 p-3 space-y-2">
      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
        {t("engineering.permissions.peopleContextsTitle")}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {contexts.map((context) => (
          <span
            key={`${context.type}:${context.id}`}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary border border-[var(--border-primary)]"
          >
            <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
              {t(`engineering.permissions.contextKind_${context.type}`)}
            </span>
            <span className="text-[10px] font-bold text-[var(--text-primary)]">
              {context.label}
            </span>
            <span className="text-[9px] font-black uppercase tracking-widest text-[var(--brand-orange)]">
              {String(context.role).replace(/_/g, " ")}
            </span>
            <span className="text-[9px] font-mono text-[var(--text-secondary)] opacity-70">
              {context.scopePolicy}
            </span>
            {!context.scopeImplemented && (
              <span className="text-[9px] font-black uppercase tracking-widest text-amber-400">
                {t("engineering.permissions.contextPending")}
              </span>
            )}
          </span>
        ))}
        {contexts.length === 0 && (
          <span className="text-[10px] font-bold text-[var(--text-secondary)]">
            {t("engineering.permissions.peopleContextsNone")}
          </span>
        )}
      </div>
      {contextsUnavailable.length > 0 && (
        <p className="text-[10px] font-bold text-amber-400">
          {t("engineering.permissions.peopleContextsPartial", {
            kinds: contextsUnavailable.join(", "),
          })}
        </p>
      )}
      <p className="text-[10px] font-bold text-[var(--text-secondary)] opacity-70">
        {t("engineering.permissions.peopleContextsNote")}
      </p>
    </div>
  );
}

"use client";

import { Loader2, UserX } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * §6 — external assignments are NOT an error. The plan is complete without
 * these people ever becoming members; adding them is an option, not a repair.
 *
 * `externalPeople` is derived from the working copy in the parent, so resolving
 * a name updates this list on the spot. The email lookup state, the handlers
 * that link an existing member or add-and-invite, and the shared input class
 * all stay in the parent (`PlanReview`) and arrive here as props.
 */
export default function ExternalOwnerResolver({
  externalPeople,
  resolving,
  emailValid,
  lookup,
  typedEmail,
  inviting,
  inputClass,
  setResolving,
  linkExisting,
  addAndInvite,
}) {
  const { t } = useI18n();

  return (
    <>
      {externalPeople.length > 0 && (
        <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-3">
          <p className="text-[9px] font-black uppercase tracking-widest text-sky-400 flex items-center gap-1.5">
            <UserX className="w-3.5 h-3.5" />
            {t("venture.planImport.externalDetected", { n: externalPeople.length })}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">{t("venture.planImport.externalDetectedHint")}</p>

          <ul className="mt-2 space-y-2">
            {externalPeople.map((entry) => {
              const isOpen = resolving?.name === entry.name;
              // Derived, never stored: an address with no answer yet is simply
              // "still checking", so there is no window in which a row shows a
              // verdict it has not actually received.
              const state = !isOpen || !emailValid ? "idle" : lookup.email === typedEmail ? lookup.state : "searching";
              return (
                <li key={entry.name} className="rounded-lg border border-[var(--border-primary)] p-2 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-bold text-[var(--text-primary)]">{entry.name}</span>
                    <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-white/5 text-slate-400">
                      {t("venture.planImport.externalBadge")}
                    </span>
                    <span className="text-[9px] text-slate-500">
                      {t("venture.planImport.externalAssignments", { n: entry.count })}
                    </span>
                  </div>

                  {/* ONE field. The address decides which of the two things this
                      row offers — the reviewer does not have to know first. */}
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="email"
                      value={isOpen ? resolving.email || "" : ""}
                      onChange={(event) => setResolving({ name: entry.name, email: event.target.value })}
                      placeholder={t("venture.planImport.emailLookupPlaceholder")}
                      className={`${inputClass} flex-1 min-w-[200px]`}
                    />

                    {state === "searching" && (
                      <span className="text-[9px] text-slate-400 flex items-center gap-1.5">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        {t("venture.planImport.checkingEmail")}
                      </span>
                    )}
                    {state === "member" && (
                      <span className="text-[9px] font-bold text-emerald-400">
                        {t("venture.planImport.emailIsMember", { name: lookup.contact?.name || "" })}
                      </span>
                    )}
                    {state === "new" && (
                      <span className="text-[9px] font-bold text-amber-400">
                        {t("venture.planImport.emailNotMember")}
                      </span>
                    )}
                    {state === "error" && (
                      <span className="text-[9px] font-bold text-rose-400">
                        {t("venture.planImport.lookupFailed")}
                      </span>
                    )}

                    {state === "member" && (
                      <button
                        type="button"
                        onClick={() => linkExisting(entry, lookup.contact)}
                        className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg bg-[var(--brand-orange)] text-black"
                      >
                        {t("venture.planImport.linkMember")}
                      </button>
                    )}
                    {state === "new" && (
                      <button
                        type="button"
                        disabled={inviting}
                        onClick={() => addAndInvite(entry.name)}
                        className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg bg-[var(--brand-orange)] text-black flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {inviting && <Loader2 className="w-3 h-3 animate-spin" />}
                        {t("venture.planImport.invitePerson")}
                      </button>
                    )}
                  </div>

                  {isOpen && <p className="text-[10px] text-slate-400">{t("venture.planImport.emailDecidesHint")}</p>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </>
  );
}

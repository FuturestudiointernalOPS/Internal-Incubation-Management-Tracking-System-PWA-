"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, Mail, MessageSquare, UserRound } from "lucide-react";
import { useApi } from "@/lib/hooks/useApi";
import { useI18n } from "@/lib/i18n";
import SectionHead from "@/components/ui/SectionHead";
import ContactLeadModal from "./ContactLeadModal";

/**
 * "YOUR VENTURE LEAD" — the people a founder can actually reach.
 *
 * Reads GET /api/ventures/[id]/support, which resolves the Venture's STAFF
 * ASSIGNMENTS (never the coached catalogue). Everything it prints is what the
 * server returned: which name, which responsibility, which address, whether that
 * address is usable, and whether the assignment is current.
 *
 * THREE STATES, NEVER CONFUSED
 *   loading  — the read has not answered;
 *   failed   — it answered nothing: say so, offer a retry, never show an empty
 *              roster as though the Venture had no support at all;
 *   empty    — it answered, and nobody was ever assigned.
 *
 * A removed lead stays visible (decision 7): if no active lead exists, the most
 * recently removed one is shown in the lead position and LABELLED as no longer
 * assigned; once a replacement exists, the former lead moves into the collapsed
 * "Previous support" list.
 */

const pickSupport = (payload) => (payload?.success ? payload.support || null : null);

function Initial({ name }) {
  const letter = String(name || "").trim().charAt(0).toUpperCase();
  return (
    <span
      className="grid place-items-center w-9 h-9 rounded-full shrink-0 text-[13px] font-black"
      style={{ background: "var(--surface-3)", color: "var(--brand-orange)" }}
      aria-hidden="true"
    >
      {letter || <UserRound size={15} />}
    </span>
  );
}

function PersonRow({ person, primary, onContact }) {
  const { t } = useI18n();
  const unassigned = primary && !person.active;

  return (
    <div className="flex items-start gap-3 py-2.5 border-b last:border-0" style={{ borderColor: "var(--border-primary)" }}>
      <Initial name={person.name} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold">{person.name || t("venture.support.unnamed")}</span>
          {primary && person.is_primary && (
            <span className="stf-tag o">{t("venture.support.primary")}</span>
          )}
          {unassigned && <span className="stf-tag r">{t("venture.support.noLongerAssigned")}</span>}
          {person.responsibility_label && <span className="stf-tag">{person.responsibility_label}</span>}
        </div>
        {person.email ? (
          <a
            href={`mailto:${person.email}`}
            className="mt-0.5 inline-flex items-center gap-1 text-[11px] break-all"
            style={{ color: "var(--text-secondary)" }}
          >
            <Mail size={11} /> {person.email}
          </a>
        ) : (
          <p className="mt-0.5 flex items-center gap-1 text-[11px]" style={{ color: "var(--stf-warn)" }}>
            <AlertTriangle size={11} /> {t("venture.support.noEmail")}
          </p>
        )}
      </div>
      {primary && onContact && person.active && (
        <button type="button" className="stf-btn" onClick={onContact}>
          <MessageSquare size={13} /> {t("venture.support.contact")}
        </button>
      )}
    </div>
  );
}

export default function VentureSupportCard({ ventureId }) {
  const { t } = useI18n();
  const [contacting, setContacting] = useState(false);
  const [showFormer, setShowFormer] = useState(false);

  const { data, loading, error, status, refresh } = useApi(
    ventureId ? `/api/ventures/${ventureId}/support` : null,
    { deps: [ventureId], defaultValue: null, transform: pickSupport },
  );

  const failed = Boolean(error) || (status !== null && status >= 400);
  const primary = data?.primary || null;
  const others = (data?.current || []).filter(
    (person) => !primary || String(person.id) !== String(primary.id),
  );
  const former = data?.former || [];
  const canContact = Boolean(
    primary?.active && (data?.current || []).some((person) => person.reachable),
  );

  return (
    <section className="stf-card">
      <SectionHead
        icon={UserRound}
        title={t("venture.support.title")}
        subtitle={t("venture.support.subtitle")}
      />

      {failed ? (
        <div className="stf-empty">
          <AlertTriangle size={22} />
          <p className="font-semibold">{t("venture.support.loadFailed")}</p>
          <p>{t("venture.support.loadFailedHint")}</p>
          <button type="button" className="stf-link-btn mt-2" onClick={() => refresh()}>
            {t("common.retry")}
          </button>
        </div>
      ) : loading && !data ? (
        <p className="stf-empty">{t("common.loading")}</p>
      ) : !primary && others.length === 0 ? (
        <div className="stf-empty">
          <UserRound size={22} />
          <p className="font-semibold">{t("venture.support.empty")}</p>
          <p>{t("venture.support.emptyHint")}</p>
        </div>
      ) : (
        <div>
          {primary && (
            <PersonRow
              person={primary}
              primary
              onContact={canContact ? () => setContacting(true) : null}
            />
          )}

          {!primary && (
            <p className="text-xs py-2" style={{ color: "var(--text-secondary)" }}>
              {t("venture.support.noLead")}
            </p>
          )}

          {others.length > 0 && (
            <>
              <p className="stf-k mt-3 mb-1">{t("venture.support.alsoSupporting")}</p>
              {others.map((person) => (
                <PersonRow key={person.id} person={person} />
              ))}
            </>
          )}

          {former.length > 0 && (
            <div className="mt-3">
              <button
                type="button"
                className="stf-link-btn inline-flex items-center gap-1"
                onClick={() => setShowFormer((open) => !open)}
                aria-expanded={showFormer}
              >
                {showFormer ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                {t("venture.support.previous", { count: former.length })}
              </button>
              {showFormer && (
                <div className="mt-1">
                  {former.map((person) => (
                    <PersonRow key={person.id} person={person} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {contacting && (
        <ContactLeadModal
          ventureId={ventureId}
          leadName={primary?.name || null}
          onClose={() => setContacting(false)}
        />
      )}
    </section>
  );
}

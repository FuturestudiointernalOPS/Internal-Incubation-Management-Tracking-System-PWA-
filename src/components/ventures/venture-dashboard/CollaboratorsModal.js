"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, Mail, Plus } from "lucide-react";
import { useApi } from "@/lib/hooks/useApi";
import { useI18n } from "@/lib/i18n";
import AppModal from "@/components/ui/AppModal";
import { useAssigneeEmail } from "@/components/ventures/projects/useAssigneeEmail";

/**
 * The Venture's COLLABORATORS — the people its work names, the same list as the
 * Project page's People section. A person who has an address shows it; one who
 * has none gets an "Add email" button, so whoever manages the Venture can give
 * each of them one without leaving the dashboard.
 *
 * Adding an address records it against the NAME only: no account, membership or
 * access is created (see `useAssigneeEmail`).
 */
export default function CollaboratorsModal({ ventureId, isOpen, onClose }) {
  const { t } = useI18n();
  const { data, loading, error, refresh } = useApi(
    isOpen && ventureId ? `/api/ventures/${ventureId}/people` : null,
    { deps: [ventureId, isOpen], defaultValue: null },
  );
  const { addEmail, savingName } = useAssigneeEmail(ventureId);
  // Addresses saved from this dialog, shown at once: the server stores one in a
  // few seconds, and the list read that follows takes as long again.
  const [saved, setSaved] = useState({});

  if (!isOpen) return null;
  const people = (Array.isArray(data?.people) ? data.people : []).map((person) =>
    !person.email && saved[person.name] ? { ...person, email: saved[person.name] } : person,
  );
  const withoutEmail = people.filter((person) => !person.email).length;

  return (
    <AppModal isOpen onClose={onClose} title={t("vadmin.dashboard.collaborators.title")} size="lg">
      <div className="space-y-4">
        <p className="text-[13px] text-[var(--text-secondary)]">{t("vadmin.dashboard.collaborators.subtitle")}</p>

        {/* Only the first read replaces the list: a refresh after a save keeps it on screen. */}
        {loading && !data ? (
          <p className="text-[13px] text-[var(--text-secondary)]">{t("common.loading")}</p>
        ) : error ? (
          <p className="text-[13px] text-rose-400">{t("venture.people.loadFailed")}</p>
        ) : people.length === 0 ? (
          <p className="text-[13px] text-[var(--text-secondary)]">{t("venture.people.empty")}</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <span className="stf-tag">{t("venture.people.statTotal", { count: people.length })}</span>
              <span className={`stf-tag ${withoutEmail > 0 ? "o" : "g"}`}>
                {t("vadmin.dashboard.collaborators.withoutEmail", { count: withoutEmail })}
              </span>
            </div>
            <div className="space-y-2">
              {people.map((person) => (
                <div key={person.name} className="jy-drow" style={{ flexWrap: "wrap" }}>
                  <div className="flex-1 min-w-[160px]">
                    <p className="font-semibold text-[var(--text-primary)] break-words">{person.name}</p>
                    <span className="mt-1 flex flex-wrap gap-1">
                      {(person.roles || []).map((role) => (
                        <span key={role} className="stf-tag">{t(`venture.reminders.role.${role}`)}</span>
                      ))}
                    </span>
                  </div>
                  {person.email ? (
                    <span className="flex items-center gap-1 text-[13px] text-[var(--text-primary)] break-all">
                      <Mail className="w-3.5 h-3.5 shrink-0" /> {person.email}
                    </span>
                  ) : (
                    <>
                      <span className="flex items-center gap-1 text-[12px] font-bold text-[var(--stf-warn)]">
                        <AlertTriangle className="w-3.5 h-3.5" /> {t("vadmin.dashboard.collaborators.noEmail")}
                      </span>
                      <button
                        type="button"
                        className="stf-btn sm pr"
                        disabled={savingName === person.name}
                        onClick={() =>
                          addEmail(person.name, {
                            onDone: (email) => {
                              setSaved((previous) => ({ ...previous, [person.name]: email }));
                              refresh();
                            },
                          })
                        }
                      >
                        {savingName === person.name ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}{" "}
                        {savingName === person.name ? t("venture.saving") : t("vadmin.dashboard.collaborators.addEmail")}
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </AppModal>
  );
}

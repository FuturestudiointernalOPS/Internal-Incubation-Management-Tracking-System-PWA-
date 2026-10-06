"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { defer } from "./effectUtils";
import PersonPicker from "./PersonPicker";
import PeopleView from "./PeopleView";
import PersonRecentChanges from "./PersonRecentChanges";
import ProfileAssignmentsSection from "./permission-center/person-access/ProfileAssignmentsSection";
import PermissionManager from "./PermissionCenter";

/**
 * PHASE UI-3e — Individual Access, ONE screen.
 *
 * One picker, one person, two panels answering different questions about the
 * SAME selection:
 *   1. what this person can do, and why (sources → effective, with the drawer)
 *   2. how to change it (levels, profile override, Super Admin promotion)
 *
 * Before this, the two lenses were separate sub-tabs with their own searches:
 * finding a person in one did not help you in the other, and the only link
 * between them was a button that navigated away.
 *
 * The selection lives in `?cid=`, so it is shareable, survives a reload, and
 * keeps the Membership Control Center's "View Effective Access" deep links
 * working unchanged.
 *
 * UI-7: stacked instead of two columns. The picker is a dropdown on its own
 * row, so the person's panels — the reason the screen exists — get the full
 * width instead of two thirds of it.
 *
 * The selected-person area reads top to bottom as the questions an admin asks:
 *   1. WHO — identity header (name, role, groups)
 *   2. WHICH FUNCTION — profiles held, and the control to attribute one
 *   3. WHAT THEY CAN DO — contexts, scope, source matrix (read)
 *   4. CHANGE IT — the editor (write)
 *   5. WHAT CHANGED LATELY — the recent-changes log
 */
export default function IndividualAccessScreen() {
  const { t } = useI18n();
  const [person, setPerson] = useState(null);
  // Bumped by PeopleView after an in-place grant/revoke. The two panels read
  // the same rows through different endpoints, so without this the matrix below
  // would keep showing the access the person had a moment ago.
  const [accessVersion, setAccessVersion] = useState(0);
  const onAccessChanged = useCallback(
    () => setAccessVersion((prev) => prev + 1),
    [],
  );
  // The "Replace access profile" dialog is opened from the profiles bar (top)
  // but its flow lives in the editor, so a plain signal crosses the two.
  const [overrideOpen, setOverrideOpen] = useState(false);

  // Deep link on first paint. Deferred: an effect must not write state
  // synchronously (project convention: ./effectUtils).
  useEffect(() => {
    defer(() => {
      try {
        const cid = new URLSearchParams(window.location.search).get("cid");
        if (cid) setPerson({ cid });
      } catch {
        /* no deep link — start empty */
      }
    });
  }, []);

  const pick = useCallback((user) => {
    setPerson(user);
    setOverrideOpen(false); // a new person starts with nothing open
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("cid", user.cid);
      window.history.replaceState(null, "", url);
    } catch {
      /* cosmetic: the panels already follow the in-memory selection */
    }
  }, []);

  return (
    <div className="space-y-5">
      <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
        {t("authorization.people.hint")}
      </p>

      <PersonPicker selectedCid={person?.cid} onSelect={pick} />

      {person ? (
        <div className="space-y-6">
          <PeopleView
            person={person}
            onAccessChanged={onAccessChanged}
            profilesSlot={
              <ProfileAssignmentsSection
                key={`profiles-${person.cid}`}
                cid={person.cid}
                onReplaceProfile={() => setOverrideOpen(true)}
              />
            }
          />
          <PermissionManager
            key={`access-editor-${accessVersion}`}
            cid={person.cid}
            initialTab="search"
            overrideOpen={overrideOpen}
            onOverrideClose={() => setOverrideOpen(false)}
          />
          <PersonRecentChanges key={`recent-${person.cid}`} person={person} />
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--surface-1)] p-6 text-center shadow-sm">
          <p className="text-sm font-medium text-[var(--text-secondary)]">
            {t("authorization.people.selectPrompt")}
          </p>
        </div>
      )}
    </div>
  );
}

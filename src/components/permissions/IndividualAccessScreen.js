"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { defer } from "./effectUtils";
import PersonPicker from "./PersonPicker";
import PeopleView from "./PeopleView";
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
 */
export default function IndividualAccessScreen() {
  const { t } = useI18n();
  const [person, setPerson] = useState(null);

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

  const pick = useCallback((u) => {
    setPerson(u);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("cid", u.cid);
      window.history.replaceState(null, "", url);
    } catch {
      /* cosmetic: the panels already follow the in-memory selection */
    }
  }, []);

  return (
    <div className="space-y-4">
      <p className="text-xs font-medium text-[var(--text-secondary)]">
        {t("engineering.permissions.peopleHint")}
      </p>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-4">
        <PersonPicker selectedCid={person?.cid} onSelect={pick} />

        <div className="space-y-4">
          {person ? (
            <>
              <PeopleView person={person} />
              <PermissionManager cid={person.cid} initialTab="search" />
            </>
          ) : (
            <p className="text-xs font-bold text-[var(--text-secondary)]">
              {t("engineering.permissions.peopleSelectPrompt")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

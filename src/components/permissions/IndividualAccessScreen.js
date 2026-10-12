"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";
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
 * One picker, one person, and the questions an admin asks about them, in order:
 *   1. WHO — identity header (name, role · profile)
 *   2. HOW MUCH — the access summary (live counts)
 *   3. WHAT — the permission matrix, by module (read)
 *   4. WHY — the "why this access?" drawer, opened per capability
 *   5. CHANGE IT — the editor (levels, profile override, exceptions)
 *   6. WHAT CHANGED LATELY — the access history timeline
 *
 * The selection lives in `?cid=`, so it is shareable, survives a reload, and
 * keeps the Membership Control Center's "View Effective Access" deep links
 * working unchanged. The section bar under the picker is a navigation aid over
 * ONE page: it scrolls to a section rather than hiding the others, so nothing
 * important is a click away.
 */
const SECTIONS = [
  { id: "person-section-permissions", key: "engineering.permissions.accessNavPermissions" },
  { id: "person-section-scope", key: "engineering.permissions.accessNavScope" },
  { id: "person-section-exceptions", key: "engineering.permissions.accessNavExceptions" },
  { id: "person-section-history", key: "engineering.permissions.accessNavHistory" },
];

export default function IndividualAccessScreen() {
  const { t } = useI18n();
  const router = useRouter();
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

  const jumpTo = useCallback((id) => {
    try {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch {
      /* navigation aid only — the section is on the page either way */
    }
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
          {t("authorization.people.hint")}
        </p>
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-primary)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          {t("engineering.permissions.accessBack")}
        </button>
      </div>

      <PersonPicker selectedCid={person?.cid} onSelect={pick} />

      {person ? (
        <div className="space-y-6">
          {/* Section navigation — a jump bar over ONE page, not tabs that hide
              the other sections. */}
          <nav
            aria-label={t("engineering.permissions.accessNavAria")}
            className="flex flex-wrap items-center gap-1.5 border-b border-[var(--border-primary)] pb-3"
          >
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => jumpTo(section.id)}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60"
              >
                <ChevronRight className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
                {t(section.key)}
              </button>
            ))}
          </nav>

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

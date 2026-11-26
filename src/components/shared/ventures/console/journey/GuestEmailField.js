"use client";

import React, { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";

/**
 * GUEST ADDRESSES — the people ImpactOS already knows, offered as you type.
 *
 * The field stays a plain comma-separated list, because a guest does not need
 * an account: an external coach or a partner is invited by address alone. What
 * the picker adds is the other case — when the address typed IS someone in the
 * directory, the suggestion shows that person, so the booking carries the
 * address the database holds (which is how the session also reaches their own
 * calendar) instead of a near-miss that would reach an inbox and nothing else.
 *
 * Only the token being typed is looked up, and a failed lookup never blocks
 * typing: the field is always usable by hand.
 */
export default function GuestEmailField({ value, onChange, className }) {
  const { t } = useI18n();
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  // The token after the last comma is the one being written.
  const currentToken = String(value || "").split(",").pop().trim();

  useEffect(() => {
    if (currentToken.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    let alive = true;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/people/search?q=${encodeURIComponent(currentToken)}`,
        );
        const data = await res.json();
        if (!alive || !data.success) return;
        // An address typed in full is not a suggestion — it is the answer.
        const people = (data.people || []).filter(
          (person) =>
            String(person.email || "").toLowerCase() !== currentToken.toLowerCase(),
        );
        setSuggestions(people);
        setOpen(people.length > 0);
      } catch {
        /* a failed lookup never blocks typing */
      }
    }, 200);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [currentToken]);

  // Clicking anywhere else closes the list.
  useEffect(() => {
    const onDown = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const pick = (email) => {
    const parts = String(value || "").split(",");
    parts[parts.length - 1] = ` ${email}`;
    // Keep the trailing separator so the next address can be typed straight away.
    onChange(`${parts.join(",").replace(/^\s+/, "")}, `);
    setOpen(false);
    setSuggestions([]);
  };

  return (
    <div className="relative" ref={wrapRef}>
      <input
        type="text"
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t("venture.manager.inviteGuestsPlaceholder")}
        className={className}
      />
      {open && (
        <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-52 overflow-y-auto rounded-lg border border-[var(--border-primary)] bg-[var(--surface-1)] shadow-lg">
          {suggestions.map((person) => (
            <li key={person.cid || person.email}>
              <button
                type="button"
                onClick={() => pick(person.email)}
                className="w-full text-left px-2.5 py-1.5 hover:bg-[var(--surface-3)] transition-colors"
              >
                <span className="block truncate text-xs text-[var(--text-primary)]">
                  {person.name || person.email}
                </span>
                <span className="block truncate text-[10px] text-[var(--text-secondary)]">
                  {person.email}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

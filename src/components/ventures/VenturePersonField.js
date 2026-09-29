"use client";

import React, { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { UserX, X } from "lucide-react";

/**
 * VenturePersonField — ONE control for "who is responsible", across the Venture.
 *
 * An assignment is a platform member OR a name, and this is the only control that
 * expresses both:
 *
 *   a member  — what was typed matches a contact, so we carry their cid
 *   a name    — it matches nobody, and it stays an EXTERNAL assignment
 *
 * It NEVER invents an identity. A name only becomes a member when it matches a
 * contact the platform already has, and this control never creates one. Adding a
 * real person is a deliberate act somewhere else — Name + Email + Phone, invited
 * by email — because a typed name is not a reason to open an account.
 *
 * A name that matches nobody shows an "External" badge. That is a COMPLETE,
 * legitimate state, not an error to be cleared: the Venture can track a
 * consultant, a lawyer or a vendor without them ever having an account.
 *
 * It is deliberately one component rather than a field per screen. Four screens
 * with four pickers would drift, and a screen that disagrees with the one beside
 * it is worse than no picker at all.
 */
export default function VenturePersonField({
  value = {},
  onChange,
  disabled = false,
  placeholder,
  listId = "venture-person-options",
}) {
  const { t } = useI18n();
  const [options, setOptions] = useState([]);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const search = (text) => {
    clearTimeout(timer.current);
    const query = String(text || "").trim();
    if (query.length < 2) {
      setOptions([]);
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/contacts/search?q=${encodeURIComponent(query)}`);
        const payload = await res.json().catch(() => ({}));
        setOptions(payload.success ? payload.contacts || [] : []);
      } catch (_) {
        setOptions([]);
      }
    }, 300);
  };

  /** Only an EXACT match of a name or email makes someone a platform member.
   *  Anything else stays a name — the machine never chooses between two people
   *  who share one. */
  const matchContact = (text) => {
    const clean = String(text || "").trim().toLowerCase();
    if (!clean) return null;
    return (
      options.find(
        (contact) =>
          String(contact.name || "").toLowerCase() === clean ||
          String(contact.email || "").toLowerCase() === clean,
      ) || null
    );
  };

  const handleTyping = (text) => {
    search(text);
    const contact = matchContact(text);
    onChange?.({ name: text || null, cid: contact ? contact.cid : null });
  };

  const name = value.name || "";
  const isMember = Boolean(value.cid);

  const fieldClass =
    "w-full px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-[11px] text-[var(--text-primary)]";

  return (
    <span className="inline-flex flex-col gap-1 w-full">
      <span className="inline-flex items-center gap-1.5">
        <input
          list={listId}
          value={name}
          disabled={disabled}
          onChange={(event) => handleTyping(event.target.value)}
          placeholder={placeholder || t("venture.personField.placeholder")}
          className={fieldClass}
        />
        {name && !disabled && (
          <button
            type="button"
            aria-label={t("venture.personField.clear")}
            onClick={() => {
              setOptions([]);
              onChange?.({ name: null, cid: null });
            }}
            className="shrink-0 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </span>

      {name && (
        <span
          className={`self-start text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded flex items-center gap-1 ${
            isMember ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
          }`}
        >
          {!isMember && <UserX className="w-2.5 h-2.5" />}
          {t(isMember ? "venture.personField.member" : "venture.personField.external")}
        </span>
      )}

      <datalist id={listId}>
        {options.map((contact) => (
          <option key={contact.cid} value={contact.name || contact.email}>
            {contact.email}
          </option>
        ))}
      </datalist>
    </span>
  );
}

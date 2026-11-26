"use client";

import React, { useEffect, useRef, useState } from "react";
import { Check, Loader2, Mail, Search, UserX } from "lucide-react";
import AppModal from "@/components/ui/AppModal";
import AppInput from "@/components/ui/AppInput";
import AppButton from "@/components/ui/AppButton";
import { useI18n } from "@/lib/i18n";
import { useDialogs } from "@/components/ui/DialogProvider";

/**
 * "WHO IS THIS NAME?" — the one question the People screen asks.
 *
 * The name is FIXED: it is what the tracker wrote, and identifying it never
 * rewrites it. All this control does is find the person it refers to, among the
 * people the platform already knows. It cannot create one — a name in a tracker
 * is not a reason to open an account — so a search that finds nobody simply ends
 * with the name left unidentified, which is a complete and legitimate state.
 *
 * Only a real match, chosen by a human, is ever returned: two people may share a
 * name, and this control never guesses between them.
 */
export default function IdentifyPersonModal({ ventureId, person, onClose, onIdentified }) {
  const { t } = useI18n();
  const { alert } = useDialogs();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [refused, setRefused] = useState(false);
  const [linking, setLinking] = useState(null);
  const timer = useRef(null);
  // Which answer is still wanted. A slow search that lands after a newer one is
  // discarded rather than shown, and a cleared field abandons whatever was in
  // flight — so the list can never disagree with what is typed.
  const ticket = useRef(0);

  useEffect(() => () => clearTimeout(timer.current), []);

  const runSearch = async (term) => {
    const current = (ticket.current += 1);
    setSearching(true);
    try {
      const res = await fetch(`/api/contacts/search?q=${encodeURIComponent(term)}`);
      const payload = await res.json().catch(() => ({}));
      if (ticket.current !== current) return;
      if (res.status === 403) {
        setRefused(true);
        setResults([]);
        return;
      }
      setRefused(false);
      setResults(Array.isArray(payload?.contacts) ? payload.contacts : []);
    } catch (_) {
      if (ticket.current === current) setResults([]);
    } finally {
      if (ticket.current === current) setSearching(false);
    }
  };

  const changeQuery = (value) => {
    setQuery(value);
    clearTimeout(timer.current);
    const term = value.trim();
    if (term.length < 2) {
      ticket.current += 1; // abandon any answer still on its way
      setResults([]);
      setRefused(false);
      setSearching(false);
      return;
    }
    timer.current = setTimeout(() => runSearch(term), 300);
  };

  const identify = async (contact) => {
    setLinking(String(contact.cid));
    try {
      const res = await fetch(`/api/ventures/${ventureId}/people`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "link", display_name: person.name, contact_id: contact.cid }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload?.success) {
        await alert({ message: t(payload?.error || "errors.somethingWrong"), tone: "danger" });
        return;
      }
      onIdentified?.();
      onClose?.();
    } finally {
      setLinking(null);
    }
  };

  return (
    <AppModal isOpen onClose={onClose} title={t("venture.people.pickTitle", { name: person.name })} size="md">
      <div className="space-y-4">
        <p className="text-xs text-[var(--text-secondary)]">{t("venture.people.pickMessage")}</p>

        <AppInput
          label={t("venture.people.pickSearch")}
          icon={Search}
          value={query}
          autoFocus
          placeholder={t("venture.people.pickSearchPlaceholder")}
          onChange={(event) => changeQuery(event.target.value)}
        />

        {refused ? (
          <p className="text-[10px] text-amber-400">{t("venture.people.pickRefused")}</p>
        ) : searching ? (
          <p className="text-[10px] text-[var(--text-tertiary)] flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" /> {t("common.loading")}
          </p>
        ) : query.trim().length < 2 ? (
          <p className="text-[10px] text-[var(--text-tertiary)]">{t("venture.people.pickStart")}</p>
        ) : results.length === 0 ? (
          <p className="text-[10px] text-[var(--text-tertiary)] flex items-center gap-1.5">
            <UserX className="w-3 h-3" /> {t("venture.people.pickEmpty")}
          </p>
        ) : (
          <ul className="rounded-lg border border-[var(--border-primary)] divide-y divide-[var(--border-primary)]">
            {results.map((contact) => (
              <li key={contact.cid} className="flex items-center justify-between gap-3 p-2.5">
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-[var(--text-primary)] truncate">
                    {contact.name || t("venture.people.unnamed")}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1 text-[10px] text-[var(--text-tertiary)] truncate">
                    <Mail className="w-3 h-3 shrink-0" /> {contact.email || "—"}
                  </span>
                </span>
                <AppButton
                  variant="secondary"
                  size="sm"
                  icon={linking === String(contact.cid) ? Loader2 : Check}
                  loading={linking === String(contact.cid)}
                  disabled={Boolean(linking)}
                  onClick={() => identify(contact)}
                >
                  {t("venture.people.identify")}
                </AppButton>
              </li>
            ))}
          </ul>
        )}

        <p className="text-[10px] text-[var(--text-tertiary)]">{t("venture.people.pickHint")}</p>
      </div>
    </AppModal>
  );
}

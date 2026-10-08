"use client";

import React, { useMemo, useState } from "react";
import { ChevronRight, Search, ShieldQuestion, SlidersHorizontal } from "lucide-react";
import { ALL_MODULES, PEOPLE, PERSON_BY_ID, effectiveOf, sourceOf } from "./data";
import { Btn, EmptyLine, INPUT_CLASS, Tabs } from "./ui";
import Checker from "./Checker";
import PersonDetail from "./PersonDetail";
import PersonnesSubTabs from "./PersonnesTabs";

/**
 * PERSONNES — « que peut faire cette personne, exactement ? »
 *
 * Onglets : Personnes · Groupes · Administrateurs · Par contexte.
 * La fiche personne (PersonDetail) ouvre cinq lentilles sur la même réalité.
 */
export default function Personnes({ sub, onSub, cid, onOpenPerson }) {
  const person = cid ? PERSON_BY_ID[cid] : null;

  if (person) {
    return <PersonDetail person={person} onBack={() => onOpenPerson(null)} />;
  }

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-black tracking-tight text-[var(--text-primary)]">Personnes</h1>
        <p className="text-sm text-[var(--text-secondary)]">Que peut faire cette personne, exactement ?</p>
      </header>

      <Tabs
        items={[
          { key: "personnes", label: "Personnes" },
          { key: "groupes", label: "Groupes" },
          { key: "admins", label: "Administrateurs" },
          { key: "contexte", label: "Par contexte" },
        ]}
        value={sub}
        onChange={onSub}
      />

      {sub === "personnes" ? (
        <PeopleList onOpenPerson={onOpenPerson} />
      ) : (
        <PersonnesSubTabs sub={sub} onOpenPerson={onOpenPerson} />
      )}
    </div>
  );
}

// ─── Liste des personnes ────────────────────────────────────────────────────
function PeopleList({ onOpenPerson }) {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("tous");
  const [onlyRestricted, setOnlyRestricted] = useState(false);
  const [onlyDirect, setOnlyDirect] = useState(false);
  const [checker, setChecker] = useState(false);

  const roles = useMemo(() => ["tous", ...new Set(PEOPLE.map((person) => person.roleLabel))], []);

  const rows = useMemo(
    () =>
      PEOPLE.filter((person) => (query ? person.name.toLowerCase().includes(query.toLowerCase()) : true))
        .filter((person) => (role === "tous" ? true : person.roleLabel === role))
        .filter((person) => (onlyRestricted ? Object.keys(person.sources.restrictions || {}).length > 0 : true))
        .filter((person) => (onlyDirect ? Object.keys(person.sources.grants || {}).length > 0 : true)),
    [query, role, onlyRestricted, onlyDirect],
  );

  const stats = (person) => {
    let effective = 0;
    let restricted = 0;
    let direct = 0;
    for (const mod of ALL_MODULES) {
      for (const cap of mod.caps) {
        const source = sourceOf(person.sources, mod.key, cap);
        if (person.isSuperAdmin || effectiveOf(person.sources, mod.key, cap) > 0) effective += 1;
        if (source === "Restriction") restricted += 1;
        if (source === "Direct") direct += 1;
      }
    }
    return { effective, restricted, direct };
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-tertiary)]" aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher une personne…" className={`${INPUT_CLASS} w-full pl-9`} />
        </div>
        <select value={role} onChange={(event) => setRole(event.target.value)} className={INPUT_CLASS} aria-label="Filtrer par rôle">
          {roles.map((value) => (
            <option key={value} value={value}>{value === "tous" ? "Tous les rôles" : value}</option>
          ))}
        </select>
        <Toggle active={onlyRestricted} onClick={() => setOnlyRestricted((value) => !value)} label="A des restrictions" />
        <Toggle active={onlyDirect} onClick={() => setOnlyDirect((value) => !value)} label="A des droits directs" />
        <Btn variant="primary" icon={ShieldQuestion} onClick={() => setChecker(true)}>Vérifier un accès</Btn>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--border-primary)] bg-[var(--surface-1)]">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--border-primary)] text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Rôle</th>
              <th className="px-4 py-3">Profil</th>
              <th className="px-4 py-3 text-center">Droits effectifs</th>
              <th className="px-4 py-3 text-center">Directs</th>
              <th className="px-4 py-3 text-center">Restreints</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((person) => {
              const detail = stats(person);
              return (
                <tr
                  key={person.id}
                  onClick={() => onOpenPerson(person.id)}
                  className="cursor-pointer border-b border-[var(--border-primary)]/60 transition-colors hover:bg-[var(--surface-2)]"
                >
                  <td className="px-4 py-3">
                    <p className="text-xs font-bold text-[var(--text-primary)]">{person.name}</p>
                    <p className="text-[10px] text-[var(--text-tertiary)]">{person.email}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">
                    {person.roleLabel}
                    {person.isSuperAdmin && <span className="ml-2 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-black uppercase text-amber-400">Super admin</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">{person.profile}</td>
                  <td className="px-4 py-3 text-center text-sm font-black tabular-nums text-[var(--text-primary)]">{detail.effective}</td>
                  <td className="px-4 py-3 text-center text-xs font-bold tabular-nums text-emerald-400">{detail.direct || "—"}</td>
                  <td className="px-4 py-3 text-center text-xs font-bold tabular-nums text-red-400">{detail.restricted || "—"}</td>
                  <td className="px-4 py-3 text-right text-[var(--text-tertiary)]"><ChevronRight className="ml-auto h-4 w-4" aria-hidden="true" /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <div className="px-4 py-6"><EmptyLine>Aucune personne ne correspond à ces filtres.</EmptyLine></div>}
      </div>

      <Checker open={checker} onClose={() => setChecker(false)} />
    </div>
  );
}

function Toggle({ active, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60 ${
        active ? "border-brand-orange/40 bg-brand-orange/10 text-[var(--brand-orange)]" : "border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      }`}
    >
      <SlidersHorizontal className="h-3 w-3" aria-hidden="true" />
      {label}
    </button>
  );
}

"use client";

/* eslint-disable react/no-unescaped-entities -- prototype UI is hardcoded French */

import React, { useCallback, useEffect, useState } from "react";
import { BookOpen, ChevronRight, Loader2, Moon, Search, Shield, ShieldAlert, Sun } from "lucide-react";
import { useTheme } from "@/lib/ThemeProvider";
import { Btn, InfoTip, NoteBox } from "@/components/permissions-preview/ui";
import { PermissionsProvider, usePerm } from "@/components/permissions-preview/store";
import Personnes from "@/components/permissions-preview/Personnes";
import Profils from "@/components/permissions-preview/Profils";
import Regles from "@/components/permissions-preview/Regles";
import Journal from "@/components/permissions-preview/Journal";

/**
 * CENTRE DE PERMISSIONS — prévisualisation branchée sur les données réelles.
 *
 * Aucune donnée fictive : chaque écran lit le moteur, et chaque action écrit là
 * où le centre en production écrit. Le design reste celui de la maquette.
 */

const DEFAULT_SUB = { personnes: "personnes", profils: "matrice", regles: "eligibilite", journal: "" };

const NAV = [
  { key: "personnes", label: "Personnes", icon: Shield },
  { key: "profils", label: "Profils" },
  { key: "regles", label: "Règles" },
  { key: "journal", label: "Journal" },
];

export default function PermissionsPreviewPage() {
  return (
    <PermissionsProvider>
      <Shell />
    </PermissionsProvider>
  );
}

function Shell() {
  const { resolvedTheme, toggleTheme } = useTheme();
  const { loading, error, blocked, alerts, peopleById, people, actions } = usePerm();
  const [section, setSection] = useState("personnes");
  const [sub, setSub] = useState(DEFAULT_SUB.personnes);
  const [cid, setCid] = useState(null);
  const [findOpen, setFindOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const badgeCount = alerts
    ? alerts.deadRights.length + alerts.pending.length + alerts.missingProfiles.length + alerts.expiring.length
    : 0;

  useEffect(() => {
    let alive = true;
    const read = () => {
      if (!alive) return;
      try {
        const params = new URLSearchParams(window.location.search);
        const nextSection = params.get("s");
        if (nextSection && DEFAULT_SUB[nextSection] !== undefined) {
          setSection(nextSection);
          setSub(params.get("t") || DEFAULT_SUB[nextSection]);
        }
        const nextCid = params.get("cid");
        if (nextCid) setCid(nextCid);
      } catch {
        /* pas de lien profond */
      }
    };
    const timer = setTimeout(read, 0);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);

  const syncUrl = useCallback((next) => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("s", next.section);
      url.searchParams.set("t", next.sub || "");
      if (next.cid) url.searchParams.set("cid", next.cid);
      else url.searchParams.delete("cid");
      window.history.replaceState(null, "", url);
    } catch {
      /* cosmétique */
    }
  }, []);

  const goSection = useCallback((nextSection, nextSub) => {
    const resolvedSub = nextSub ?? DEFAULT_SUB[nextSection];
    setSection(nextSection);
    setSub(resolvedSub);
    setCid(null);
    syncUrl({ section: nextSection, sub: resolvedSub, cid: null });
  }, [syncUrl]);

  const goSub = useCallback((nextSub) => {
    setSub(nextSub);
    setCid(null);
    syncUrl({ section, sub: nextSub, cid: null });
  }, [section, syncUrl]);

  const openPerson = useCallback((nextCid) => {
    setSection("personnes");
    setCid(nextCid);
    syncUrl({ section: "personnes", sub, cid: nextCid });
  }, [sub, syncUrl]);

  const go = useCallback((nextSection, nextSub) => goSection(nextSection, nextSub), [goSection]);

  useEffect(() => {
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setFindOpen((value) => !value);
      }
      if (event.key === "Escape") setFindOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const activePerson = cid && peopleById ? peopleById[cid] : null;
  const effectiveCid = activePerson ? cid : null;

  return (
    <div className="min-h-screen bg-[var(--surface-3)] text-[var(--text-primary)]">
      <div className="mx-auto flex min-h-screen max-w-[1400px] flex-col lg:flex-row">
        <aside className="shrink-0 border-b border-[var(--border-primary)] bg-[var(--surface-1)] p-3 lg:w-60 lg:border-b-0 lg:border-r lg:p-4">
          <div className="mb-3 flex items-center gap-2 px-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-orange/10">
              <Shield className="h-4 w-4 text-[var(--brand-orange)]" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-black tracking-tight">Permissions</p>
              <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-tertiary)]">Données réelles</p>
            </div>
          </div>
          <nav aria-label="Sections" className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
            {NAV.map((item) => {
              const active = item.key === section;
              return (
                <button
                  key={item.key}
                  onClick={() => goSection(item.key)}
                  aria-current={active ? "page" : undefined}
                  className={`flex shrink-0 items-center justify-between gap-2 rounded-lg px-3 py-2 text-[11px] font-bold uppercase tracking-widest transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60 ${
                    active ? "bg-brand-orange text-black" : "text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {item.label}
                  {item.key === "journal" && badgeCount > 0 && (
                    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-black ${active ? "bg-black/20 text-black" : "bg-amber-500/20 text-amber-400"}`}>{badgeCount}</span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="mt-4 space-y-2 border-t border-[var(--border-primary)] pt-4">
            <button onClick={() => setFindOpen(true)} className="flex w-full items-center gap-2 rounded-lg border border-[var(--border-primary)] px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60">
              <Search className="h-3.5 w-3.5" aria-hidden="true" /> Rechercher <span className="ml-auto rounded border border-[var(--border-primary)] px-1 py-0.5 text-[9px]">⌘K</span>
            </button>
            <button onClick={actions.refresh} className="flex w-full items-center gap-2 rounded-lg border border-[var(--border-primary)] px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60">
              <Loader2 className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden="true" /> Rafraîchir
            </button>
            <button onClick={toggleTheme} className="flex w-full items-center gap-2 rounded-lg border border-[var(--border-primary)] px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60">
              {resolvedTheme === "dark" ? <Sun className="h-3.5 w-3.5" aria-hidden="true" /> : <Moon className="h-3.5 w-3.5" aria-hidden="true" />}
              Thème {resolvedTheme === "dark" ? "clair" : "sombre"}
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 p-4 lg:p-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)]">
              Admin / Sécurité / Permissions / <span className="text-[var(--brand-orange)]">{NAV.find((item) => item.key === section)?.label}</span>
            </p>
            <Btn variant="ghost" icon={BookOpen} onClick={() => setHelpOpen((value) => !value)} aria-expanded={helpOpen}>
              Comment ça marche ?
            </Btn>
          </div>

          {helpOpen && <HowItWorks />}

          {loading && !people.length ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-6 w-6 animate-spin text-[var(--brand-orange)]" aria-hidden="true" />
            </div>
          ) : error || blocked ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--border-primary)] bg-[var(--surface-1)] p-10 text-center">
              <ShieldAlert className="h-6 w-6 text-amber-400" aria-hidden="true" />
              <p className="text-sm font-bold text-[var(--text-primary)]">{error || "Accès refusé."}</p>
              <p className="text-xs text-[var(--text-secondary)]">
                {blocked ? "Votre compte n'a pas la permission de voir la matrice des permissions." : "Réessayez dans un instant."}
              </p>
            </div>
          ) : (
            <>
              {section === "personnes" && <Personnes sub={sub} onSub={goSub} cid={effectiveCid} onOpenPerson={openPerson} />}
              {section === "profils" && <Profils sub={sub} onSub={goSub} />}
              {section === "regles" && <Regles sub={sub} onSub={goSub} />}
              {section === "journal" && <Journal onOpenPerson={openPerson} go={go} />}
            </>
          )}
        </main>
      </div>

      {findOpen && <Finder onClose={() => setFindOpen(false)} goSection={goSection} openPerson={openPerson} />}
    </div>
  );
}

function HowItWorks() {
  return (
    <section className="mb-6 space-y-4 rounded-2xl border border-[var(--border-primary)] bg-[var(--surface-1)] p-5">
      <p className="text-sm font-bold text-[var(--text-primary)]">
        Une décision passe par trois filtres successifs. Un seul « non » suffit à refuser.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { title: "1 · Éligibilité", body: "Ce type d'identité peut-il recevoir cette fonctionnalité ? C'est le plafond." },
          { title: "2 · Capacité", body: "Cette personne détient-elle le droit, à un niveau suffisant ?" },
          { title: "3 · Portée", body: "Sur quels enregistrements ce droit s'applique-t-il ?" },
        ].map((item) => (
          <div key={item.title} className="rounded-xl border border-[var(--border-primary)] bg-[var(--surface-2)] p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--brand-orange)]">{item.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">{item.body}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <NoteBox>
          Les droits viennent de quatre sources : <strong>profil</strong> (le modèle de la fonction), <strong>groupe</strong>,{" "}
          <strong>droits personnels</strong>, <strong>moins les restrictions</strong>. On garde le niveau le plus élevé,
          puis on retire les restrictions.
        </NoteBox>
        <NoteBox tone="warning">
          Niveaux : 0 Aucun · 1 Lire · 2 Créer · 3 Modifier · 4 Supprimer · 5 Complet. Le <strong>super administrateur</strong>{" "}
          a tous les droits et échappe à l'éligibilité, sauf restriction ou limitation nominative.
        </NoteBox>
      </div>
      <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
        {[
          ["Plafond", "La limite haute d'une identité. Appelé « éligibilité » dans le moteur."],
          ["Profil", "Le modèle d'une fonction (Mentor, Participant…). Il porte le jeu de capacités par défaut."],
          ["Capacité", "Un droit précis (lire, créer, modifier…), dans une sous-section."],
          ["Portée", "Les enregistrements sur lesquels un droit opère."],
        ].map(([term, def]) => (
          <span key={term} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-primary)] px-2.5 py-1.5">
            {term}
            <InfoTip text={def} />
          </span>
        ))}
      </div>
    </section>
  );
}

function Finder({ onClose, goSection, openPerson }) {
  const { people } = usePerm();
  const [query, setQuery] = useState("");
  const matches = people.filter((person) => person.name.toLowerCase().includes(query.toLowerCase()));
  const sections = NAV.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="fixed inset-0 z-[600] flex items-start justify-center bg-black/60 p-4 pt-24" onClick={onClose} role="presentation">
      <div role="dialog" aria-modal="true" aria-label="Recherche globale" onClick={(event) => event.stopPropagation()} className="w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--border-primary)] bg-[var(--surface-1)] shadow-2xl">
        <div className="flex items-center gap-2 border-b border-[var(--border-primary)] px-4 py-3">
          <Search className="h-4 w-4 text-[var(--text-tertiary)]" aria-hidden="true" />
          <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher une personne, une section…" className="w-full bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]" />
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {matches.map((person) => (
            <button key={person.id} onClick={() => { openPerson(person.id); onClose(); }} className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left hover:bg-[var(--surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60">
              <span className="text-xs font-bold text-[var(--text-primary)]">{person.name}</span>
              <span className="text-[10px] text-[var(--text-tertiary)]">{person.roleLabel} · Personne</span>
            </button>
          ))}
          {sections.map((item) => (
            <button key={item.key} onClick={() => { goSection(item.key); onClose(); }} className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left hover:bg-[var(--surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60">
              <span className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]"><ChevronRight className="h-3 w-3" aria-hidden="true" /> {item.label}</span>
              <span className="text-[10px] text-[var(--text-tertiary)]">Section</span>
            </button>
          ))}
          {matches.length === 0 && sections.length === 0 && <p className="px-3 py-4 text-xs text-[var(--text-tertiary)]">Aucun résultat.</p>}
        </div>
      </div>
    </div>
  );
}

"use client";

/* eslint-disable react/no-unescaped-entities -- prototype UI is hardcoded French */

import React, { useState } from "react";
import { AlertTriangle, Lock, ShieldCheck, ShieldAlert, TestTube2 } from "lucide-react";
import {
  ELIGIBILITY,
  ELIGIBILITY_IDENTITIES,
  FEATURES,
  PEOPLE,
  PERSON_BY_ID,
  PROFILES,
  RESPONSIBILITIES,
  RESPONSIBILITY_ROLE_CHOICES,
  SCOPE_POLICIES,
  scopeResolves,
} from "./data";
import { Btn, EmptyLine, InfoTip, NoteBox, SidePanel, Tabs } from "./ui";

/**
 * RÈGLES — « quel est le maximum qui peut jamais être accordé ? »
 *
 * Les règles posent des plafonds ; elles n'accordent rien. Trois volets :
 * l'éligibilité, les responsabilités, la portée.
 */

const CELL = {
  E: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  D: "bg-red-500/15 text-red-400 border-red-500/30",
  N: "bg-[repeating-linear-gradient(45deg,transparent_0_4px,var(--border-primary)_4px_5px)] text-[var(--text-tertiary)] border-[var(--border-primary)]",
};

export default function Regles({ sub, onSub }) {
  const [canConfigure] = useState(true);
  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-black tracking-tight text-[var(--text-primary)]">Règles</h1>
        <p className="text-sm text-[var(--text-secondary)]">Les règles fixent des maximums. Elles n'accordent rien par elles-mêmes.</p>
      </header>

      <Tabs
        items={[
          { key: "eligibilite", label: "Éligibilité" },
          { key: "responsabilites", label: "Responsabilités" },
          { key: "portee", label: "Portée" },
        ]}
        value={sub}
        onChange={onSub}
      />

      {sub === "eligibilite" && <EligibilityTab canConfigure={canConfigure} />}
      {sub === "responsabilites" && <ResponsibilitiesTab />}
      {sub === "portee" && <ScopeTab />}
    </div>
  );
}

// ─── Éligibilité ────────────────────────────────────────────────────────────
function EligibilityTab({ canConfigure }) {
  const [matrix, setMatrix] = useState(() => JSON.parse(JSON.stringify(ELIGIBILITY)));
  const [impact, setImpact] = useState(null);
  const [view, setView] = useState("matrice");

  const nextState = { E: "D", D: "N", N: "E" };

  const tryChange = (identity, featureKey) => {
    if (!canConfigure) return;
    const nx = nextState[matrix[identity]?.[featureKey] ?? "N"];
    // Baisser un plafond peut rendre « morts » les droits qu'un profil accorde
    // encore : on prévisualise l'impact avant d'enregistrer.
    const stranded = PROFILES.filter((profile) => profile.capabilities?.[featureKey] && identity === profile.label);
    if (nx !== "E" && stranded.length > 0) {
      setImpact({ identity, featureKey, nx, stranded });
      return;
    }
    apply(identity, featureKey, nx);
  };

  const apply = (identity, featureKey, value) => {
    setMatrix((prev) => ({ ...prev, [identity]: { ...prev[identity], [featureKey]: value } }));
    setImpact(null);
  };

  return (
    <div className="space-y-4">
      <NoteBox>
        L'éligibilité décide qui peut un jour recevoir une fonctionnalité. Elle ne donne aucun droit à elle seule.
        « Non configuré » compte comme refusé. Un plafond est une <strong>protection</strong>, pas une permission.
        <InfoTip text="Plafond : la limite haute. Même un droit accordé ne peut jamais dépasser le plafond de l'identité." />
      </NoteBox>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-[var(--border-primary)] p-0.5">
          {[{ key: "matrice", label: "Matrice" }, { key: "identite", label: "Par identité" }].map((option) => (
            <button
              key={option.key}
              onClick={() => setView(option.key)}
              className={`rounded-md px-3 py-1.5 text-[10px] font-black uppercase tracking-widest ${view === option.key ? "bg-brand-orange/10 text-[var(--brand-orange)]" : "text-[var(--text-secondary)]"}`}
            >
              {option.label}
            </button>
          ))}
        </div>
        {!canConfigure && (
          <span className="inline-flex items-center gap-1 rounded-md bg-[var(--surface-2)] px-2 py-1 text-[10px] font-bold text-[var(--text-secondary)]">
            <Lock className="h-3 w-3" aria-hidden="true" /> Lecture seule
          </span>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--border-primary)] bg-[var(--surface-1)]">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--border-primary)]">
              <th className="min-w-[10rem] px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">Identité</th>
              {FEATURES.map((feature) => (
                <th key={feature.key} className="px-3 py-3 text-center text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">{feature.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ELIGIBILITY_IDENTITIES.map((identity) => (
              <tr key={identity} className="border-b border-[var(--border-primary)]/60">
                <td className="px-4 py-2.5 text-xs font-bold text-[var(--text-primary)]">{identity}</td>
                {FEATURES.map((feature) => {
                  const value = matrix[identity]?.[feature.key] ?? "N";
                  return (
                    <td key={feature.key} className="px-3 py-2.5 text-center">
                      <button
                        onClick={() => tryChange(identity, feature.key)}
                        disabled={!canConfigure}
                        title={`${identity} → ${feature.label}`}
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-md border text-[10px] font-black transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60 ${CELL[value]}`}
                      >
                        {value === "N" ? "" : value}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-[var(--text-tertiary)]">
        <span className="font-bold text-emerald-400">E</span> éligible · <span className="font-bold text-red-400">D</span> refusé ·{" "}
        <span className="font-bold">—</span> non configuré (= refusé). Cliquez pour changer (E → D → N → E).
      </p>

      <SidePanel open={Boolean(impact)} title="Aperçu d'impact" onClose={() => setImpact(null)}>
        {impact && (
          <>
            <NoteBox tone="warning">
              {impact.identity} › {FEATURES.find((feature) => feature.key === impact.featureKey)?.label} →{" "}
              {impact.nx === "N" ? "non configuré" : "refusé"}
            </NoteBox>
            <div className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
              <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-400">
                <AlertTriangle className="h-3 w-3" aria-hidden="true" /> Droits « morts »
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                Le profil <strong>{impact.stranded.map((profile) => profile.label).join(", ")}</strong> accorde encore des
                droits dans cette fonctionnalité. Abaisser le plafond les rendrait inatteignables.
              </p>
              <p className="text-xs text-[var(--text-secondary)]">1 personne perdrait l'accès (Fatou B.).</p>
            </div>
            <p className="text-[10px] text-[var(--text-tertiary)]">Rien n'est enregistré avant votre confirmation.</p>
            <div className="flex justify-end gap-2">
              <Btn variant="ghost" onClick={() => setImpact(null)}>Annuler</Btn>
              <Btn variant="primary" onClick={() => apply(impact.identity, impact.featureKey, impact.nx)}>Confirmer</Btn>
            </div>
          </>
        )}
      </SidePanel>
    </div>
  );
}

// ─── Responsabilités ────────────────────────────────────────────────────────
function ResponsibilitiesTab() {
  const [rows, setRows] = useState(RESPONSIBILITIES);
  const toggle = (index, role) =>
    setRows((prev) =>
      prev.map((row, i) =>
        i === index ? { ...row, roles: row.roles.includes(role) ? row.roles.filter((value) => value !== role) : [...row.roles, role] } : row,
      ),
    );

  return (
    <div className="space-y-4">
      <NoteBox>
        Pour chaque responsabilité, les rôles qui peuvent réellement utiliser la fonction qu'elle accorde. Un rôle dont
        le plafond refuse la fonctionnalité n'est jamais proposé.
      </NoteBox>
      {rows.map((row, index) => (
        <section key={row.key} className="space-y-3 rounded-xl border border-[var(--border-primary)] bg-[var(--surface-1)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-[var(--text-primary)]">{row.label}</p>
              <p className="text-[10px] text-[var(--text-secondary)]">Accorde l'accès à : {FEATURES.find((feature) => feature.key === row.feature)?.label}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {RESPONSIBILITY_ROLE_CHOICES.map((role) => {
              const active = row.roles.includes(role);
              return (
                <button
                  key={role}
                  onClick={() => toggle(index, role)}
                  className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60 ${
                    active ? "border-brand-orange/40 bg-brand-orange/10 text-[var(--brand-orange)]" : "border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {role}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

// ─── Portée ─────────────────────────────────────────────────────────────────
function ScopeTab() {
  const [testPerson, setTestPerson] = useState("awa");
  const [testPolicy, setTestPolicy] = useState(SCOPE_POLICIES[0].key);
  const [result, setResult] = useState(null);
  const person = PERSON_BY_ID[testPerson];

  return (
    <div className="space-y-4">
      <NoteBox>
        Une politique de portée dit <strong>sur quels enregistrements</strong> un droit opère. Une politique « en
        attente » refuse toujours : elle n'autorise jamais silencieusement.
      </NoteBox>

      <div className="grid gap-3 sm:grid-cols-2">
        {SCOPE_POLICIES.map((policy) => (
          <div key={policy.key} className="space-y-1.5 rounded-xl border border-[var(--border-primary)] bg-[var(--surface-1)] p-4">
            <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-primary)]">
              {policy.implemented ? <ShieldCheck className="h-3.5 w-3.5 text-[var(--brand-orange)]" aria-hidden="true" /> : <ShieldAlert className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />}
              {policy.label}
            </p>
            <p className="text-[10px] text-[var(--text-secondary)]">Ressource : {policy.resource}</p>
            <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${policy.implemented ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-amber-500/30 bg-amber-500/10 text-amber-400"}`}>
              {policy.implemented ? "Implémentée" : "En attente — refuse toujours"}
            </span>
          </div>
        ))}
      </div>

      <section className="space-y-3 rounded-xl border border-[var(--border-primary)] bg-[var(--surface-1)] p-4">
        <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
          <TestTube2 className="h-3.5 w-3.5 text-[var(--brand-orange)]" aria-hidden="true" /> Banc de test sur une personne réelle
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Personne</span>
            <select value={testPerson} onChange={(event) => { setTestPerson(event.target.value); setResult(null); }} className="rounded-lg border border-[var(--border-primary)] bg-[var(--surface-1)] px-3 py-2 text-xs text-[var(--text-primary)]">
              {PEOPLE.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Politique</span>
            <select value={testPolicy} onChange={(event) => { setTestPolicy(event.target.value); setResult(null); }} className="rounded-lg border border-[var(--border-primary)] bg-[var(--surface-1)] px-3 py-2 text-xs text-[var(--text-primary)]">
              {SCOPE_POLICIES.map((policy) => <option key={policy.key} value={policy.key}>{policy.label}</option>)}
            </select>
          </label>
          <Btn variant="primary" onClick={() => setResult(scopeResolves(testPerson, testPolicy))}>Tester</Btn>
        </div>
        {result && (
          <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--surface-2)] p-3">
            <p className="text-xs font-bold text-[var(--text-primary)]">
              {person.name} → {result.length === 0 ? <span className="text-[var(--text-tertiary)]">aucun enregistrement (rien n'est autorisé)</span> : `${result.length} enregistrement(s) : ${result.join(", ")}`}
            </p>
          </div>
        )}
        {!SCOPE_POLICIES.find((policy) => policy.key === testPolicy)?.implemented && result && <EmptyLine>Politique en attente : le moteur refuserait, quel que soit le résultat ci-dessus.</EmptyLine>}
      </section>
    </div>
  );
}

"use client";

/* eslint-disable react/no-unescaped-entities -- prototype UI is hardcoded French */

import React, { useMemo, useState } from "react";
import { AlertTriangle, Lock } from "lucide-react";
import { notify } from "@/lib/notify";
import { featureLabel } from "./constants";
import { Btn, EmptyLine, InfoTip, INPUT_CLASS, NoteBox, SidePanel, Tabs } from "./ui";
import { usePerm } from "./store";

/** RÈGLES — plafonds (éligibilité), responsabilités, portée. Données réelles. */
export default function Regles({ sub, onSub }) {
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

      {sub === "eligibilite" && <EligibilityTab />}
      {sub === "responsabilites" && <ResponsibilitiesTab />}
      {sub === "portee" && <ScopeTab />}
    </div>
  );
}

const CELL = {
  E: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  D: "bg-red-500/15 text-red-400 border-red-500/30",
  N: "bg-[repeating-linear-gradient(45deg,transparent_0_4px,var(--border-primary)_4px_5px)] text-[var(--text-tertiary)] border-[var(--border-primary)]",
};

function EligibilityTab() {
  const { features, eligibility, eligibilityIdentities, canConfigure, actions } = usePerm();
  const [impact, setImpact] = useState(null);
  const [busy, setBusy] = useState(false);

  const cellValue = (identity, featureKey) => eligibility.role?.[identity]?.[featureKey] ?? "N";
  const nextState = { E: "D", D: "N", N: "E" };

  const apply = async (identity, featureKey, next) => {
    setBusy(true);
    const change = {
      feature_key: featureKey,
      identity_type: "role",
      identity_value: identity,
      eligible: next === "E" ? 1 : next === "D" ? 0 : null,
    };
    try {
      const data = await actions.saveEligibility([change], Boolean(impact));
      if (data?.success) {
        notify("success", "Plafond mis à jour.");
        setImpact(null);
      } else if (data?.requiresConfirmation) {
        setImpact({ identity, featureKey, next, impacts: data.impacts || [] });
      } else {
        notify("error", data?.error || "Enregistrement refusé.");
      }
    } finally {
      setBusy(false);
    }
  };

  const click = (identity, featureKey) => {
    if (!canConfigure) return;
    apply(identity, featureKey, nextState[cellValue(identity, featureKey)]);
  };

  return (
    <div className="space-y-4">
      <NoteBox>
        L'éligibilité décide qui peut un jour recevoir une fonctionnalité. « Non configuré » compte comme refusé.
        Un plafond est une protection, pas une permission.
        <InfoTip text="Plafond : la limite haute d'une identité. Même un droit accordé ne peut jamais la dépasser." />
      </NoteBox>

      {!canConfigure && (
        <span className="inline-flex items-center gap-1 rounded-md bg-[var(--surface-2)] px-2 py-1 text-[10px] font-bold text-[var(--text-secondary)]">
          <Lock className="h-3 w-3" aria-hidden="true" /> Lecture seule — vous n'avez pas « configurer l'éligibilité »
        </span>
      )}

      <div className="overflow-x-auto rounded-xl border border-[var(--border-primary)] bg-[var(--surface-1)]">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--border-primary)]">
              <th className="min-w-[10rem] px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">Identité</th>
              {features.map((feature) => (
                <th key={feature.key} className="px-3 py-3 text-center text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">{feature.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {eligibilityIdentities.map((identity) => (
              <tr key={identity} className="border-b border-[var(--border-primary)]/60">
                <td className="px-4 py-2.5 text-xs font-bold text-[var(--text-primary)]">{identity}</td>
                {features.map((feature) => {
                  const value = cellValue(identity, feature.key);
                  return (
                    <td key={feature.key} className="px-3 py-2.5 text-center">
                      <button
                        onClick={() => click(identity, feature.key)}
                        disabled={!canConfigure || busy}
                        title={`${identity} → ${feature.label}`}
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-md border text-[10px] font-black transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60 disabled:opacity-50 ${CELL[value]}`}
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
              {impact.identity} › {featureLabel(impact.featureKey)} → {impact.next === "N" ? "non configuré" : "refusé"}
            </NoteBox>
            {impact.impacts.length > 0 ? (
              <div className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
                <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-400">
                  <AlertTriangle className="h-3 w-3" aria-hidden="true" /> Droits « morts »
                </p>
                {impact.impacts.map((entry, index) => (
                  <p key={index} className="text-xs text-[var(--text-secondary)]">
                    {entry.template || entry.profile || entry.role || "Modèle"} accorde encore des droits dans cette
                    fonctionnalité{entry.people ? ` — ${entry.people} personne(s)` : ""}.
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--text-secondary)]">Aucun modèle impacté.</p>
            )}
            <p className="text-[10px] text-[var(--text-tertiary)]">Rien n'est enregistré avant votre confirmation.</p>
            <div className="flex justify-end gap-2">
              <Btn variant="ghost" onClick={() => setImpact(null)}>Annuler</Btn>
              <Btn variant="primary" disabled={busy} onClick={() => apply(impact.identity, impact.featureKey, impact.next)}>Confirmer</Btn>
            </div>
          </>
        )}
      </SidePanel>
    </div>
  );
}

function ResponsibilitiesTab() {
  const { responsibilities, eligibilityIdentities, actions } = usePerm();
  const [busy, setBusy] = useState("");
  const choices = useMemo(() => Array.from(new Set([...eligibilityIdentities])), [eligibilityIdentities]);

  const toggle = async (row, role) => {
    const next = row.roles.includes(role) ? row.roles.filter((value) => value !== role) : [...row.roles, role];
    setBusy(String(row.id));
    const data = await actions.saveResponsibilityAccess(row.id, next);
    if (!data?.success) notify("error", data?.error || "Enregistrement refusé.");
    setBusy("");
  };

  return (
    <div className="space-y-4">
      <NoteBox>
        Pour chaque responsabilité, les rôles qui peuvent réellement utiliser la fonction qu'elle accorde. C'est le
        dernier endroit où un rôle, plutôt qu'une capacité, décide de l'accès.
      </NoteBox>
      {responsibilities.length === 0 ? (
        <EmptyLine>Aucune responsabilité.</EmptyLine>
      ) : responsibilities.map((row) => (
        <section key={row.id} className="space-y-3 rounded-xl border border-[var(--border-primary)] bg-[var(--surface-1)] p-4">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-[var(--text-primary)]">{row.name}</p>
            {row.description && <p className="text-[10px] text-[var(--text-secondary)]">{row.description}</p>}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {choices.map((role) => {
              const active = row.roles.includes(role);
              return (
                <button
                  key={role}
                  disabled={busy === String(row.id)}
                  onClick={() => toggle(row, role)}
                  className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60 disabled:opacity-50 ${
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

function ScopeTab() {
  const { scopePolicies, people, actions } = usePerm();
  const [personId, setPersonId] = useState("");
  const [policy, setPolicy] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const effectivePersonId = personId || people[0]?.id || "";
  const effectivePolicy = policy || scopePolicies.find((candidate) => candidate.implemented)?.key || scopePolicies[0]?.key || "";

  const run = async () => {
    if (!effectivePersonId || !effectivePolicy) return;
    setBusy(true);
    try {
      setResult(await actions.scopeCheck(effectivePolicy, effectivePersonId));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <NoteBox>
        Une politique de portée dit sur quels enregistrements un droit opère. Une politique « en attente » refuse
        toujours : elle n'autorise jamais silencieusement.
      </NoteBox>

      <div className="grid gap-3 sm:grid-cols-2">
        {scopePolicies.map((item) => (
          <div key={item.key} className="space-y-1.5 rounded-xl border border-[var(--border-primary)] bg-[var(--surface-1)] p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-primary)]">{item.label}</p>
            <p className="text-[10px] text-[var(--text-secondary)]">Ressource : {item.resource}</p>
            <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${item.implemented ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-amber-500/30 bg-amber-500/10 text-amber-400"}`}>
              {item.implemented ? "Implémentée" : "En attente — refuse toujours"}
            </span>
          </div>
        ))}
      </div>

      <section className="space-y-3 rounded-xl border border-[var(--border-primary)] bg-[var(--surface-1)] p-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">Banc de test sur une personne réelle</p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Personne</span>
            <select value={effectivePersonId} onChange={(event) => { setPersonId(event.target.value); setResult(null); }} className={INPUT_CLASS}>
              {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Politique</span>
            <select value={effectivePolicy} onChange={(event) => { setPolicy(event.target.value); setResult(null); }} className={INPUT_CLASS}>
              {scopePolicies.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
            </select>
          </label>
          <Btn variant="primary" disabled={busy} onClick={run}>Tester</Btn>
        </div>
        {result && (
          <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--surface-2)] p-3">
            <p className="text-xs font-bold text-[var(--text-primary)]">
              {result.resolved_count === 0
                ? <span className="text-[var(--text-tertiary)]">Aucun enregistrement — rien n'est autorisé</span>
                : `${result.resolved_count} enregistrement(s) : ${(result.resolved_ids || []).join(", ")}`}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

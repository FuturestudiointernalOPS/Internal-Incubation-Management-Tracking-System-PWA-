"use client";

/* eslint-disable react/no-unescaped-entities -- prototype UI is hardcoded French */

import React, { useMemo, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronRight, Lock, UserCog } from "lucide-react";
import {
  ALL_MODULES,
  AUDIT,
  FEATURES,
  GRANT_KEYS,
  LEVELS,
  MODULE_BY_KEY,
  explainCap,
  effectiveOf,
  eligibleOf,
  gatesFor,
  riskOf,
  scopeResolves,
  sourceOf,
} from "./data";
import {
  Btn,
  EmptyLine,
  Field,
  GateThree,
  InfoTip,
  INPUT_CLASS,
  Kpi,
  LevelChip,
  NoteBox,
  RiskBadge,
  SidePanel,
  SourceBadge,
  Tabs,
} from "./ui";

/**
 * FICHE PERSONNE — cinq lentilles sur la même réalité : droits, pourquoi,
 * portée, responsabilités, historique.
 */

const CAP_TIP = "Une capacité est un droit précis (lire, créer, modifier…). Elle vit dans une sous-section, elle-même rangée dans une fonctionnalité.";
const FEATURE_TIP = "Une fonctionnalité est une grande section du tableau de bord (Programmes, Finance…). Le plafond d'éligibilité s'exprime par fonctionnalité.";

export default function PersonDetail({ person, onBack }) {
  const [tab, setTab] = useState("droits");
  const [action, setAction] = useState(null);
  const [forceProfile, setForceProfile] = useState(false);

  const kpis = useMemo(() => {
    let effective = 0;
    let inherited = 0;
    let direct = 0;
    let restricted = 0;
    for (const mod of ALL_MODULES) {
      for (const cap of mod.caps) {
        const source = sourceOf(person.sources, mod.key, cap);
        const level = effectiveOf(person.sources, mod.key, cap);
        if (person.isSuperAdmin || level > 0) effective += 1;
        if (source === "Profil" || source === "Groupe") inherited += 1;
        if (source === "Direct") direct += 1;
        if (source === "Restriction") restricted += 1;
      }
    }
    return { effective, inherited, direct, restricted };
  }, [person]);

  const history = AUDIT.filter((entry) => entry.target === person.name);

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 rounded-sm text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Personnes
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-orange/10 text-sm font-black text-[var(--brand-orange)]">
            {person.name.slice(0, 1)}
          </div>
          <div>
            <h1 className="text-xl font-black text-[var(--text-primary)]">{person.name}</h1>
            <p className="text-xs text-[var(--text-secondary)]">
              {person.roleLabel} · Profil : {person.profile}
              {person.isSuperAdmin && <span className="ml-2 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-black uppercase text-amber-400">Super administrateur</span>}
            </p>
          </div>
        </div>
        <Btn icon={UserCog} onClick={() => setForceProfile(true)}>Forcer un profil</Btn>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Effectifs" value={kpis.effective} tone="brand" />
        <Kpi label="Hérités" value={kpis.inherited} hint="profil + groupe" />
        <Kpi label="Directs" value={kpis.direct} tone="success" />
        <Kpi label="Restreints" value={kpis.restricted} tone={kpis.restricted ? "danger" : "neutral"} />
      </div>

      <Tabs
        items={[
          { key: "droits", label: "Droits" },
          { key: "pourquoi", label: "Pourquoi" },
          { key: "portee", label: "Portée" },
          { key: "responsabilites", label: "Responsabilités" },
          { key: "historique", label: "Historique", count: history.length },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "droits" && <RightsMatrix person={person} onAction={setAction} />}
      {tab === "pourquoi" && <WhyTab person={person} />}
      {tab === "portee" && <ScopeTab person={person} />}
      {tab === "responsabilites" && (
        <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--surface-1)] p-4">
          {person.responsibilities.length === 0 ? <EmptyLine>Aucune responsabilité.</EmptyLine> : (
            <ul className="space-y-1.5">
              {person.responsibilities.map((name) => <li key={name} className="text-xs font-bold text-[var(--text-primary)]">• {name}</li>)}
            </ul>
          )}
        </div>
      )}
      {tab === "historique" && <HistoryTable entries={history} />}

      <ActionPanel action={action} person={person} onClose={() => setAction(null)} />
      <ForceProfilePanel open={forceProfile} person={person} onClose={() => setForceProfile(false)} />
    </div>
  );
}

// ─── Droits : matrice repliable par fonctionnalité ──────────────────────────
function RightsMatrix({ person, onAction }) {
  const [closed, setClosed] = useState({});
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-[10px] text-[var(--text-tertiary)]">
        <SourceBadge source="Profil" /> <SourceBadge source="Groupe" /> <SourceBadge source="Direct" /> <SourceBadge source="Restriction" />
        <span className="ml-1">L'origine du niveau le plus élevé est indiquée par le badge.</span>
      </div>
      {FEATURES.map((feature) => {
        const isClosed = closed[feature.key];
        const eligible = person.isSuperAdmin || eligibleOf(person, feature.key);
        return (
          <section key={feature.key} className="overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--surface-1)]">
            <button
              onClick={() => setClosed((prev) => ({ ...prev, [feature.key]: !prev[feature.key] }))}
              aria-expanded={!isClosed}
              className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-[var(--surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60"
            >
              <span className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-[var(--text-primary)]">
                {isClosed ? <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" /> : <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />}
                {feature.label}
                <InfoTip text={FEATURE_TIP} />
              </span>
              {!eligible && (
                <span className="inline-flex items-center gap-1 rounded-md bg-red-500/10 px-2 py-0.5 text-[9px] font-black uppercase text-red-400">
                  <Lock className="h-3 w-3" aria-hidden="true" /> Non éligible
                </span>
              )}
            </button>
            {!isClosed && (
              <div className="divide-y divide-[var(--border-primary)]/60 border-t border-[var(--border-primary)]">
                {feature.modules.map((mod) => (
                  <div key={mod.key} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5">
                    <span className="min-w-[8rem] text-xs font-bold text-[var(--text-secondary)]">{mod.label}</span>
                    <div className="flex flex-wrap items-center gap-2">
                      {mod.caps.map((cap) => {
                        const level = person.isSuperAdmin ? 5 : effectiveOf(person.sources, mod.key, cap);
                        const source = person.isSuperAdmin ? "Super admin" : sourceOf(person.sources, mod.key, cap);
                        return (
                          <button
                            key={cap}
                            onClick={() => onAction({ moduleKey: mod.key, capability: cap })}
                            title={`Modifier « ${cap} »`}
                            className="flex items-center gap-1.5 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-2)] px-2 py-1 hover:border-brand-orange/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60"
                          >
                            <span className="text-[10px] font-bold text-[var(--text-secondary)]">{cap}</span>
                            <LevelChip level={level} capLabel={cap} />
                            {source === "Super admin" ? null : <SourceBadge source={source} />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

// ─── Pourquoi : les trois portes par droit ──────────────────────────────────
function WhyTab({ person }) {
  return (
    <div className="space-y-3">
      <NoteBox>Chaque droit passe par trois filtres successifs. Un seul « non » suffit à refuser.</NoteBox>
      {FEATURES.map((feature) => (
        <section key={feature.key} className="space-y-2 rounded-xl border border-[var(--border-primary)] bg-[var(--surface-1)] p-4">
          <h3 className="text-[11px] font-black uppercase tracking-widest text-[var(--text-primary)]">{feature.label}</h3>
          {feature.modules.map((mod) => (
            <div key={mod.key} className="space-y-2 border-t border-[var(--border-primary)]/60 pt-2 first:border-0 first:pt-0">
              <p className="text-xs font-bold text-[var(--text-secondary)]">{mod.label}</p>
              {mod.caps.map((cap) => {
                const detail = explainCap(person, mod.key, cap);
                const gates = person.isSuperAdmin
                  ? [
                      { key: "eligibility", tone: "open", label: "Contournée (super admin)" },
                      { key: "capability", tone: "open", label: "Complet (5)" },
                      { key: "scope", tone: "neutral", label: "Non évaluée ici" },
                    ]
                  : gatesFor(person, mod.key, cap, 1);
                return (
                  <div key={cap} className="rounded-lg bg-[var(--surface-2)] p-3">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-black uppercase tracking-wider text-[var(--text-primary)]">{cap}</span>
                      <InfoTip text={CAP_TIP} />
                      <SourceBadge source={detail.source} />
                      <span className="text-[10px] text-[var(--text-tertiary)]">
                        {detail.layers
                          .filter((layer) => !layer.restricted && layer.level > 0)
                          .map((layer) => `${layer.label} : ${LEVELS[layer.level].label}`)
                          .join(" · ") || "aucune source"}
                        {detail.layers.some((layer) => layer.restricted) ? " · restriction posée" : ""}
                      </span>
                    </div>
                    <GateThree gates={gates} />
                  </div>
                );
              })}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

// ─── Portée ─────────────────────────────────────────────────────────────────
function ScopeTab({ person }) {
  const policies = [
    { key: "mes-programmes", label: "Mes programmes" },
    { key: "mes-ventures", label: "Mes ventures" },
    { key: "mes-cours", label: "Mes cours" },
  ];
  return (
    <div className="space-y-3">
      <NoteBox>La portée ne décide pas « si » mais « sur quoi ». Un enregistrement vide n'est jamais une autorisation.</NoteBox>
      <div className="overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--surface-1)]">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--border-primary)] text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
              <th className="px-4 py-3">Politique</th>
              <th className="px-4 py-3">Résout aujourd'hui</th>
            </tr>
          </thead>
          <tbody>
            {policies.map((policy) => {
              const ids = scopeResolves(person.id, policy.key);
              return (
                <tr key={policy.key} className="border-b border-[var(--border-primary)]/60">
                  <td className="px-4 py-3 text-xs font-bold text-[var(--text-primary)]">{policy.label}</td>
                  <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">
                    {ids.length === 0
                      ? <span className="text-[var(--text-tertiary)]">Aucun enregistrement — rien n'est autorisé</span>
                      : `${ids.length} · ${ids.join(", ")}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HistoryTable({ entries }) {
  if (entries.length === 0) {
    return <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--surface-1)] p-4"><EmptyLine>Aucun changement pour cette personne.</EmptyLine></div>;
  }
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--surface-1)]">
      <table className="w-full border-collapse text-left">
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id} className="border-b border-[var(--border-primary)]/60">
              <td className="px-4 py-2.5 font-mono text-[10px] text-[var(--text-tertiary)]">{entry.date}</td>
              <td className="px-4 py-2.5 text-xs font-bold text-[var(--text-primary)]">{entry.action}</td>
              <td className="px-4 py-2.5 text-xs text-[var(--text-secondary)]">{entry.module}.{entry.capability}</td>
              <td className="px-4 py-2.5 text-xs text-[var(--text-secondary)]">{entry.from} → {entry.to}</td>
              <td className="px-4 py-2.5 text-[10px] text-[var(--text-tertiary)]">{entry.reason || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Panneau d'action : diff, risque, motif ─────────────────────────────────
function ActionPanel({ action, person, onClose }) {
  const [kind, setKind] = useState("Accorder");
  const [level, setLevel] = useState(3);
  const [reason, setReason] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [done, setDone] = useState(false);

  if (!action) return null;
  const { moduleKey, capability } = action;
  const current = person.isSuperAdmin ? 5 : effectiveOf(person.sources, moduleKey, capability);
  const target = kind === "Accorder" ? level : 0;
  const risk = riskOf(kind);
  const needsReason = risk === "élevé" || risk === "critique";
  const needsConfirm = risk === "critique";
  const valid = (!needsReason || reason.trim()) && (!needsConfirm || confirmText.trim().toUpperCase() === "CONFIRMER");

  return (
    <SidePanel open title={`${MODULE_BY_KEY[moduleKey].label} · ${capability}`} onClose={onClose}>
      <NoteBox>{person.name}</NoteBox>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Action">
          <select value={kind} onChange={(event) => setKind(event.target.value)} className={`${INPUT_CLASS} w-full`}>
            <option>Accorder</option>
            <option>Retirer</option>
            <option>Restreindre</option>
          </select>
        </Field>
        <Field label="Niveau">
          <select value={level} onChange={(event) => setLevel(Number(event.target.value))} disabled={kind !== "Accorder"} className={`${INPUT_CLASS} w-full disabled:opacity-40`}>
            {GRANT_KEYS.map((value) => <option key={value} value={value}>{value} · {LEVELS[value].label}</option>)}
          </select>
        </Field>
      </div>

      <div className="space-y-2 rounded-xl border border-[var(--border-primary)] bg-[var(--surface-2)] p-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">Avant → Après</span>
          <RiskBadge risk={risk} />
        </div>
        <p className="text-sm font-bold text-[var(--text-primary)]">
          {LEVELS[current].label} → <span className="text-[var(--brand-orange)]">{target ? LEVELS[target].label : "Retiré"}</span>
        </p>
        {kind === "Restreindre" && <p className="text-[10px] text-[var(--text-tertiary)]">Une restriction supprime le droit ; elle ne le diminue pas.</p>}
      </div>

      {needsReason && (
        <Field label={`Motif (obligatoire — risque ${risk})`}>
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} placeholder="Pourquoi ce changement ?" className={`${INPUT_CLASS} w-full`} />
        </Field>
      )}

      {needsConfirm && (
        <Field label="Tapez CONFIRMER">
          <input value={confirmText} onChange={(event) => setConfirmText(event.target.value)} placeholder="CONFIRMER" className={`${INPUT_CLASS} w-full`} />
        </Field>
      )}

      {done && <NoteBox tone="warning">Action simulée : aucune donnée n'est écrite dans cette prévisualisation.</NoteBox>}

      <div className="flex justify-end gap-2">
        <Btn variant="ghost" onClick={onClose}>Annuler</Btn>
        <Btn variant={risk === "critique" ? "danger" : "primary"} disabled={!valid} onClick={() => setDone(true)}>
          {done ? "Appliqué (simulé)" : "Confirmer"}
        </Btn>
      </div>
    </SidePanel>
  );
}

function ForceProfilePanel({ open, person, onClose }) {
  const [profile, setProfile] = useState(person.profile === "—" ? "Participant" : person.profile);
  const [reason, setReason] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const valid = reason.trim() && confirmText.trim().toUpperCase() === "CONFIRMER";

  return (
    <SidePanel open={open} title="Forcer un profil" onClose={onClose}>
      <NoteBox tone="warning">
        Le profil forcé remplace la fonction contextuelle de la personne. Action critique : motif et confirmation tapée.
      </NoteBox>
      <Field label="Nouveau profil">
        <select value={profile} onChange={(event) => setProfile(event.target.value)} className={`${INPUT_CLASS} w-full`}>
          {["Mentor", "Participant", "Fondateur", "Facilitateur", "Staff studio"].map((value) => <option key={value}>{value}</option>)}
        </select>
      </Field>
      <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--surface-2)] p-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">Avant → Après</p>
        <p className="mt-1 text-sm font-bold text-[var(--text-primary)]">{person.profile} → <span className="text-[var(--brand-orange)]">{profile}</span></p>
      </div>
      <Field label="Motif (obligatoire)">
        <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} className={`${INPUT_CLASS} w-full`} />
      </Field>
      <Field label="Tapez CONFIRMER">
        <input value={confirmText} onChange={(event) => setConfirmText(event.target.value)} placeholder="CONFIRMER" className={`${INPUT_CLASS} w-full`} />
      </Field>
      <div className="flex justify-end gap-2">
        <Btn variant="ghost" onClick={onClose}>Annuler</Btn>
        <Btn variant="danger" disabled={!valid} onClick={onClose}>Confirmer</Btn>
      </div>
    </SidePanel>
  );
}

"use client";

/* eslint-disable react/no-unescaped-entities -- prototype UI is hardcoded French */

import React, { useMemo, useState } from "react";
import { AlertTriangle, Download, ExternalLink, Search, ShieldCheck, Users } from "lucide-react";
import { capLabel } from "./constants";
import { Btn, EmptyLine, InfoTip, Kpi, NoteBox, SidePanel } from "./ui";
import { usePerm } from "./store";

/** JOURNAL — santé et alertes, puis le journal d'audit, sur données réelles. */
export default function Journal({ onOpenPerson, go }) {
  const { audit, auditTotal, alerts, people, profiles } = usePerm();

  const superAdmins = people.filter((person) => person.isSuperAdmin).length;
  const restrictedCells = people.reduce((total, person) => total + Object.values(person.sources.restrictions || {}).reduce((sum, caps) => sum + Object.keys(caps).length, 0), 0);

  const alertRows = [
    ...alerts.deadRights.slice(0, 5).map((item, index) => ({
      key: `dead-${index}`,
      tone: "warning",
      label: `Droits « morts » : le profil ${item.profile} accorde ${item.feature}, mais le plafond le refuse`,
      onClick: () => go("profils", "matrice"),
    })),
    { key: "pending", tone: "warning", label: `${alerts.pending.length} politique(s) de portée en attente — elles refusent toujours`, onClick: () => go("regles", "portee") },
    { key: "missing", tone: "warning", label: `${alerts.missingProfiles.length} rôle(s) contextuel(s) sans profil`, onClick: () => go("profils", "contextuels") },
    { key: "expiring", tone: "info", label: `${alerts.expiring.length} adhésion(s) qui expirent bientôt`, onClick: () => go("personnes", "contexte") },
  ].filter((row) => !/^0 /.test(row.label));

  const hasAny = alerts.deadRights.length + alerts.pending.length + alerts.missingProfiles.length + alerts.expiring.length > 0;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-black tracking-tight text-[var(--text-primary)]">Journal</h1>
        <p className="text-sm text-[var(--text-secondary)]">Qu'est-ce qui a changé, qui l'a fait, et pourquoi ?</p>
      </header>

      <section className="space-y-3 rounded-xl border border-[var(--border-primary)] bg-[var(--surface-1)] p-4">
        <h2 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">Santé et alertes</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="Super admins" value={superAdmins} tone={superAdmins > 1 ? "warning" : "neutral"} />
          <Kpi label="Droits restreints" value={restrictedCells} tone={restrictedCells ? "danger" : "neutral"} />
          <Kpi label="Profils" value={profiles.length} />
          <Kpi label="Politiques en attente" value={alerts.pending.length} tone={alerts.pending.length ? "warning" : "success"} />
        </div>
        <ul className="divide-y divide-[var(--border-primary)]">
          {alertRows.map((row) => (
            <li key={row.key}>
              <button onClick={row.onClick} className="flex w-full items-center justify-between gap-3 rounded-sm py-2.5 text-left hover:bg-[var(--surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60">
                <span className="flex items-center gap-2 text-xs font-bold text-[var(--text-secondary)]">
                  {row.tone === "warning" ? <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden="true" /> : <Users className="h-3.5 w-3.5 shrink-0 text-[var(--brand-orange)]" aria-hidden="true" />}
                  {row.label}
                </span>
                <span className="shrink-0 text-[10px] font-black uppercase tracking-widest text-[var(--brand-orange)]">Voir</span>
              </button>
            </li>
          ))}
          {!hasAny && <li className="py-2.5 text-xs font-medium text-emerald-400">Rien à corriger — tous les contrôles sont au vert.</li>}
        </ul>
      </section>

      <AuditLog audit={audit} auditTotal={auditTotal} onOpenPerson={onOpenPerson} />
    </div>
  );
}

function AuditLog({ audit, auditTotal, onOpenPerson }) {
  const { peopleById } = usePerm();
  const [query, setQuery] = useState("");
  const [action, setAction] = useState("toutes");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState(null);
  const pageSize = 12;

  const actionsList = useMemo(() => ["toutes", ...new Set(audit.map((entry) => entry.action))], [audit]);

  const filtered = useMemo(
    () => audit
      .filter((entry) => (query ? `${entry.actor} ${entry.target} ${entry.module} ${entry.capability} ${entry.reason}`.toLowerCase().includes(query.toLowerCase()) : true))
      .filter((entry) => (action === "toutes" ? true : entry.action === action)),
    [audit, query, action],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, totalPages);
  const rows = filtered.slice((current - 1) * pageSize, current * pageSize);

  const exportCsv = () => {
    const header = ["Date", "Auteur", "Cible", "Action", "Sous-section", "Droit", "Avant", "Après", "Motif"];
    const lines = filtered.map((entry) => [entry.date, entry.actor, entry.target, entry.action, entry.module, entry.capability, entry.from, entry.to, entry.reason].map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(","));
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "journal-permissions.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-tertiary)]" aria-hidden="true" />
          <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Rechercher (auteur, cible, motif…)" className="w-full rounded-lg border border-[var(--border-primary)] bg-[var(--surface-1)] py-2 pl-9 pr-3 text-xs text-[var(--text-primary)] outline-none focus:border-brand-orange/50 focus-visible:ring-2 focus-visible:ring-brand-orange/60" />
        </div>
        <select value={action} onChange={(event) => { setAction(event.target.value); setPage(1); }} className="rounded-lg border border-[var(--border-primary)] bg-[var(--surface-1)] px-3 py-2 text-xs text-[var(--text-primary)]" aria-label="Filtrer par action">
          {actionsList.map((value) => <option key={value} value={value}>{value === "toutes" ? "Toutes les actions" : value}</option>)}
        </select>
        <Btn icon={Download} onClick={exportCsv}>Exporter CSV</Btn>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--border-primary)] bg-[var(--surface-1)]">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--border-primary)] text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Auteur</th>
              <th className="px-4 py-3">Cible</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Droit</th>
              <th className="px-4 py-3">Avant → Après</th>
              <th className="px-4 py-3">Motif</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((entry) => (
              <tr key={entry.id} onClick={() => setDetail(entry)} className="cursor-pointer border-b border-[var(--border-primary)]/60 hover:bg-[var(--surface-2)]">
                <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[10px] text-[var(--text-tertiary)]">{String(entry.date).slice(0, 16).replace("T", " ")}</td>
                <td className="px-4 py-2.5 text-xs text-[var(--text-secondary)]">{entry.actor}</td>
                <td className="px-4 py-2.5 text-xs font-bold text-[var(--text-primary)]">{entry.target}</td>
                <td className="px-4 py-2.5 text-xs text-[var(--text-secondary)]">{entry.action}</td>
                <td className="px-4 py-2.5 text-xs text-[var(--text-secondary)]">{entry.module && entry.module !== "—" ? `${entry.module}.${capLabel(entry.capability)}` : "—"}</td>
                <td className="px-4 py-2.5 text-xs text-[var(--text-secondary)]">{String(entry.from)} → {String(entry.to)}</td>
                <td className="max-w-[16rem] truncate px-4 py-2.5 text-[10px] text-[var(--text-tertiary)]">{entry.reason || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <div className="px-4 py-6"><EmptyLine>Aucune entrée pour ces filtres.</EmptyLine></div>}
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)]">Page {current} / {totalPages} · {filtered.length} affichée(s) · {auditTotal} au total</p>
        <div className="flex gap-2">
          <Btn size="sm" disabled={current <= 1} onClick={() => setPage(current - 1)}>Précédent</Btn>
          <Btn size="sm" disabled={current >= totalPages} onClick={() => setPage(current + 1)}>Suivant</Btn>
        </div>
      </div>

      <SidePanel open={Boolean(detail)} title="Détail du changement" onClose={() => setDetail(null)}>
        {detail && (
          <>
            <NoteBox>{String(detail.date).slice(0, 16).replace("T", " ")} · {detail.actor} → {detail.target}</NoteBox>
            <dl className="divide-y divide-[var(--border-primary)] text-xs">
              {[
                ["Action", detail.action],
                ["Sous-section", detail.module || "—"],
                ["Droit", detail.capability ? capLabel(detail.capability) : "—"],
                ["Avant", String(detail.from)],
                ["Après", String(detail.to)],
                ["Motif", detail.reason || "—"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3 py-2">
                  <dt className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)]">{label}</dt>
                  <dd className="text-right font-bold text-[var(--text-primary)]">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="flex items-center gap-2">
              <InfoTip text="Ouvre la fiche de la personne ciblée pour voir ses droits à jour." />
              <Btn
                icon={ExternalLink}
                disabled={!detail.targetCid || !peopleById[detail.targetCid]}
                onClick={() => { const cid = detail.targetCid; setDetail(null); if (cid && peopleById[cid]) onOpenPerson(cid); }}
              >
                Ouvrir la personne
              </Btn>
            </div>
            <p className="flex items-center gap-1.5 text-[10px] text-[var(--text-tertiary)]">
              <ShieldCheck className="h-3 w-3" aria-hidden="true" /> Le journal est en ajout seul : rien ne s'y modifie.
            </p>
          </>
        )}
      </SidePanel>
    </section>
  );
}

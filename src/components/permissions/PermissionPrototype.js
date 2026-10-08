"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";

const TABS = {
  people: ["people", "groups", "administrators", "context"],
  profiles: ["matrix", "contextRoles"],
  rules: ["eligibility", "responsibilities", "scope"],
  journal: [],
};

const SECTION_KEYS = ["people", "profiles", "rules", "journal"];

function PrototypeTable({ children }) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border-primary)] bg-surface-1">
      <table className="w-full min-w-[42rem] border-collapse text-left">{children}</table>
    </div>
  );
}

function HeadCell({ children }) {
  return <th className="border-b border-[var(--border-primary)] px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{children}</th>;
}

function Cell({ children, className = "" }) {
  return <td className={`border-b border-[var(--border-secondary)] px-3 py-2.5 text-sm text-[var(--text-primary)] ${className}`}>{children}</td>;
}

function eligibilityState(rows, role, feature) {
  const row = rows.find((item) => item.identity_type === "role" && item.identity_value === role && item.feature_key === feature);
  return row ? Number(row.eligible) : null;
}

export default function PermissionPrototype({ initialSection = "people" }) {
  const { t } = useI18n();
  const [section, setSection] = useState(initialSection);
  const [tab, setTab] = useState(TABS[initialSection]?.[0] || "");
  const [query, setQuery] = useState("");
  const [data, setData] = useState({ contacts: [], profiles: [], roleDefaults: {}, eligibility: null, audit: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/contacts").then((response) => response.json()),
      fetch("/api/access-profiles").then((response) => response.json()),
      fetch("/api/engineering/permissions/eligibility").then((response) => response.json()),
      fetch("/api/engineering/permissions/audit?page=1&pageSize=20").then((response) => response.json()),
    ]).then(([contacts, profiles, eligibility, audit]) => {
      if (!active) return;
      setData({
        contacts: contacts.success ? contacts.contacts || [] : [],
        profiles: profiles.success ? profiles.profiles || [] : [],
        roleDefaults: profiles.success ? profiles.roleDefaults || {} : {},
        eligibility: eligibility.success ? eligibility : null,
        audit: audit.success ? audit.entries || [] : [],
      });
      setLoading(false);
    }).catch(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const contacts = useMemo(() => data.contacts.filter((person) => `${person.name || ""} ${person.email || ""}`.toLowerCase().includes(query.toLowerCase())), [data.contacts, query]);
  const empty = t("engineering.permissions.prototype.emptyValue");
  const changeSection = (next) => {
    setSection(next);
    setTab(TABS[next][0] || "");
  };
  const roleFor = (person) => person.role || person.user_role || empty;
  const profileFor = (person) => data.roleDefaults[roleFor(person)]?.profileName || empty;
  const title = t(`engineering.permissions.prototype.sections.${section}`);

  const peoplePanel = () => {
    if (tab === "groups") {
      const groups = Object.values(data.contacts.reduce((all, person) => {
        const name = person.group_name || t("engineering.permissions.prototype.noGroup");
        all[name] = all[name] || { name, members: 0 };
        all[name].members += 1;
        return all;
      }, {}));
      return <PrototypeTable><thead><tr><HeadCell>{t("engineering.permissions.prototype.group")}</HeadCell><HeadCell>{t("engineering.permissions.prototype.members")}</HeadCell><HeadCell>{t("engineering.permissions.prototype.capabilities")}</HeadCell></tr></thead><tbody>{groups.map((group) => <tr key={group.name}><Cell className="font-bold">{group.name}</Cell><Cell>{group.members}</Cell><Cell>{t("engineering.permissions.prototype.emptyValue")}</Cell></tr>)}</tbody></PrototypeTable>;
    }
    if (tab === "administrators") {
      const admins = data.contacts.filter((person) => ["super_admin", "super admin", "admin"].includes(String(roleFor(person)).toLowerCase()));
      return <PeopleTable people={admins} roleFor={roleFor} profileFor={profileFor} t={t} empty={empty} />;
    }
    if (tab === "context") return <PeopleTable people={data.contacts} roleFor={roleFor} profileFor={profileFor} t={t} empty={empty} />;
    return <>
      <div className="mb-3 flex flex-wrap gap-2">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("engineering.permissions.prototype.searchPeople")} className="min-w-56 rounded-[var(--radius-sm)] border border-[var(--border-primary)] bg-surface-1 px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60" />
      </div>
      <PeopleTable people={contacts} roleFor={roleFor} profileFor={profileFor} t={t} empty={empty} />
    </>;
  };

  const profilesPanel = () => {
    if (tab === "contextRoles") return <RoleDefaultsTable defaults={data.roleDefaults} t={t} />;
    return <PrototypeTable><thead><tr><HeadCell>{t("engineering.permissions.prototype.profile")}</HeadCell><HeadCell>{t("engineering.permissions.prototype.description")}</HeadCell><HeadCell>{t("engineering.permissions.prototype.defaultFor")}</HeadCell></tr></thead><tbody>{data.profiles.map((profile) => <tr key={profile.id}><Cell className="font-bold">{profile.name}</Cell><Cell>{profile.description || t("engineering.permissions.prototype.emptyValue")}</Cell><Cell>{Object.entries(data.roleDefaults).filter(([, value]) => String(value.profileId) === String(profile.id)).map(([role]) => role).join(", ") || t("engineering.permissions.prototype.emptyValue")}</Cell></tr>)}</tbody></PrototypeTable>;
  };

  const rulesPanel = () => {
    if (tab === "responsibilities") return <RoleDefaultsTable defaults={data.roleDefaults} t={t} />;
    if (tab === "scope") return <RoleDefaultsTable defaults={data.roleDefaults} t={t} />;
    const eligibility = data.eligibility;
    const roles = [...new Set([...(eligibility?.roles || []), ...(eligibility?.extraRoles || [])])];
    const features = eligibility?.features || [];
    return <PrototypeTable><thead><tr><HeadCell>{t("engineering.permissions.prototype.identity")}</HeadCell>{features.map((feature) => <HeadCell key={feature}>{feature}</HeadCell>)}</tr></thead><tbody>{roles.map((role) => <tr key={role}><Cell className="font-bold">{role}</Cell>{features.map((feature) => { const state = eligibilityState(eligibility.rows || [], role, feature); return <Cell key={feature}><span className={`inline-flex min-w-8 justify-center rounded-[var(--radius-sm)] px-2 py-1 text-[10px] font-bold ${state === 1 ? "bg-emerald-500/10 text-emerald-500" : state === 0 ? "bg-rose-500/10 text-rose-500" : "bg-surface-3 text-[var(--text-secondary)]"}`}>{state === 1 ? t("engineering.permissions.prototype.allowed") : state === 0 ? t("engineering.permissions.prototype.denied") : empty}</span></Cell>; })}</tr>)}</tbody></PrototypeTable>;
  };

  const journalPanel = () => <PrototypeTable><thead><tr><HeadCell>{t("engineering.permissions.prototype.date")}</HeadCell><HeadCell>{t("engineering.permissions.prototype.actor")}</HeadCell><HeadCell>{t("engineering.permissions.prototype.target")}</HeadCell><HeadCell>{t("engineering.permissions.prototype.action")}</HeadCell><HeadCell>{t("engineering.permissions.prototype.details")}</HeadCell></tr></thead><tbody>{data.audit.map((entry, index) => <tr key={entry.id || index}><Cell>{entry.created_at ? new Date(entry.created_at).toLocaleString() : empty}</Cell><Cell>{entry.actor_name || empty}</Cell><Cell>{entry.target_name || empty}</Cell><Cell>{entry.action || empty}</Cell><Cell>{entry.details || entry.reason || empty}</Cell></tr>)}</tbody></PrototypeTable>;

  const panel = section === "people" ? peoplePanel() : section === "profiles" ? profilesPanel() : section === "rules" ? rulesPanel() : journalPanel();

  return <div className="mx-auto max-w-7xl pb-20">
    <header className="mb-4"><h1 className="text-xl font-black tracking-tight text-[var(--text-primary)]">{t("engineering.permissions.pageTitle")}</h1></header>
    <nav aria-label={t("engineering.permissions.shellNavAria")} className="mb-5 flex gap-1 overflow-x-auto border-b border-[var(--border-primary)]">
      {SECTION_KEYS.map((item) => <button key={item} onClick={() => changeSection(item)} className={`shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${section === item ? "border-[var(--brand-orange)] text-[var(--brand-orange)]" : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}>{t(`engineering.permissions.prototype.sections.${item}`)}</button>)}
    </nav>
    <h2 className="text-xl font-black tracking-tight text-[var(--text-primary)]">{title}</h2>
    <p className="mb-4 text-sm text-[var(--text-secondary)]">{t(`engineering.permissions.prototype.intro.${section}`)}</p>
    {TABS[section].length > 0 && <div className="mb-4 flex gap-1 overflow-x-auto border-b border-[var(--border-primary)]">{TABS[section].map((item) => <button key={item} onClick={() => setTab(item)} className={`shrink-0 border-b-2 px-3 py-2 text-sm transition-colors ${tab === item ? "border-[var(--brand-orange)] text-[var(--brand-orange)]" : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}>{t(`engineering.permissions.prototype.tabs.${item}`)}</button>)}</div>}
    {loading ? <div className="rounded-[var(--radius-md)] border border-[var(--border-primary)] p-6 text-sm text-[var(--text-secondary)]">{t("common.loading")}</div> : panel}
  </div>;
}

function PeopleTable({ people, roleFor, profileFor, t, empty }) {
  return <PrototypeTable><thead><tr><HeadCell>{t("engineering.permissions.prototype.name")}</HeadCell><HeadCell>{t("engineering.permissions.prototype.role")}</HeadCell><HeadCell>{t("engineering.permissions.prototype.profile")}</HeadCell><HeadCell>{t("engineering.permissions.prototype.status")}</HeadCell></tr></thead><tbody>{people.map((person) => <tr key={person.cid}><Cell className="font-bold">{person.name || person.email || person.cid}</Cell><Cell>{roleFor(person)}</Cell><Cell>{profileFor(person)}</Cell><Cell>{person.status || empty}</Cell></tr>)}</tbody></PrototypeTable>;
}

function RoleDefaultsTable({ defaults, t }) {
  return <PrototypeTable><thead><tr><HeadCell>{t("engineering.permissions.prototype.role")}</HeadCell><HeadCell>{t("engineering.permissions.prototype.profile")}</HeadCell><HeadCell>{t("engineering.permissions.prototype.status")}</HeadCell></tr></thead><tbody>{Object.entries(defaults).map(([role, profile]) => <tr key={role}><Cell className="font-bold">{role}</Cell><Cell>{profile.profileName || t("engineering.permissions.prototype.emptyValue")}</Cell><Cell>{t("engineering.permissions.prototype.active")}</Cell></tr>)}</tbody></PrototypeTable>;
}

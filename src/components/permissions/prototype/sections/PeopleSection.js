"use client";

/**
 * Section 1 — People: "what can this person do, exactly?"
 *
 * Four tabs, exactly as the prototype shows them: the person list (with the
 * lazy effective-rights column), the group registry, the platform-wide
 * administrators, and the contextual assignments grouped by program.
 *
 * Every row opens something real: a person opens their detail, a group opens
 * its drawer, a role holder opens the promotion confirm.
 */

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import AppButton from "@/components/ui/AppButton";
import AppPagination from "@/components/ui/AppPagination";
import { buildRightRows, countRights } from "../personAccess";
import {
  Cell,
  ClickRow,
  EmptyRow,
  HeadCell,
  Kpi,
  KpiRow,
  Note,
  PrototypeTable,
  Toolbar,
} from "../prototypeUi";

const PAGE_SIZE = 25;
const NO_GROUP = "\u0000no-group";

const isSuperAdmin = (person) => String(person.role || "").toLowerCase() === "super_admin";

export default function PeopleSection({ data, tab, openDrawer, onOpenPerson }) {
  if (tab === "groups") return <GroupsTab data={data} openDrawer={openDrawer} />;
  if (tab === "administrators") return <AdministratorsTab data={data} openDrawer={openDrawer} />;
  if (tab === "context") return <ContextTab data={data} onOpenPerson={onOpenPerson} />;
  return <PeopleTab data={data} onOpenPerson={onOpenPerson} openDrawer={openDrawer} />;
}

/* ---------------------------------------------------------------- people -- */

function PeopleTab({ data, onOpenPerson, openDrawer }) {
  const { t } = useI18n();
  const { contacts = [], roleDefaults = {} } = data;
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [counts, setCounts] = useState(null);
  const [counting, setCounting] = useState(false);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return contacts;
    return contacts.filter((person) =>
      `${person.name || ""} ${person.email || ""} ${person.cid}`.toLowerCase().includes(needle),
    );
  }, [contacts, query]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const profileName = (person) => {
    const role = person.role || "";
    return roleDefaults[role]?.profileName || t("engineering.permissions.prototype.emptyValue");
  };

  const loadRights = async () => {
    setCounting(true);
    try {
      const results = await Promise.all(
        visible.map((person) =>
          fetch(`/api/engineering/permissions/user-context?cid=${encodeURIComponent(person.cid)}`)
            .then((response) => response.json())
            .catch(() => null),
        ),
      );
      const next = { ...(counts || {}) };
      visible.forEach((person, index) => {
        const context = results[index];
        if (!context?.success) return;
        const rows = buildRightRows({
          ctx: context,
          catalog: data.catalog || {},
          moduleToFeature: data.moduleToFeature || {},
        });
        next[person.cid] = countRights(rows).effective;
      });
      setCounts(next);
    } finally {
      setCounting(false);
    }
  };

  return (
    <>
      <KpiRow>
        <Kpi value={contacts.length} label={t("engineering.permissions.prototype.people")} />
        <Kpi value={counts ? Object.keys(counts).length : "—"} label={t("engineering.permissions.prototype.rightsCount")} />
      </KpiRow>

      <Toolbar>
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
          placeholder={t("engineering.permissions.prototype.searchPeople")}
          aria-label={t("engineering.permissions.prototype.searchPeople")}
          className="min-w-56 flex-1 rounded-[var(--radius-sm)] border border-[var(--border-primary)] bg-surface-1 px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60"
        />
        <AppButton variant="secondary" onClick={() => openDrawer({ kind: "check" })}>
          {t("engineering.permissions.prototype.checkOpen")}
        </AppButton>
        <AppButton variant="secondary" onClick={loadRights} disabled={counting}>
          {counting ? t("common.loading") : t("engineering.permissions.prototype.loadRights")}
        </AppButton>
      </Toolbar>

      <PrototypeTable minWidth="44rem">
        <thead>
          <tr>
            <HeadCell>{t("engineering.permissions.prototype.name")}</HeadCell>
            <HeadCell>{t("engineering.permissions.prototype.role")}</HeadCell>
            <HeadCell>{t("engineering.permissions.prototype.profile")}</HeadCell>
            <HeadCell>{t("engineering.permissions.prototype.status")}</HeadCell>
            <HeadCell>{t("engineering.permissions.prototype.rightsCount")}</HeadCell>
          </tr>
        </thead>
        <tbody>
          {visible.length === 0 && <EmptyRow colSpan={5} label={t("common.noResults")} />}
          {visible.map((person) => (
            <ClickRow key={person.cid} onClick={() => onOpenPerson(person)}>
              <Cell className="font-bold">{person.name || person.email || person.cid}</Cell>
              <Cell>{person.role || t("engineering.permissions.prototype.emptyValue")}</Cell>
              <Cell>{profileName(person)}</Cell>
              <Cell>{person.status || t("engineering.permissions.prototype.emptyValue")}</Cell>
              <Cell>{counts?.[person.cid] ?? t("engineering.permissions.prototype.emptyValue")}</Cell>
            </ClickRow>
          ))}
        </tbody>
      </PrototypeTable>

      <AppPagination currentPage={current} totalPages={pages} onPageChange={setPage} className="mt-3" />
    </>
  );
}

/* ---------------------------------------------------------------- groups -- */

function GroupsTab({ data, openDrawer }) {
  const { t } = useI18n();
  const { contacts = [], groupDefaults = [], eligibilityMatrix = {}, features = [] } = data;

  const groups = useMemo(() => {
    const byName = {};
    for (const contact of contacts) {
      const name = contact.group_name;
      if (!name) continue;
      byName[name] = byName[name] || { name, members: 0, roles: new Set() };
      byName[name].members += 1;
      if (contact.role) byName[name].roles.add(contact.role);
    }
    return Object.values(byName)
      .map((group) => {
        const roles = [...group.roles];
        const eligible = features.filter((feature) =>
          roles.some((role) => eligibilityMatrix[role]?.[feature] === 1),
        );
        return {
          ...group,
          capabilities: groupDefaults.filter((row) => row.group_name === group.name).length,
          roles,
          eligible,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [contacts, groupDefaults, eligibilityMatrix, features]);

  return (
    <>
      <Note>{t("engineering.permissions.prototype.groupsHint")}</Note>
      <PrototypeTable minWidth="32rem">
        <thead>
          <tr>
            <HeadCell>{t("engineering.permissions.prototype.group")}</HeadCell>
            <HeadCell>{t("engineering.permissions.prototype.members")}</HeadCell>
            <HeadCell>{t("engineering.permissions.prototype.role")}</HeadCell>
            <HeadCell>{t("engineering.permissions.prototype.capabilities")}</HeadCell>
            <HeadCell>{t("engineering.permissions.prototype.eligibility")}</HeadCell>
          </tr>
        </thead>
        <tbody>
          {groups.length === 0 && <EmptyRow colSpan={5} label={t("common.noResults")} />}
          {groups.map((group) => (
            <ClickRow key={group.name} onClick={() => openDrawer({ kind: "group", group: group.name })}>
              <Cell className="font-bold">{group.name}</Cell>
              <Cell>{group.members}</Cell>
              <Cell>{group.roles.join(", ") || t("engineering.permissions.prototype.emptyValue")}</Cell>
              <Cell>{group.capabilities}</Cell>
              <Cell>{group.eligible.join(", ") || t("engineering.permissions.prototype.emptyValue")}</Cell>
            </ClickRow>
          ))}
        </tbody>
      </PrototypeTable>
    </>
  );
}

/* -------------------------------------------------------- administrators -- */

function AdministratorsTab({ data, openDrawer }) {
  const { t } = useI18n();
  const { contacts = [] } = data;
  const [selected, setSelected] = useState("");

  const admins = contacts.filter(isSuperAdmin);
  const candidates = contacts.filter((person) => !isSuperAdmin(person));

  return (
    <>
      <Note>{t("engineering.permissions.prototype.adminsIntro")}</Note>

      <PrototypeTable minWidth="32rem">
        <thead>
          <tr>
            <HeadCell>{t("engineering.permissions.prototype.name")}</HeadCell>
            <HeadCell>{t("engineering.permissions.prototype.role")}</HeadCell>
            <HeadCell />
          </tr>
        </thead>
        <tbody>
          {admins.length === 0 && <EmptyRow colSpan={3} label={t("engineering.permissions.prototype.adminsNone")} />}
          {admins.map((person) => (
            <tr key={person.cid}>
              <Cell className="font-bold">{person.name || person.email || person.cid}</Cell>
              <Cell>{person.role}</Cell>
              <Cell className="text-right">
                <AppButton
                  variant="secondary"
                  onClick={() => openDrawer({ kind: "promote", person, mode: "remove" })}
                >
                  {t("engineering.permissions.prototype.adminsRemove")}
                </AppButton>
              </Cell>
            </tr>
          ))}
        </tbody>
      </PrototypeTable>

      <Toolbar>
        <select
          className="min-w-56 flex-1 rounded-[var(--radius-sm)] border border-[var(--border-primary)] bg-surface-1 px-2.5 py-1.5 text-sm text-[var(--text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60"
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
          aria-label={t("engineering.permissions.prototype.adminsSelect")}
        >
          <option value="">{t("engineering.permissions.prototype.adminsSelect")}</option>
          {candidates.map((person) => (
            <option key={person.cid} value={person.cid}>
              {person.name || person.email || person.cid}
            </option>
          ))}
        </select>
        <AppButton
          disabled={!selected}
          onClick={() => {
            const person = candidates.find((item) => item.cid === selected);
            if (person) openDrawer({ kind: "promote", person, mode: "promote" });
            setSelected("");
          }}
        >
          {t("engineering.permissions.prototype.adminsPromote")}
        </AppButton>
      </Toolbar>
    </>
  );
}

/* --------------------------------------------------------------- context -- */

function ContextTab({ data, onOpenPerson }) {
  const { t } = useI18n();
  const { contacts = [] } = data;

  const programs = useMemo(() => {
    const byProgram = {};
    for (const contact of contacts) {
      const key = contact.program_name || NO_GROUP;
      byProgram[key] = byProgram[key] || {
        name: key === NO_GROUP ? null : key,
        members: [],
        roles: new Set(),
      };
      byProgram[key].members.push(contact);
      if (contact.role) byProgram[key].roles.add(contact.role);
    }
    return Object.values(byProgram).sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || "")),
    );
  }, [contacts]);

  return (
    <>
      <Note>{t("engineering.permissions.prototype.contextHint")}</Note>
      <PrototypeTable minWidth="32rem">
        <thead>
          <tr>
            <HeadCell>{t("engineering.permissions.prototype.program")}</HeadCell>
            <HeadCell>{t("engineering.permissions.prototype.members")}</HeadCell>
            <HeadCell>{t("engineering.permissions.prototype.role")}</HeadCell>
          </tr>
        </thead>
        <tbody>
          {programs.length === 0 && <EmptyRow colSpan={3} label={t("common.noResults")} />}
          {programs.map((program) => (
            <ClickRow
              key={program.name || NO_GROUP}
              onClick={() => program.members[0] && onOpenPerson(program.members[0])}
            >
              <Cell className="font-bold">
                {program.name || t("engineering.permissions.prototype.noProgram")}
              </Cell>
              <Cell>{program.members.length}</Cell>
              <Cell>
                {[...program.roles].join(", ") || t("engineering.permissions.prototype.emptyValue")}
              </Cell>
            </ClickRow>
          ))}
        </tbody>
      </PrototypeTable>
    </>
  );
}

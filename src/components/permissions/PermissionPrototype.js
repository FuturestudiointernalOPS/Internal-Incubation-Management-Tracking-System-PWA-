"use client";

/**
 * The approved "Centre de permissions" — the shell the four sections render
 * inside: section navigation with its health badges, the deep links
 * (`?sub=` for a tab, `?cid=` for a person), and every drawer of the centre.
 *
 * Routes pass `initialSection`; navigation between sections is REAL routing
 * (a link per door), so a section is always a shareable URL. Data comes from
 * the one read (`usePrototypeData`), shared by all four sections.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { PERMISSION_NAV } from "./permissionNav";
import { defer } from "./effectUtils";
import {
  NAV_KEY_TO_SECTION,
  PROTOTYPE_SECTIONS,
  firstTab,
  sectionTabs,
} from "./prototype/prototypeNav";
import usePrototypeData from "./prototype/usePrototypeData";
import AccessCheckDrawer from "./prototype/drawers/AccessCheckDrawer";
import EditRightDrawer from "./prototype/drawers/EditRightDrawer";
import GroupDrawer from "./prototype/drawers/GroupDrawer";
import ProfileFeatureDrawer from "./prototype/drawers/ProfileFeatureDrawer";
import CreateProfileDrawer from "./prototype/drawers/CreateProfileDrawer";
import PromoteAdminDrawer from "./prototype/drawers/PromoteAdminDrawer";
import PeopleSection from "./prototype/sections/PeopleSection";
import PersonDetail from "./prototype/sections/PersonDetail";
import ProfilesSection from "./prototype/sections/ProfilesSection";
import RulesSection from "./prototype/sections/RulesSection";
import JournalSection from "./prototype/sections/JournalSection";
import { Note } from "./prototype/prototypeUi";

const SECTION_HREF = PERMISSION_NAV.reduce((map, item) => {
  const section = NAV_KEY_TO_SECTION[item.key];
  if (section) map[section] = item.href;
  return map;
}, {});

function readParam(name) {
  try {
    return new URLSearchParams(window.location.search).get(name) || "";
  } catch {
    return "";
  }
}

function writeParam(name, value) {
  try {
    const url = new URL(window.location.href);
    if (value) url.searchParams.set(name, value);
    else url.searchParams.delete(name);
    window.history.replaceState(null, "", url);
  } catch {
    /* the URL is cosmetic; the state is what renders */
  }
}

export default function PermissionPrototype({ initialSection = "people" }) {
  const { t } = useI18n();
  const data = usePrototypeData();
  const [tab, setTab] = useState(firstTab(initialSection));
  const [personCid, setPersonCid] = useState("");
  const [drawer, setDrawer] = useState(null);
  const [revision, setRevision] = useState(0);

  // The section is the route; a new route starts its own deep links.
  useEffect(() => {
    defer(() => {
      const sub = readParam("sub");
      const valid = sectionTabs(initialSection);
      setTab(valid.includes(sub) ? sub : firstTab(initialSection));
      setPersonCid(initialSection === "people" ? readParam("cid") : "");
    });
  }, [initialSection]);

  const changeTab = (next) => {
    setTab(next);
    writeParam("sub", next);
  };

  const openPerson = (person) => {
    setPersonCid(person.cid);
    writeParam("cid", person.cid);
  };

  const closePerson = () => {
    setPersonCid("");
    writeParam("cid", "");
  };

  const refreshSaved = (part) => () => data.refresh(part);
  const person =
    personCid && data.contacts.find((contact) => String(contact.cid) === String(personCid));

  const sectionTitle = t(`engineering.permissions.prototype.sections.${initialSection}`);
  const badges = data.badges || {};

  return (
    <div className="mx-auto max-w-7xl pb-20">
      <header className="mb-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
          <Link href="/admin/security" className="transition-colors hover:text-[var(--text-primary)]">
            {t("engineering.permissions.breadcrumbSecurity")}
          </Link>
        </p>
        <h1 className="text-xl font-black tracking-tight text-[var(--text-primary)]">
          {t("engineering.permissions.pageTitle")}
        </h1>
      </header>

      <nav
        aria-label={t("engineering.permissions.shellNavAria")}
        className="mb-5 flex gap-1 overflow-x-auto border-b border-[var(--border-primary)]"
      >
        {PROTOTYPE_SECTIONS.map((section) => {
          const active = section === initialSection;
          const badge = badges[section] || 0;
          return (
            <Link
              key={section}
              href={SECTION_HREF[section] || "#"}
              aria-current={active ? "page" : undefined}
              className={`shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60 ${
                active
                  ? "border-[var(--brand-orange)] text-[var(--brand-orange)]"
                  : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {t(`engineering.permissions.prototype.sections.${section}`)}
              {badge > 0 && (
                <span className="ml-1.5 inline-flex min-w-4 justify-center rounded-full bg-amber-500/15 px-1 text-[10px] font-bold text-amber-500">
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <h2 className="text-xl font-black tracking-tight text-[var(--text-primary)]">{sectionTitle}</h2>
      <p className="mb-4 text-sm text-[var(--text-secondary)]">
        {t(`engineering.permissions.prototype.intro.${initialSection}`)}
      </p>

      {data.error && <Note>{t("engineering.permissions.networkError")}</Note>}
      {data.loading && <Note>{t("common.loading")}</Note>}

      {person ? (
        <PersonDetail
          person={person}
          data={data}
          revision={revision}
          onBack={closePerson}
          openDrawer={setDrawer}
        />
      ) : (
        <>
          {sectionTabs(initialSection).length > 0 && (
            <div className="mb-4 flex gap-1 overflow-x-auto border-b border-[var(--border-primary)]">
              {sectionTabs(initialSection).map((item) => (
                <button
                  key={item}
                  onClick={() => changeTab(item)}
                  className={`shrink-0 border-b-2 px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60 ${
                    tab === item
                      ? "border-[var(--brand-orange)] text-[var(--brand-orange)]"
                      : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {t(`engineering.permissions.prototype.tabs.${item}`)}
                </button>
              ))}
            </div>
          )}

          {initialSection === "people" && (
            <PeopleSection data={data} tab={tab} openDrawer={setDrawer} onOpenPerson={openPerson} />
          )}
          {initialSection === "profiles" && (
            <ProfilesSection data={data} tab={tab} openDrawer={setDrawer} />
          )}
          {initialSection === "rules" && (
            <RulesSection data={data} tab={tab} refresh={data.refresh} />
          )}
          {initialSection === "journal" && (
            <JournalSection
              data={data}
              refresh={data.refresh}
              onGoTo={(section, nextTab) => {
                const href = SECTION_HREF[section];
                if (href) window.location.href = nextTab ? `${href}?sub=${nextTab}` : href;
              }}
            />
          )}
        </>
      )}

      {drawer?.kind === "check" && <AccessCheckDrawer data={data} onClose={() => setDrawer(null)} />}
      {drawer?.kind === "edit" && (
        <EditRightDrawer
          person={drawer.person}
          row={drawer.row}
          onClose={() => setDrawer(null)}
          onSaved={() => {
            data.refresh("contacts");
            data.refresh("audit");
            setRevision((value) => value + 1);
          }}
        />
      )}
      {drawer?.kind === "group" && (
        <GroupDrawer
          group={drawer.group}
          data={data}
          onClose={() => setDrawer(null)}
          onOpenPerson={(contact) => {
            setDrawer(null);
            openPerson(contact);
          }}
        />
      )}
      {drawer?.kind === "profileFeature" && (
        <ProfileFeatureDrawer
          profile={drawer.profile}
          feature={drawer.feature}
          data={data}
          onClose={() => setDrawer(null)}
          onSaved={() => {
            data.refresh("profiles");
            data.refresh("audit");
          }}
        />
      )}
      {drawer?.kind === "createProfile" && (
        <CreateProfileDrawer
          data={data}
          onClose={() => setDrawer(null)}
          onSaved={() => {
            data.refresh("profiles");
            // A new profile is a new ceiling identity: refresh the matrix so it
            // can be opened to features in Rules → Eligibility.
            data.refresh("eligibility");
            data.refresh("audit");
          }}
        />
      )}
      {drawer?.kind === "promote" && (
        <PromoteAdminDrawer
          person={drawer.person}
          mode={drawer.mode}
          onClose={() => setDrawer(null)}
          onSaved={refreshSaved("contacts")}
        />
      )}
    </div>
  );
}

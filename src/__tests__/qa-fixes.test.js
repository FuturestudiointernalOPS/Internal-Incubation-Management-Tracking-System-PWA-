/**
 * @jest-environment jsdom
 *
 * Regression pins for the defects found by the QA campaign. Each test names the
 * defect it keeps from coming back.
 */
import { cleanup, render, screen } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const { I18nProvider, useI18n } = require("@/lib/i18n");

function Probe({ k, params }) {
  const { t } = useI18n();
  return <p data-testid="out">{t(k, params)}</p>;
}
const say = (k, params) => {
  cleanup();
  render(<I18nProvider><Probe k={k} params={params} /></I18nProvider>);
  return screen.getByTestId("out").textContent;
};

describe("Data Room strings interpolate (no literal braces)", () => {
  test("{size}, {percent}, {title}, {count} are replaced", () => {
    expect(say("dataRoom.uploadHint", { size: 10 })).toMatch(/Maximum 10 MB\.$/);
    expect(say("dataRoom.completeness.percent", { percent: 40 })).toBe("40% ready");
    expect(say("dataRoom.deleteConfirm", { title: "Statutes" })).toContain('"Statutes"');
    expect(say("dataRoom.history.showAll", { count: 7 })).toBe("Show all 7");
  });

  test("no Data Room string uses the double-brace form the translator does not read", () => {
    for (const lang of ["en", "fr"]) expect(read(`src/locales/${lang}/dataRoom.json`)).not.toContain("{{");
  });

  test("platform email templates keep their {{placeholders}} on purpose", () => {
    expect(read("src/locales/en/platformMisc.json")).toContain("{{name}}");
  });
});

describe("the page language follows the chosen language", () => {
  test("the provider writes <html lang>", () => {
    document.documentElement.lang = "xx";
    say("common.save");
    expect(document.documentElement.lang).toBe("en");
  });
});

describe("source pins", () => {
  test("the founder journey offers no Report button (the notes API refuses founders)", () => {
    const source = read("src/components/ventures/workspace/tabs/JourneyPlaybookTabs/FounderMilestoneDeliverables.js");
    expect(source).not.toContain("<ActivityReport");
    expect(source).not.toContain("components/ventures/journey/ActivityReport");
  });

  test("the founder venture tab lives in the address", () => {
    const page = read("src/app/participant/ventures/[id]/page.js");
    expect(page).toContain('searchParams?.get("tab")');
    expect(page).toContain("?tab=${section}");
    expect(page).not.toContain("setActiveTab");
  });

  test("an unknown or forbidden venture says so", () => {
    const screenSource = read("src/components/participant/ventures/VentureWorkspaceScreen.js");
    expect(screenSource).toContain('t("venture.notFound")');
    expect(read("src/locales/en/venture.json")).toContain('"notFound"');
    expect(read("src/locales/fr/venture.json")).toContain('"notFound"');
  });

  test("the roster is not 'empty' until it has answered", () => {
    const tabs = read("src/components/ventures/workspace/tabs/MembersTabs.js");
    expect(tabs).toContain("!membersLoading && members.length === 0");
  });

  test("a search that matches nothing does not claim the category is empty", () => {
    const room = read("src/components/ventures/data-room/VentureDataRoom.js");
    expect(room).toContain('t("dataRoom.noMatch")');
  });

  test("the Google fonts the app loads are allowed by the policy", () => {
    const config = read("next.config.mjs");
    expect(config).toContain("https://fonts.gstatic.com");
    expect(config).toContain("https://fonts.googleapis.com");
  });

  test("the Data Room viewer refuses a reference that names no Venture before any query", () => {
    const access = read("src/services/ventures/dataRoom/access.js");
    expect(access).toContain('reason: "not-found"');
  });

  test("the operating sections are behind the role guard", () => {
    for (const section of ["staff", "pm", "finance", "crm"]) {
      expect(read(`src/app/${section}/layout.js`)).toContain("SectionRoleGuard");
    }
  });
});

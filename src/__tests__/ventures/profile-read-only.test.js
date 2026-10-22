/**
 * @jest-environment jsdom
 *
 * The founders' profile, read-only, for the Super Admin and the Lead Manager.
 */
import { render, screen } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";

const { I18nProvider } = require("@/lib/i18n");
const VentureProfileReadOnly = require("@/components/ventures/VentureProfileReadOnly").default;

const venture = {
  name: "AgroTech",
  description: "testing an idea",
  mission: "good",
  vision: "goodé",
  industry: "",
  sector: "",
  business_stage: "idea",
  website: "https://agrotech.example",
  country_code: "BJ",
  registration_status: "Registered",
  social_media: { linkedin: "https://www.linkedin.com/company/agrotech", instagram: "", twitter: "", facebook: "" },
};

const view = (v = venture) => render(<I18nProvider><VentureProfileReadOnly venture={v} /></I18nProvider>);

test("shows every field the founder fills in, with their values", () => {
  view();
  expect(screen.getByText("AgroTech")).toBeTruthy();
  expect(screen.getByText("testing an idea")).toBeTruthy();
  expect(screen.getByText("good")).toBeTruthy();
  expect(screen.getByText("goodé")).toBeTruthy();
  for (const label of ["Venture name", "Description", "Mission", "Vision", "Industry", "Sector", "Business Stage", "Website", "Country", "Business Registration Status", "Social Media", "LinkedIn", "Instagram", "X", "Facebook"]) {
    expect(screen.getAllByText(label).length).toBeGreaterThan(0);
  }
});

test("links open the stored address; empty values read as a dash", () => {
  view();
  expect(screen.getByText("https://agrotech.example").closest("a").getAttribute("href")).toBe("https://agrotech.example");
  expect(screen.getAllByText("—").length).toBeGreaterThan(0);
});

test("it is read-only: no input, no textarea, no save", () => {
  const { container } = view();
  expect(container.querySelectorAll("input, textarea, select, button")).toHaveLength(0);
});

test("the Super Admin hub and the Lead Manager workspace both render it", () => {
  const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
  expect(read("src/components/admin/ventures/VentureDetailView.js")).toContain("<VentureProfileReadOnly venture={venture} />");
  const staff = read("src/app/staff/ventures/[id]/page.js");
  expect(staff).toContain('id: "profile"');
  expect(staff).toMatch(/id: "profile".*leadManagerOnly: true/);
  expect(staff).toContain("<VentureProfileReadOnly venture={venture} />");
});

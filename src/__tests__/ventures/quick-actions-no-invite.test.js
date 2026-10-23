/**
 * @jest-environment jsdom
 *
 * Inviting a founder moved under the venture header's Staff menu: the quick
 * actions card no longer carries that button.
 */
import { render, screen } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));

const { I18nProvider } = require("@/lib/i18n");
const QuickActions = require("@/components/ventures/venture-dashboard/QuickActions").default;

test("the quick actions no longer offer Invite Founder", () => {
  render(<I18nProvider><QuickActions id="VNT-1" /></I18nProvider>);
  expect(screen.queryByText(/Invite Founder|Inviter/i)).toBeNull();
  expect(screen.getByText(/Edit Venture|Modifier/i)).toBeTruthy();
});

test("the Staff menu offers Add Lead Manager and Invite Founder", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "src/components/admin/ventures/VentureHubNav.js"), "utf8");
  expect(source).toContain('t("vadmin.detail.addLeadManager")');
  expect(source).toContain('t("vadmin.dashboard.inviteFounder")');
  expect(source).toContain("${base}/founders");
});

/** @jest-environment jsdom */
/**
 * Point 1 — the owner goes through the same path in the INTERFACE.
 *
 * The server resolves the owner through the engine behind
 * AUTHZ_OWNER_THROUGH_ENGINE, but the screens used to short-circuit every
 * capability on the identity alone: a revoked right kept looking granted.
 *
 * The rule is one boolean pair:
 *   - `isSuperAdmin`  — an identity fact;
 *   - `ownerThroughEngine` — the owner is resolved like everyone else.
 * A capability is short-circuited ONLY while the second is false.
 */

import React from "react";
import { render, cleanup } from "@testing-library/react";

let mockRead = {
  permissions: { reports: { view: 1 } },
  isSuperAdmin: true,
  ownerThroughEngine: true,
  profiles: [],
};

jest.mock("@/lib/hooks/useApi", () => ({
  useApi: () => ({ data: mockRead, loading: false, error: null, refresh: jest.fn() }),
}));

const { PermissionProvider, usePermissions } = require("@/lib/PermissionProvider");

function Probe() {
  const { can, isSuperAdmin, ownerThroughEngine } = usePermissions();
  return (
    <div>
      <span data-testid="reports">{String(can("reports", "view"))}</span>
      <span data-testid="crm">{String(can("crm", "view"))}</span>
      <span data-testid="owner">{String(isSuperAdmin)}</span>
      <span data-testid="mode">{String(ownerThroughEngine)}</span>
    </div>
  );
}

const renderProbe = () =>
  render(
    <PermissionProvider>
      <Probe />
    </PermissionProvider>,
  );

const valueOf = (testId) => document.querySelector(`[data-testid="${testId}"]`).textContent;

beforeEach(() => {
  mockRead = {
    permissions: { reports: { view: 1 } },
    isSuperAdmin: true,
    ownerThroughEngine: true,
    profiles: [],
  };
});

afterEach(() => cleanup());

describe("the owner is not short-circuited once resolved through the engine", () => {
  test("a right the owner holds still reads as allowed", () => {
    renderProbe();
    expect(valueOf("reports")).toBe("true");
  });

  test("a right the owner no longer holds reads as denied", () => {
    renderProbe();
    expect(valueOf("crm")).toBe("false");
    // The identity is still published — it is the bypass that is gone.
    expect(valueOf("owner")).toBe("true");
    expect(valueOf("mode")).toBe("true");
  });

  test("while the bypass is active the owner keeps everything", () => {
    mockRead = { ...mockRead, ownerThroughEngine: false };
    renderProbe();
    expect(valueOf("crm")).toBe("true");
    expect(valueOf("reports")).toBe("true");
    expect(valueOf("mode")).toBe("false");
  });
});

describe("the same rule reaches every capability surface", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const read = (relative) => fs.readFileSync(path.join(process.cwd(), relative), "utf8");

  test("the permissions endpoint publishes the mode", () => {
    expect(read("src/app/api/me/permissions/route.js")).toContain(
      "ownerThroughEngine: !!ctx?.ownerThroughEngine",
    );
  });

  test("the platform sidebar applies it", () => {
    expect(read("src/app/platform/layout.js")).toContain(
      "mePerms.isSuperAdmin && !mePerms.ownerThroughEngine",
    );
  });

  test("the CRM capability hook applies it", () => {
    expect(read("src/components/shared/crm/useCrmCapabilities.js")).toContain(
      "state.isSuperAdmin && !state.ownerThroughEngine",
    );
  });

  test("the shared permission provider applies it", () => {
    expect(read("src/lib/PermissionProvider.js")).toContain(
      "isSuperAdmin && !ownerThroughEngine",
    );
  });
});

describe("display shortcuts are rights, not identities", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const read = (relative) => fs.readFileSync(path.join(process.cwd(), relative), "utf8");

  test("the full contacts screen opens on the write rights", () => {
    const page = read("src/app/staff/crm/contacts/page.js");
    expect(page).toContain('holds("contacts", "create")');
    expect(page).toContain('holds("contacts", "edit")');
    expect(page).not.toContain("isSuperAdmin");
  });

  test("the next-action editor opens on the support right", () => {
    for (const page of [
      "src/app/staff/crm/leads/[id]/page.js",
      "src/app/staff/crm/opportunities/[id]/page.js",
    ]) {
      const source = read(page);
      expect(source).toContain('holds("crm", "next_action_any")');
      expect(source).toContain('holds("crm", "edit")');
      expect(source).not.toContain("isSuperAdmin");
    }
  });

  test("the next-action decision is a right, never a session role", () => {
    const service = read("src/services/crm/nextAction.js");
    expect(service).toContain("canSetAny");
    expect(service).not.toContain("isPlatformOwnerRole");

    for (const route of [
      "src/app/api/crm/leads/[id]/route.js",
      "src/app/api/crm/opportunities/[id]/route.js",
    ]) {
      expect(read(route)).toContain('"next_action_any"');
    }
  });

  test("the dead full-state overview is gone", () => {
    expect(
      fs.existsSync(path.join(process.cwd(), "src/components/shared/crm/CrmOverview.js")),
    ).toBe(false);
  });
});

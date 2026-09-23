/**
 * DB AUDIT — the hot screens, measured through the sequencer.
 *
 * Measures each request's own database traffic through ./helpers/dbSequencer.js
 * and asserts a budget per screen, so a change that re-introduces a sequential
 * step or a per-load extra fails the build:
 *   - platform form-runs, run detail  (was twelve sequential reads)
 *   - pm/full-state, the program bundle
 *   - contacts/full-state, the registry (and its once-per-window self-heal)
 */

import { createSequencer as mockCreateSequencer } from "./helpers/dbSequencer";

const SESSION = {
  cid: "USER_AUDIT_1",
  name: "Audit Tester",
  email: "audit@example.com",
  role: "super_admin",
  group_name: "FUTURE STUDIO",
  token: "token",
};

/** A generic SELECT row, wide enough that no reader trips on a missing field. */
const genericRow = {
  id: 1,
  name: "Row",
  cid: "USER_AUDIT_1",
  email: "person@example.com",
  form_id: 7,
  note_id: 7,
  run_id: 1,
  submitter_id: "USER_AUDIT_1",
  submitter_name: "Person",
  target_type: "user",
  target_id: "USER_AUDIT_1",
  status: "active",
  settings: {},
  data: {},
  options: [],
  label: "Label",
  kpi_ids: [],
  contact_cid: "USER_AUDIT_1",
  used: 0,
  expires_at: "2099-01-01T00:00:00Z",
};

const mockSequencer = mockCreateSequencer({
  rowsFor: (sql) => {
    // The staleness question must answer "recent", so a measurement is not
    // inflated by a recalculation it is not measuring.
    if (/MAX\(\s*calculated_at\s*\)/i.test(sql)) {
      return [{ last: new Date().toISOString() }];
    }
    if (/count\s*\(/i.test(sql)) return [{ c: "0", n: 0, total: 0 }];
    return [genericRow];
  },
});

jest.mock("next/headers", () => ({
  cookies: jest.fn(async () => ({ get: () => ({ value: "token" }) })),
}));

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: (...args) => mockSequencer.execute(...args) },
  initDb: jest.fn(async () => ({ execute: (...args) => mockSequencer.execute(...args) })),
  getDbMetrics: jest.fn(() => ({})),
}));

jest.mock("@/lib/authorization", () => {
  const actual = jest.requireActual("@/lib/authorization");
  return {
    ...actual,
    requireAuthorization: jest.fn(async () => null),
    getAuthorizationContext: jest.fn(async () => null),
  };
});

jest.mock("@/lib/auth", () => {
  const actual = jest.requireActual("@/lib/auth");
  return {
    ...actual,
    requireAuth: jest.fn(async () => null),
    requireSession: jest.fn(async () => SESSION),
    getSession: jest.fn(async () => SESSION),
  };
});

function describeWaves(report) {
  return report.records
    .map((record, i) => `  w${record.wave} ${i + 1}. ${record.sql.replace(/\s+/g, " ").trim().slice(0, 58)}`)
    .join("\n");
}

// ─── Platform form-runs — the run detail screen ──────────────────────────────

describe("GET /api/platform/form-runs?id=<run>", () => {
  test("the run detail reads go out in as few waves as its dependencies allow", async () => {
    const { GET } = require("@/app/api/platform/form-runs/route");
    const url = "http://localhost/api/platform/form-runs?id=1";

    await GET(new Request(url));
    jest.resetModules();
    mockSequencer.reset();

    const res = await GET(new Request(url));
    const report = mockSequencer.report();
    console.log(
      `form-runs detail: ${report.statements} statements · ${report.waves} waves · ` +
        `burst ${report.maxInFlight} · status ${res.status}`,
    );
    console.log(describeWaves(report));

    expect(res.status).toBe(200);
    // Twelve reads that used to be awaited one after another. The run is the
    // only read the rest depends on; the wave that follows it carries the seven
    // reads that need just the run id, the contact lookups overlap the
    // assignment enrichment, and the token lookup follows the contacts.
    expect(report.statements).toBeLessThanOrEqual(12);
    expect(report.waves).toBeLessThanOrEqual(5);
    // Never the whole pool: a burst here must leave a connection for another
    // request arriving at the same instant.
    expect(report.maxInFlight).toBeLessThanOrEqual(8);
  });
});

// ─── Program Full State — the PM/Super-Admin program workspace ───────────────

describe("GET /api/pm/full-state?id=<program>", () => {
  test("the bundle is one wave and the per-load extras are gone", async () => {
    // Same module registry across both calls: the measured load is the one a
    // user pays every time, after the once-per-process work is paid.
    const { GET } = require("@/app/api/pm/full-state/route");
    const url = "http://localhost/api/pm/full-state?id=1&metrics=true";

    await GET(new Request(url));
    mockSequencer.reset();

    const res = await GET(new Request(url));
    const report = mockSequencer.report();
    console.log(
      `pm/full-state: ${report.statements} statements · ${report.waves} waves · ` +
        `burst ${report.maxInFlight} · status ${res.status}`,
    );
    console.log(describeWaves(report));

    expect(res.status).toBe(200);
    // The fourteen-read bundle goes out together (one wave), then the persisted
    // progress read. The note's attachments ride along with the program row and
    // the staleness question is asked at most once per window, so neither adds a
    // statement or a wave here.
    expect(report.statements).toBeLessThanOrEqual(15);
    expect(report.waves).toBeLessThanOrEqual(2);
  });
});

// ─── Contacts registry — the personnel hub ───────────────────────────────────

describe("GET /api/contacts/full-state", () => {
  test("the registry pays for its self-heal once, not on every read", async () => {
    const { GET } = require("@/app/api/contacts/full-state/route");
    const url = "http://localhost/api/contacts/full-state";

    await GET(new Request(url)); // first load pays the reconciliation
    mockSequencer.reset();

    const res = await GET(new Request(url));
    const report = mockSequencer.report();
    console.log(
      `contacts/full-state (repeat): ${report.statements} statements · ${report.waves} waves · ` +
        `burst ${report.maxInFlight} · status ${res.status}`,
    );
    console.log(describeWaves(report));

    expect(res.status).toBe(200);
    // The reconciliation wrote on every load before; now it is once per window,
    // so a repeat load issues the registry reads and nothing else. The three
    // registry reads are independent (one wave) and the invitation + activation
    // reads are independent (a second wave).
    expect(report.statements).toBeLessThanOrEqual(5);
    expect(report.waves).toBeLessThanOrEqual(2);
  });
});

/**
 * SECURITY — request-origin guard, client-IP trust, team credentials and the
 * remaining scope gates.
 *
 * Findings covered:
 *   - CSRF-1     state-changing GET routes must refuse cross-site requests.
 *   - RATE-2     the rate-limit key must not trust the spoofable leftmost hop.
 *   - SECRET-3   shared team credentials must come from a CSPRNG.
 *   - AUTHZ-CRM-1  contact-email management bound to a shared programme.
 *   - AUTHZ-GLOBAL-1  the global catalogs need the platform capability.
 *   - PUB-3      the public form no longer trusts a body cid for attribution.
 *   - PUB-2      the unused public-draft endpoint is removed.
 */

const fs = require("fs");
const path = require("path");

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn(async () => ({ rows: [] })) },
  initDb: jest.fn(async () => true),
}));

jest.mock("@/models/publicFormRuns", () => ({
  getDraftRunIdByPublicSlug: jest.fn(async () => ({ rows: [{ id: 5 }] })),
  getRunIdByPublicSlug: jest.fn(async () => ({ rows: [{ id: 5 }] })),
  getDraftBySubmitter: jest.fn(async () => ({ rows: [] })),
  getLatestDraftData: jest.fn(async () => ({ rows: [] })),
  updateDraftData: jest.fn(async () => ({})),
  insertDraftSubmission: jest.fn(async () => ({ rows: [{ id: 9 }] })),
}));

const ROOT = path.join(__dirname, "..", "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

const { isSameOriginRequest } = require("@/lib/requestOrigin");
const { getClientIp } = require("@/lib/rate-limit");
const {
  generateTeamUsername,
  generateTeamPassword,
  stripTeamCredentials,
} = require("@/lib/teamCredentials");
const draftModel = require("@/models/publicFormRuns");
const draftRoute = require("@/app/api/s/public-draft/route");

const reqWith = (headers) =>
  new Request("http://app.impactos.org/api/x", { headers });

describe("CSRF-1 — state-changing GET routes are same-origin only", () => {
  test("allows the application's own request", () => {
    expect(isSameOriginRequest(reqWith({ "sec-fetch-site": "same-origin" }))).toBe(true);
  });

  test("refuses a cross-site navigation (and a sibling subdomain)", () => {
    expect(isSameOriginRequest(reqWith({ "sec-fetch-site": "cross-site" }))).toBe(false);
    expect(isSameOriginRequest(reqWith({ "sec-fetch-site": "same-site" }))).toBe(false);
  });

  test("falls back to Origin then Referer when Sec-Fetch-Site is absent", () => {
    expect(
      isSameOriginRequest(reqWith({ host: "app.impactos.org", origin: "https://app.impactos.org" })),
    ).toBe(true);
    expect(
      isSameOriginRequest(reqWith({ host: "app.impactos.org", origin: "https://evil.test" })),
    ).toBe(false);
    expect(
      isSameOriginRequest(
        reqWith({ host: "app.impactos.org", referer: "https://app.impactos.org/admin" }),
      ),
    ).toBe(true);
  });

  test("allows a non-browser caller that sends no origin signal", () => {
    expect(isSameOriginRequest(reqWith({}))).toBe(true);
  });

  test("the guard is wired into every state-changing GET route", () => {
    for (const file of [
      "src/app/api/engineering/permissions/seed/route.js",
      "src/app/api/engineering/permissions/seed-access-profiles/route.js",
      "src/app/api/engineering/permissions/sync-context-grants/route.js",
      "src/app/api/engineering/permissions/context-roles/route.js",
    ]) {
      expect(read(file)).toMatch(/requireSameOrigin\(req\)/);
    }
  });
});

describe("RATE-2 — the limiting key is not the spoofable leftmost hop", () => {
  test("prefers the platform real-IP header", () => {
    expect(
      getClientIp(reqWith({ "x-real-ip": "9.9.9.9", "x-forwarded-for": "1.1.1.1" })),
    ).toBe("9.9.9.9");
  });

  test("uses the rightmost X-Forwarded-For entry, not the client's own", () => {
    expect(getClientIp(reqWith({ "x-forwarded-for": "1.1.1.1, 2.2.2.2, 3.3.3.3" }))).toBe("3.3.3.3");
  });

  test("falls back to unknown", () => {
    expect(getClientIp(reqWith({}))).toBe("unknown");
  });
});

describe("SECRET-3 — shared team credentials come from a CSPRNG", () => {
  test("a generated password is strong and free of ambiguous glyphs", () => {
    const password = generateTeamPassword();
    expect(password).toMatch(/^FST[A-HJ-NP-Z2-9]{8}$/);
    expect(password).not.toMatch(/[0O1I]/);
  });

  test("passwords never repeat across calls", () => {
    const seen = new Set(Array.from({ length: 100 }, () => generateTeamPassword()));
    expect(seen.size).toBe(100);
  });

  test("the username is derived from the name with a random suffix", () => {
    expect(generateTeamUsername("Alpha Team")).toMatch(/^alpha_team_[A-HJ-NP-Z2-9]{5}$/);
  });

  test("stripping still removes both credential fields", () => {
    expect(stripTeamCredentials({ name: "A", password: "p", team_username: "u" })).toEqual({ name: "A" });
  });

  test("both team routes generate with the helper, not Math.random", () => {
    for (const file of ["src/app/api/teams/route.js", "src/app/api/pm/teams/route.js"]) {
      const source = read(file);
      expect(source).toMatch(/generateTeamPassword\(\)/);
      expect(source).not.toMatch(/generatedPassword\s*=\s*`FST\$\{/);
    }
  });
});

describe("AUTHZ-CRM-1 — contact emails are bound to a shared programme", () => {
  test("the route consults the shared-programme predicate", () => {
    const source = read("src/app/api/contact-emails/route.js");
    expect(source).toMatch(/isContactWithinStaffedPrograms\(/);
    expect(source).toMatch(/denyIfNotAllowed/);
  });

  test("the predicate is the data-layer rule, keyed to the caller", () => {
    const source = read("src/models/authorization/scope.js");
    expect(source).toMatch(/export async function isContactWithinStaffedPrograms/);
    expect(source).toMatch(/v2_program_staff/);
  });
});

describe("AUTHZ-GLOBAL-1 — the global catalogs need a platform capability", () => {
  test("knowledge catalogue writes require the Knowledge Base capability", () => {
    const source = read("src/app/api/ventures/[id]/knowledge/route.js");
    expect(source).toMatch(/requireAuthorization\("knowledge", "create"\)/);
    expect(source).toMatch(/requireAuthorization\("knowledge", "edit"\)/);
    expect(source).toMatch(/requireAuthorization\("knowledge", "delete"\)/);
  });

  test("the coach directory requires the platform Ventures capability", () => {
    const source = read("src/app/api/ventures/[id]/coaches/route.js");
    expect(source).toMatch(/requireAuthorization\("ventures", "edit"\)/);
  });
});

describe("PUB-3 / PUB-2 — the public form surface", () => {
  test("a body cid can no longer decide attribution", () => {
    const source = read("src/app/api/respond/route.js");
    expect(source).not.toMatch(/let resolvedCid = cid/);
    expect(source).toMatch(/let resolvedCid = null/);
  });

  test("the public-draft endpoint is token-gated and never echoes the token", () => {
    const source = read("src/app/api/s/public-draft/route.js");
    expect(source).toMatch(/_draft_token/);
    expect(source).toMatch(/status: 403/);
    expect(source).toMatch(/stripToken/);
  });
});

describe("PUB-2 — the public draft is token-gated", () => {
  const post = (body) =>
    new Request("http://localhost/api/s/public-draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  const get = (query) =>
    draftRoute.GET(new Request(`http://localhost/api/s/public-draft?${query}`));

  beforeEach(() => {
    jest.clearAllMocks();
    draftModel.getDraftRunIdByPublicSlug.mockResolvedValue({ rows: [{ id: 5 }] });
    draftModel.getRunIdByPublicSlug.mockResolvedValue({ rows: [{ id: 5 }] });
    draftModel.getDraftBySubmitter.mockResolvedValue({ rows: [] });
    draftModel.getLatestDraftData.mockResolvedValue({ rows: [] });
    draftModel.insertDraftSubmission.mockResolvedValue({ rows: [{ id: 9 }] });
  });

  test("creating a draft mints a token, stores it and returns it", async () => {
    const res = await draftRoute.POST(post({ slug: "s", data: { a: 1 }, email: "x@y.test" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.action).toBe("created");
    expect(typeof body.token).toBe("string");
    expect(body.token.length).toBeGreaterThan(10);
    expect(draftModel.insertDraftSubmission.mock.calls[0][2]._draft_token).toBe(body.token);
  });

  test("an update without the right token is refused and nothing is written", async () => {
    draftModel.getDraftBySubmitter.mockResolvedValue({ rows: [{ id: 9 }] });
    draftModel.getLatestDraftData.mockResolvedValue({ rows: [{ data: { _draft_token: "REAL" } }] });

    expect((await draftRoute.POST(post({ slug: "s", data: { a: 2 }, email: "x@y.test" }))).status).toBe(403);
    expect((await draftRoute.POST(post({ slug: "s", data: { a: 2 }, email: "x@y.test", token: "WRONG" }))).status).toBe(403);
    expect(draftModel.updateDraftData).not.toHaveBeenCalled();
  });

  test("the right token updates and carries the token forward", async () => {
    draftModel.getDraftBySubmitter.mockResolvedValue({ rows: [{ id: 9 }] });
    draftModel.getLatestDraftData.mockResolvedValue({ rows: [{ data: { _draft_token: "REAL" } }] });

    const res = await draftRoute.POST(post({ slug: "s", data: { a: 2 }, email: "x@y.test", token: "REAL" }));
    expect(res.status).toBe(200);
    expect(draftModel.updateDraftData.mock.calls[0][0]).toEqual({ a: 2, _draft_token: "REAL" });
  });

  test("reading without the token is refused", async () => {
    draftModel.getLatestDraftData.mockResolvedValue({ rows: [{ data: { a: 1, _draft_token: "REAL" } }] });

    expect((await get("slug=s&email=x@y.test")).status).toBe(403);
    expect((await get("slug=s&email=x@y.test&token=WRONG")).status).toBe(403);
  });

  test("the right token returns the answers without the token", async () => {
    draftModel.getLatestDraftData.mockResolvedValue({ rows: [{ data: { a: 1, _draft_token: "REAL" } }] });

    const res = await get("slug=s&email=x@y.test&token=REAL");
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.draft).toEqual({ a: 1 });
  });
});

describe("i18n — the new error key exists in both locales", () => {
  test.each(["en", "fr"])("errors.crossSiteRequestBlocked in %s", (locale) => {
    const messages = JSON.parse(read(`src/locales/${locale}/errors.json`));
    expect(typeof messages.errors.crossSiteRequestBlocked).toBe("string");
    expect(messages.errors.crossSiteRequestBlocked.length).toBeGreaterThan(0);
  });
});

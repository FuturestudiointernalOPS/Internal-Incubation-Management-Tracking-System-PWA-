/**
 * PHASE 3 — sécurité des surfaces publiques et d'authentification (code seul).
 *
 * Verrouille trois correctifs de la famille « actions sans décision / fuite
 * d'information » :
 *
 *   1. AUTH-ENUM-SESSIONLOGIN-1 — la route sœur `auth/session-login` paie le
 *      coût bcrypt sur le chemin « compte inconnu », comme `auth/login`, et
 *      répond le MÊME message générique dans les deux cas. Un appelant ne peut
 *      plus déduire l'existence d'un compte par le temps de réponse.
 *   2. PROTECT-DRAFT-1 — la CRÉATION d'un brouillon public est limitée par IP
 *      (la mise à jour, qui exige déjà le jeton, ne l'est pas : un autosave
 *      légitime n'est pas bridé).
 *   3. PROTECT-RESPOND-1 — la soumission publique de campagne est limitée par IP.
 *
 * Ces surfaces sont publiques par conception : elles ne peuvent pas porter de
 * décision de permission. Le refus par défaut visé ici est une limitation de
 * débit, pas un contrôle d'identité.
 */

jest.mock("@/lib/db", () => ({
  __esModule: true,
  initDb: jest.fn(async () => {}),
  default: { execute: jest.fn(async () => ({ rows: [] })) },
}));

jest.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: jest.fn(() => null),
  getClientIp: jest.fn(() => "203.0.113.9"),
}));

jest.mock("@/lib/loginAudit", () => ({ auditLoginAttempt: jest.fn(async () => {}) }));

// ---------------------------------------------------------------------------
// 1. auth/session-login — anti-énumération
// ---------------------------------------------------------------------------

jest.mock("@/server/auth/session", () => ({
  createSession: jest.fn(async () => ({ token: "tok-sl", maxAge: 86400 })),
}));
jest.mock("@/server/auth/cookies", () => ({
  setSessionCookieOnResponse: jest.fn((response) => response),
}));
jest.mock("@/server/auth/password", () => ({
  verifyPassword: jest.fn(async () => false),
  verifyPasswordOrUpgradeLegacy: jest.fn(async () => false),
}));
jest.mock("@/models/authFlows/passwordReset", () => ({
  updateContactPasswordHashByCid: jest.fn(async () => {}),
}));
jest.mock("@/models/platform/roles", () => ({
  resolveEffectiveRole: jest.fn(() => "staff"),
  resolveLanding: jest.fn(() => "/"),
  landingNeedsRelationships: jest.fn(() => false),
}));
jest.mock("@/services/authorization/membership", () => ({
  getEffectiveGroupsForUser: jest.fn(async () => []),
}));
jest.mock("@/models/authorization/profileAssignmentsStore", () => ({
  listActiveProfileKeys: jest.fn(async () => ({ rows: [] })),
}));
jest.mock("@/models/contacts/programMembership", () => ({
  getVentureMembershipsForContact: jest.fn(async () => ({ rows: [] })),
}));
jest.mock("@/models/investor", () => ({
  getApprovedInvestorProfileIdByUserId: jest.fn(async () => ({ rows: [] })),
}));
jest.mock("@/models/authFlows", () => ({
  getContactByEmailOrCid: jest.fn(async () => ({ rows: [] })),
  getTeamByUsernameForSessionLogin: jest.fn(async () => ({ rows: [] })),
  getFamilyBySharedEmailForSessionLogin: jest.fn(async () => ({ rows: [] })),
  getParticipantProgramRecordForSessionLogin: jest.fn(async () => ({ rows: [] })),
  getLmsEnrollmentRecordForSessionLogin: jest.fn(async () => ({ rows: [] })),
  ensureContactsLastLoginColumn: jest.fn(async () => {}),
  ensureContactsLoginCountColumn: jest.fn(async () => {}),
  recordContactLoginActivity: jest.fn(async () => {}),
}));

// ---------------------------------------------------------------------------
// 2. /api/s/public-draft et 3. /api/respond
// ---------------------------------------------------------------------------

jest.mock("@/models/publicFormRuns", () => ({
  getDraftRunIdByPublicSlug: jest.fn(async () => ({ rows: [{ id: 7 }] })),
  getRunIdByPublicSlug: jest.fn(async () => ({ rows: [{ id: 7 }] })),
  getDraftBySubmitter: jest.fn(async () => ({ rows: [] })),
  getLatestDraftData: jest.fn(async () => ({ rows: [] })),
  updateDraftData: jest.fn(async () => {}),
  insertDraftSubmission: jest.fn(async () => ({ rows: [{ id: 42 }] })),
}));

jest.mock("@/services/platformRespond", () => ({
  recordPublicCampaignResponse: jest.fn(async () => ({
    ok: true,
    confidence_score: 100,
    match_status: "auto",
  })),
}));

const { NextResponse } = require("next/server");
const { enforceRateLimit } = require("@/lib/rate-limit");
const { verifyPassword } = require("@/server/auth/password");
const authFlows = require("@/models/authFlows");

const sessionLogin = require("@/app/api/auth/session-login/route");
const publicDraft = require("@/app/api/s/public-draft/route");
const respond = require("@/app/api/respond/route");
const publicFormRuns = require("@/models/publicFormRuns");
const platformRespond = require("@/services/platformRespond");

const post = (url, body) =>
  new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", host: "localhost" },
    body: JSON.stringify(body),
  });

const limited = () =>
  NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });

beforeEach(() => {
  jest.clearAllMocks();
  enforceRateLimit.mockReturnValue(null);
  verifyPassword.mockResolvedValue(false);
  authFlows.getContactByEmailOrCid.mockResolvedValue({ rows: [] });
  authFlows.getTeamByUsernameForSessionLogin.mockResolvedValue({ rows: [] });
  authFlows.getFamilyBySharedEmailForSessionLogin.mockResolvedValue({ rows: [] });
  publicFormRuns.getDraftRunIdByPublicSlug.mockResolvedValue({ rows: [{ id: 7 }] });
  publicFormRuns.getDraftBySubmitter.mockResolvedValue({ rows: [] });
  publicFormRuns.insertDraftSubmission.mockResolvedValue({ rows: [{ id: 42 }] });
  platformRespond.recordPublicCampaignResponse.mockResolvedValue({
    ok: true,
    confidence_score: 100,
    match_status: "auto",
  });
});

describe("AUTH-ENUM-SESSIONLOGIN-1 — session-login cache l'existence du compte", () => {
  const login = (body) =>
    post("http://localhost/api/auth/session-login", body);

  test("un compte inconnu paie le coût bcrypt et répond le 401 générique", async () => {
    const res = await sessionLogin.POST(
      login({ email: "nobody@example.com", password: "whatever" }),
    );
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toMatch(/Invalid credentials/);
    expect(body.error).not.toMatch(/no such|unknown|not found/i);
    // Le chemin « compte inconnu » paie le même coût que « mot de passe faux ».
    expect(verifyPassword).toHaveBeenCalledWith(
      "whatever",
      expect.stringMatching(/^\$2[aby]\$/),
    );
  });

  test("le message est identique que le compte existe ou non", async () => {
    // Compte existant mais mauvais mot de passe.
    authFlows.getContactByEmailOrCid.mockResolvedValue({
      rows: [{ cid: "U-1", id: "U-1", role: "staff", status: "active", password: "$2b$10$x" }],
    });
    const { verifyPasswordOrUpgradeLegacy } = require("@/server/auth/password");
    verifyPasswordOrUpgradeLegacy.mockResolvedValue(false);

    const known = await sessionLogin.POST(
      login({ email: "user@example.com", password: "nope" }),
    );
    const knownBody = await known.json();

    authFlows.getContactByEmailOrCid.mockResolvedValue({ rows: [] });
    const unknown = await sessionLogin.POST(
      login({ email: "user@example.com", password: "nope" }),
    );
    const unknownBody = await unknown.json();

    expect(known.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(knownBody.error).toBe(unknownBody.error);
  });

  test("une requête limitée en débit reçoit 429 sans lecture de compte", async () => {
    enforceRateLimit.mockReturnValueOnce(limited());

    const res = await sessionLogin.POST(
      login({ email: "user@example.com", password: "x" }),
    );

    expect(res.status).toBe(429);
    expect(authFlows.getContactByEmailOrCid).not.toHaveBeenCalled();
  });
});

describe("PROTECT-DRAFT-1 — la création de brouillon public est bornée", () => {
  test("un créateur au-delà du quota reçoit 429 et aucune écriture n'a lieu", async () => {
    enforceRateLimit.mockReturnValueOnce(limited());

    const res = await publicDraft.POST(
      post("http://localhost/api/s/public-draft", {
        slug: "enquete",
        data: { q1: "a" },
        email: "respondent@example.com",
      }),
    );

    expect(res.status).toBe(429);
    expect(publicFormRuns.insertDraftSubmission).not.toHaveBeenCalled();
  });

  test("une création normale est limitée (clé par IP) et aboutit", async () => {
    const res = await publicDraft.POST(
      post("http://localhost/api/s/public-draft", {
        slug: "enquete",
        data: { q1: "a" },
        email: "respondent@example.com",
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.action).toBe("created");
    expect(body.token).toBeTruthy();
    expect(enforceRateLimit).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining("public-draft:create:"),
      expect.objectContaining({ limit: expect.any(Number), windowMs: expect.any(Number) }),
    );
  });

  test("une mise à jour (jeton exigé) n'est pas bridée par la limite de création", async () => {
    publicFormRuns.getDraftBySubmitter.mockResolvedValue({ rows: [{ id: 5 }] });
    publicFormRuns.getLatestDraftData.mockResolvedValue({
      rows: [{ data: { _draft_token: "tok-abc" } }],
    });

    const res = await publicDraft.POST(
      post("http://localhost/api/s/public-draft", {
        slug: "enquete",
        data: { q1: "b" },
        email: "respondent@example.com",
        token: "tok-abc",
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.action).toBe("updated");
    // La limitation n'est évaluée que sur le chemin de CRÉATION.
    expect(enforceRateLimit).not.toHaveBeenCalled();
  });
});

describe("PROTECT-RESPOND-1 — la soumission publique de campagne est bornée", () => {
  test("au-delà du quota, la route répond 429 sans enregistrer la réponse", async () => {
    enforceRateLimit.mockReturnValueOnce(limited());

    const res = await respond.POST(
      post("http://localhost/api/respond", {
        form_id: "f1",
        answers: { q1: "Yes" },
        publicData: { email: "a@b.com" },
      }),
    );

    expect(res.status).toBe(429);
    expect(platformRespond.recordPublicCampaignResponse).not.toHaveBeenCalled();
  });

  test("sous le quota, la réponse est enregistrée normalement", async () => {
    const res = await respond.POST(
      post("http://localhost/api/respond", {
        form_id: "f1",
        answers: { q1: "Yes" },
        publicData: { email: "a@b.com" },
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(enforceRateLimit).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining("public-respond:ip:"),
      expect.objectContaining({ limit: expect.any(Number), windowMs: expect.any(Number) }),
    );
  });
});

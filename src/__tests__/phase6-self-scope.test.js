/**
 * PHASE 6 — couverture des actions : portée « soi-même » (spec §13).
 *
 * Les routes « personnelles légitimes » sont ouvertes à tout utilisateur
 * connecté, mais leur portée est l'appelant LUI-MÊME. Ces tests prouvent, pour
 * la première tranche, que la cible vient de `session.cid` et JAMAIS d'un
 * identifiant fourni par le client — c'est la vérification demandée par la tâche
 * « une déclaration explicite + un test qui vérifie que la portée soi-même est
 * réellement appliquée ».
 *
 * Un ratchet verrouille ensuite que TOUTE route sous `me/` et `profile/` est
 * déclarée (aucune route self-service non déclarée ne peut apparaître).
 */

const fs = require("node:fs");
const path = require("node:path");

jest.mock("@/lib/db", () => ({
  __esModule: true,
  initDb: jest.fn(async () => {}),
  default: { execute: jest.fn(async () => ({ rows: [] })) },
}));
jest.mock("@/server/auth/password", () => ({ hashPassword: jest.fn(async () => "$2b$hash") }));
jest.mock("@/lib/token-hashing", () => ({ hashToken: jest.fn(() => "hash") }));
jest.mock("@/server/auth/session", () => ({ getSession: jest.fn() }));
jest.mock("@/models/workspace", () => ({
  getContactProfileFields: jest.fn(async () => ({ rows: [] })),
  getContactSecondaryFields: jest.fn(async () => ({ rows: [] })),
  getContactLoginActivity: jest.fn(async () => ({ rows: [] })),
  updateContactCoreFields: jest.fn(async () => ({})),
  updateContactSecondaryFields: jest.fn(async () => ({})),
}));
jest.mock("@/models/authFlows", () => ({ deleteUserSessionsExcept: jest.fn(async () => ({})) }));

const mockCreateClient = jest.fn();
jest.mock("@supabase/supabase-js", () => ({ createClient: (...args) => mockCreateClient(...args) }));

jest.mock("@/models/authorization/index", () => ({
  getAuthorizationContext: jest.fn(async () => ({ isSuperAdmin: false, effective: { crm: { view: 1 } } })),
  effectivePermissionsFromContext: jest.fn((ctx) => ctx?.effective || {}),
}));
jest.mock("@/services/authorization/contextGrants", () => ({
  syncContextGrantsOnConnect: jest.fn(async () => ({})),
}));

const { getSession } = require("@/server/auth/session");
const workspace = require("@/models/workspace");
const { getAuthorizationContext } = require("@/models/authorization/index");

const profileRoute = require("@/app/api/profile/route");
const photoRoute = require("@/app/api/profile/photo/route");
const mePermissionsRoute = require("@/app/api/me/permissions/route");
const {
  SELF_SCOPED_ROUTES,
  SELF_SCOPED_PREFIXES,
} = require("./helpers/selfScopedDeclaration");

const ROOT = path.resolve(__dirname, "..", "..");
const SESSION = { cid: "SELF-CID", token: "tok", role: "member", email: "me@x.test" };

const jsonReq = (body) => ({ json: async () => body });

beforeEach(() => {
  jest.clearAllMocks();
  getSession.mockResolvedValue(SESSION);
});

describe("profile — la cible est session.cid, jamais un cid du corps", () => {
  test("PUT écrit sur session.cid même si le corps nomme un autre cid", async () => {
    const res = await profileRoute.PUT(jsonReq({ name: "New Name", cid: "OTHER-CID" }));

    expect(res.status).toBe(200);
    expect(workspace.updateContactCoreFields).toHaveBeenCalledWith(
      "SELF-CID",
      expect.any(Array),
      expect.any(Array),
    );
    expect(workspace.updateContactCoreFields).not.toHaveBeenCalledWith(
      "OTHER-CID",
      expect.anything(),
      expect.anything(),
    );
  });

  test("PUT refuse un utilisateur non authentifié (401)", async () => {
    getSession.mockResolvedValueOnce(null);
    const res = await profileRoute.PUT(jsonReq({ name: "X" }));
    expect(res.status).toBe(401);
    expect(workspace.updateContactCoreFields).not.toHaveBeenCalled();
  });
});

describe("profile/photo — l'objet stocké est nommé depuis session.cid", () => {
  test("le nom de l'objet commence par session.cid", async () => {
    const upload = jest.fn(async () => ({ error: null }));
    const from = jest.fn(() => ({
      upload,
      getPublicUrl: () => ({ data: { publicUrl: "https://cdn/x.png" } }),
    }));
    mockCreateClient.mockReturnValue({
      storage: { from, createBucket: jest.fn(async () => ({})) },
    });

    const formData = new FormData();
    formData.append("file", new File([Buffer.from("x")], "avatar.png", { type: "image/png" }));

    const res = await photoRoute.POST({ formData: async () => formData });

    expect(res.status).toBe(200);
    expect(upload).toHaveBeenCalledTimes(1);
    const objectName = String(upload.mock.calls[0][0]);
    expect(objectName).toMatch(/^profile-photos\/SELF-CID-/);
  });
});

describe("me/permissions — la matrice est celle de l'appelant", () => {
  test("le contexte résolu est celui de la session", async () => {
    const res = await mePermissionsRoute.GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(getAuthorizationContext).toHaveBeenCalledWith(SESSION);
    expect(body.effective).toEqual({ crm: { view: 1 } });
  });
});

describe("déclaration — lock de forme et ratchet", () => {
  const walkRoutes = (dir) => {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...walkRoutes(full));
      else if (entry.name === "route.js") {
        out.push(path.relative(ROOT, full).split(path.sep).join("/"));
      }
    }
    return out;
  };

  test("chaque route déclarée résout sa cible depuis session.cid", () => {
    for (const entry of SELF_SCOPED_ROUTES) {
      const src = fs.readFileSync(path.join(ROOT, entry.file), "utf8");
      expect(src).toMatch(/session\??\.cid/);
    }
  });

  test("aucune route des préfixes surveillés n'est non déclarée", () => {
    const declared = new Set(SELF_SCOPED_ROUTES.map((entry) => entry.file));
    const inScope = [];
    for (const prefix of SELF_SCOPED_PREFIXES) {
      const abs = path.join(ROOT, prefix);
      if (fs.existsSync(abs)) inScope.push(...walkRoutes(abs));
    }
    const undeclared = inScope.filter((rel) => !declared.has(rel)).sort();
    expect(undeclared).toEqual([]);
  });

  test("aucune entrée de déclaration périmée (fichier absent)", () => {
    const stale = SELF_SCOPED_ROUTES.map((entry) => entry.file)
      .filter((rel) => !fs.existsSync(path.join(ROOT, rel)))
      .sort();
    expect(stale).toEqual([]);
  });
});

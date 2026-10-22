/**
 * SPÉCIFICATION DES PERMISSIONS — §15, les 13 scénarios de validation.
 *
 * Ce fichier encode, en tests nommés, le RÉSULTAT ATTENDU par la spec §15
 * (docs/permissions/inventaire-00-cartographie.md : « 13 scénarios de validation »).
 * Chaque scénario est un `test("…")` dont le nom porte le libellé de la spec.
 *
 * Tableau de correspondance scénario → niveau → état → phase correctrice
 * ────────────────────────────────────────────────────────────────────────
 *  1  Création d'un membre (MEMBRE + profils par défaut)   modèle (seeds)          conforme   —
 *  2  Acceptation à un programme (PARTICIPANT auto)        service (justification) conforme   —
 *  3  Affectation d'un Program Manager (profil cohérent)   service (justification) conforme   —
 *  4  Profil incompatible avec le rôle → refus             pur (evaluateProfileRoleFit) conforme —
 *  5  Éligible mais sans permission → refus                pur (authorize)         conforme   —
 *  6  Permission sur feature non éligible → refus          pur (authorize)         conforme   —
 *  7  Manager du programme A modifie B → refus             service (isWithinScope) conforme   —
 *  8  Expiration d'un profil de gestion → retrait          pur (planContextGrantChanges) conforme —
 *  9  Ancien PM consulte son ancien programme → lecture    service/pur (histoire)  conforme   —
 * 10  Ancien PM modifie son ancien programme → refus       pur (authorize)         conforme   —
 * 11  Attribution répétée d'un profil (pas de doublon)     pur (planAssignmentCardChanges) conforme —
 * 12  Révocation d'une permission individuelle             pur (merge + authorize) conforme   —
 * 13  Désactivation d'un profil → historique conservé      pur/service (catalogue) conforme   —
 *
 * Un scénario dont le code actuel divergerait de la spec serait marqué
 * `test.failing("…")` (Jest 30 : le test PASSE si son corps échoue) avec un
 * commentaire `// ÉCHEC ATTENDU — corrigé en Phase X`. Aucune divergence n'a été
 * observée à l'exécution.
 *
 * Niveaux les plus bas vérifiables : les décisions pures (context, merge,
 * planificateurs, fit profil/rôle) sont testées sans base ; les scénarios qui
 * exigent une lecture (justification d'attribution, résolution de profil,
 * périmètre) font tourner les VRAIS services sur une base simulée, comme
 * `profile-role-rule-phase-b.test.js`. Aucun fichier applicatif n'est modifié.
 */

// ── Base simulée (un seul montage, réutilisé par les services réels) ──────────
const mockState = {
  profiles: [], // lignes de la table `profiles`
  contactRole: "member",
  contactProfileKey: null,
  registry: null, // ligne de `context_role_profiles`
  profileCaps: [], // lignes de `profile_capabilities`
  participantPrograms: [], // `participant_programs`
  staffAssignments: [], // `v2_program_staff`
  managedPrograms: [], // `v2_programs.assigned_pm_id = ?`
  roleDefaults: [], // `role_profile_defaults`
};

async function mockExecute(query) {
  const sqlText = typeof query === "string" ? query : query?.sql || "";
  const args = typeof query === "string" ? [] : query?.args || [];

  if (/^\s*(CREATE TABLE|CREATE INDEX|ALTER TABLE)/i.test(sqlText)) return { rows: [] };

  if (sqlText.includes("FROM profile_capabilities")) return { rows: mockState.profileCaps };

  if (sqlText.includes("FROM context_role_profiles")) {
    return { rows: mockState.registry ? [mockState.registry] : [] };
  }

  if (sqlText.includes("FROM profiles")) {
    const key = String(args[0]);
    return { rows: mockState.profiles.filter((row) => String(row.key) === key) };
  }

  if (sqlText.includes("profile_key FROM contacts")) {
    return {
      rows: [{ role: mockState.contactRole, profile_key: mockState.contactProfileKey }],
    };
  }

  if (sqlText.includes("FROM participant_programs")) {
    return { rows: mockState.participantPrograms };
  }

  if (sqlText.includes("assigned_pm_id AS TEXT) = ?")) {
    return { rows: mockState.managedPrograms };
  }

  if (sqlText.includes("FROM v2_program_staff")) return { rows: mockState.staffAssignments };

  if (sqlText.includes("facilitator_default_permissions AS def")) {
    return { rows: args.map((id) => ({ id, def: null })) };
  }

  if (sqlText.includes("FROM role_profile_defaults")) return { rows: mockState.roleDefaults };

  return { rows: [] };
}

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: (...args) => mockExecute(...args) },
  initDb: jest.fn(async () => true),
}));

jest.mock("@/models/authorization/constants/feature-module-capability", () => ({
  ...jest.requireActual("@/models/authorization/constants/feature-module-capability"),
  PERMISSION_MODULES: require("./helpers/authorizationMocks").auth.PERMISSION_MODULES,
}));
jest.mock("@/server/auth/session", () => ({ getSession: jest.fn(async () => null) }));
jest.mock("@/models/authorization/bootstrap", () => ({
  ensurePermissionsSchema: jest.fn(async () => {}),
}));

// Le moteur de périmètre lit ses identifiants par ce module : on le stubbe pour
// piloter directement « B est-il dans le périmètre ? ».
jest.mock("@/models/authorization/scopeReads", () => ({
  getVentureOwnScopeIds: jest.fn(async () => []),
  getProgramAssignedScopeIds: jest.fn(async () => []),
  getProgramStaffedScopeIds: jest.fn(async () => []),
  getLearningOwnScopeIds: jest.fn(async () => []),
  getVentureManagedHistoryScopeIds: jest.fn(async () => []),
  getProgramManagedHistoryScopeIds: jest.fn(async () => []),
  getVentureIdByUuid: jest.fn(async () => null),
  contactSharesStaffedProgram: jest.fn(async () => false),
}));

// ── Modules réels testés ─────────────────────────────────────────────────────
const { authorize, mergeEffectiveCapabilities } = require("@/services/authorization/context");
const {
  PROFILE_ROLE_ENFORCEMENT,
  evaluateProfileRoleFit,
  profileRoleGateDecision,
  profileKeyForContextRole,
} = require("@/services/authorization/profileCatalog");
const {
  resolveContextJustification,
} = require("@/services/authorization/contextGrantJustification");
const {
  readingCapabilitiesForContext,
} = require("@/services/authorization/contextGrantHistory");
const {
  planAssignmentCardChanges,
} = require("@/services/authorization/contextGrantAssignments");
const {
  planContextGrantChanges,
  contextGrantSentinel,
} = require("@/services/authorization/contextGrantPlan");
const { isWithinScope } = require("@/services/authorization/scope");
const {
  PROFILE_CATALOGUE_SEED,
  ROLE_PROFILE_DEFAULTS_SEED,
} = require("@/models/authorization/profileCatalogueSeed");
const { PROFILE_BASELINE_ROLES } = require("@/models/authorization/profile-catalog");
const { staffCtx } = require("./helpers/authorizationMocks");
const scopeReads = require("@/models/authorization/scopeReads");

const CID = "C-SPEC";

beforeEach(() => {
  jest.clearAllMocks();
  mockState.profiles = [];
  mockState.contactRole = "member";
  mockState.contactProfileKey = null;
  mockState.registry = null;
  mockState.profileCaps = [];
  mockState.participantPrograms = [];
  mockState.staffAssignments = [];
  mockState.managedPrograms = [];
  mockState.roleDefaults = [];
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("Spec §15 — 13 scénarios de validation", () => {
  test("Scénario 1 — Création d'un membre : rôle MEMBER et profils par défaut configurés", () => {
    // Le rôle de base d'un nouveau membre est « member »…
    expect(PROFILE_BASELINE_ROLES).toContain("member");
    // … et le catalogue lui attribue un profil par défaut (profil configuré).
    expect(ROLE_PROFILE_DEFAULTS_SEED.member).toBe("venture_member");
    const defaultProfile = PROFILE_CATALOGUE_SEED.find(
      (profile) => profile.key === ROLE_PROFILE_DEFAULTS_SEED.member,
    );
    expect(defaultProfile).toBeDefined();
    expect(defaultProfile.allowedRoles).toContain("member");
    expect(defaultProfile.context).toBe("venture");
  });

  test("Scénario 2 — Acceptation à un programme : attribution automatique de PARTICIPANT dans le contexte du programme", async () => {
    mockState.participantPrograms = [{ program_id: "P-1" }, { program_id: "P-2" }];
    mockState.registry = {
      id: 1,
      context: "program",
      role_key: "participant",
      profile_key: "participant",
      is_active: 1,
      profile_name: "Participant Default",
    };
    mockState.profileCaps = [{ module: "projects", capability: "view", access_level: 1 }];

    const result = await resolveContextJustification(CID, {
      context: "program",
      roleKey: "participant",
    });

    // Chaque inscription (`participant_programs`) est une source ; le registre
    // des rôles contextuels mappe le couple au profil Participant.
    expect(result.sourceIds).toEqual(["P-1", "P-2"]);
    expect(result.profile).toBe("Participant Default");
    expect(result.desired["projects.view"]).toEqual({
      module: "projects",
      capability: "view",
      level: 1,
    });
    expect(result.reason).toBe("mapped");
  });

  test("Scénario 3 — Affectation d'un Program Manager : affectation métier et profil cohérents", async () => {
    mockState.managedPrograms = [
      {
        program_id: "P-9",
        role_key: "program_manager",
        permissions: null,
        profile_key: null,
        end_date: null,
        status: "Active",
        is_archived: 0,
      },
    ];
    mockState.registry = {
      id: 2,
      context: "program",
      role_key: "program_manager",
      profile_key: "program_manager",
      is_active: 1,
      profile_name: "Assigned Program Manager",
    };
    mockState.profileCaps = [
      { module: "programs", capability: "view", access_level: 1 },
      { module: "programs", capability: "edit", access_level: 3 },
    ];

    const result = await resolveContextJustification(CID, {
      context: "program",
      roleKey: "program_manager",
    });

    expect(result.sourceIds).toEqual(["P-9"]);
    expect(result.profile).toBe("Assigned Program Manager");
    expect(result.desired["programs.view"].level).toBe(1);
    expect(result.desired["programs.edit"].level).toBe(3);
    expect(result.managesExpiry).toBe(true);
  });

  test("Scénario 4 — Profil incompatible avec le rôle : attribution refusée", () => {
    const fit = evaluateProfileRoleFit({ allowedRoles: ["staff"] }, "member");
    expect(fit).toEqual({ allowed: false, reason: "role-not-allowed" });

    const gate = profileRoleGateDecision({
      profile: "program_manager",
      role: "member",
      reason: "role-not-allowed",
    });
    expect(PROFILE_ROLE_ENFORCEMENT).toBe("block");
    expect(gate.blocked).toBe(true);
  });

  test("Scénario 5 — Éligible mais sans permission : action refusée", () => {
    const user = staffCtx({
      eligibility: { finance: true },
      effective: {},
      grants: {},
      restrictions: {},
    });
    expect(authorize(user, "finance", "view")).toBe(false);
  });

  test("Scénario 6 — Permission sur une feature non éligible : accès refusé", () => {
    const user = staffCtx({
      eligibility: { finance: false },
      effective: { finance: { view: 5 } },
      grants: { finance: { view: 5 } },
    });
    expect(authorize(user, "finance", "view")).toBe(false);
  });

  test("Scénario 7 — Manager du programme A qui modifie B : accès refusé sauf autre droit applicable", async () => {
    scopeReads.getProgramStaffedScopeIds.mockResolvedValue(["P-A"]);

    // B est hors du périmètre du manager → l'écriture est refusée.
    await expect(isWithinScope("program_staffed", "U-PM", "P-B")).resolves.toBe(false);
    // A est dans le périmètre → autorisé.
    await expect(isWithinScope("program_staffed", "U-PM", "P-A")).resolves.toBe(true);

    // « sauf autre droit applicable » : si une autre affectation donne B, B redevient accessible.
    scopeReads.getProgramStaffedScopeIds.mockResolvedValue(["P-A", "P-B"]);
    await expect(isWithinScope("program_staffed", "U-PM", "P-B")).resolves.toBe(true);
  });

  test("Scénario 8 — Expiration d'un profil de gestion : retrait des permissions opérationnelles liées", () => {
    const sentinel = contextGrantSentinel("program", "program_manager");
    const plan = planContextGrantChanges({
      // Relation/profil expiré → plus aucune capacité opérationnelle n'est désirée.
      desired: {},
      existing: [
        { module: "programs", capability: "edit", access_level: 3, granted_by: sentinel },
      ],
      provenance: [
        { module: "programs", capability: "view" },
        { module: "programs", capability: "edit" },
      ],
      sentinel,
      expiresAt: "2020-01-01",
    });

    expect(plan.toApply).toEqual([]);
    expect(plan.toRevoke).toEqual([
      { module: "programs", capability: "view" },
      { module: "programs", capability: "edit" },
    ]);
  });

  test("Scénario 9 — Ancien Program Manager consulte son ancien programme : lecture autorisée si conditions historiques", async () => {
    // La lecture résiduelle ne porte que les `view` du contexte « programme ».
    const reads = readingCapabilitiesForContext("program");
    expect(reads["programs.view"]).toEqual({
      module: "programs",
      capability: "view",
      level: 1,
    });

    // Si les conditions historiques sont remplies (cartes terminées), l'ancien
    // programme est dans le périmètre de LECTURE.
    scopeReads.getProgramManagedHistoryScopeIds.mockResolvedValue(["P-OLD"]);
    await expect(isWithinScope("program_managed_history", "U-EX-PM", "P-OLD")).resolves.toBe(true);
    await expect(isWithinScope("program_managed_history", "U-EX-PM", "P-OTHER")).resolves.toBe(false);
  });

  test("Scénario 10 — Ancien Program Manager modifie son ancien programme : refusé sans autre droit valide", () => {
    // La lecture résiduelle est portée sous la forme matricielle du résolveur
    // ({ module: { capability: level } }), comme `ctx.effective`.
    const residual = readingCapabilitiesForContext("program");
    const effective = Object.values(residual).reduce((matrix, item) => {
      matrix[item.module] ??= {};
      matrix[item.module][item.capability] = item.level;
      return matrix;
    }, {});

    const historyCtx = {
      cid: "U-EX-PM",
      role: "staff",
      isSuperAdmin: false,
      eligibility: { programs: true },
      effective,
      grants: {},
      restrictions: {},
    };

    // La consultation passe…
    expect(authorize(historyCtx, "programs", "view")).toBe(true);
    // … l'écriture ne passe pas : l'historique ne porte aucun droit opérationnel.
    expect(authorize(historyCtx, "programs", "edit")).toBe(false);
    expect(authorize(historyCtx, "programs", "publish")).toBe(false);
  });

  test("Scénario 11 — Attribution répétée d'un profil : pas de doublon accidentel ; nouvelle affectation distincte si légitime", () => {
    // La même relation rejouée ne crée aucune carte en plus : la carte existante
    // est seulement re-datée.
    const replay = planAssignmentCardChanges({
      sourceIds: ["P-A"],
      activeCards: [{ id: 1, context_id: "P-A" }],
    });
    expect(replay.toOpen).toEqual([]);
    expect(replay.toClose).toEqual([]);
    expect(replay.toRefresh).toEqual([{ id: 1, contextId: "P-A" }]);

    // Une relation légitime NOUVELLE (P-B) ouvre une affectation distincte.
    const distinct = planAssignmentCardChanges({
      sourceIds: ["P-A", "P-B"],
      activeCards: [{ id: 1, context_id: "P-A" }],
    });
    expect(distinct.toOpen).toEqual(["P-B"]);
    expect(distinct.toRefresh).toEqual([{ id: 1, contextId: "P-A" }]);
  });

  test("Scénario 12 — Révocation d'une permission individuelle : droit révoqué non applicable", () => {
    const baseProfileCaps = { finance: { view: 1 } };

    // Avant révocation : la permission individuelle s'applique.
    const withGrant = mergeEffectiveCapabilities(
      baseProfileCaps,
      {},
      { finance: { edit: 3 } },
      {},
    );
    expect(
      authorize(
        staffCtx({ eligibility: { finance: true }, effective: withGrant, grants: { finance: { edit: 3 } } }),
        "finance",
        "edit",
      ),
    ).toBe(true);

    // Après révocation (octroi individuel supprimé) : le droit n'est plus applicable.
    const revoked = mergeEffectiveCapabilities(baseProfileCaps, {}, {}, {});
    expect(
      authorize(
        staffCtx({ eligibility: { finance: true }, effective: revoked, grants: {} }),
        "finance",
        "edit",
      ),
    ).toBe(false);
  });

  test("Scénario 13 — Désactivation d'un profil du catalogue : historique requis conservé", async () => {
    // Un profil désactivé ne s'attribue plus (nouvelle attribution refusée)…
    expect(evaluateProfileRoleFit({ allowedRoles: ["staff"], is_active: 0 }, "staff")).toEqual({
      allowed: false,
      reason: "profile-inactive",
    });

    // … mais sa ligne de catalogue n'est pas supprimée : la clé se résout encore,
    // donc l'historique (cartes terminées, lecture résiduelle) reste bornable.
    mockState.profiles = [
      { key: "program_manager", context: "program", allowed_roles: '["staff"]', is_active: 0 },
    ];
    await expect(profileKeyForContextRole("program", "program_manager")).resolves.toBe(
      "program_manager",
    );
  });
});

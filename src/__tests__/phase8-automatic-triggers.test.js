/**
 * PHASE 8 (tâche 2) — déclencheurs automatiques INLINE (spec §8.2).
 *
 * L'acceptation d'un participant à un programme et l'inscription LMS d'un
 * apprenant étaient les DEUX seuls déclencheurs sans appel inline : la carte de
 * profil (`participant` / `learner`) n'apparaissait qu'au prochain reconcile de
 * la personne (connexion, TTL 5 min) ou au balayage planifié.
 *
 * Ces tests prouvent que la relation métier déclenche désormais le reconcile du
 * BON couple (contexte + clé de rôle), sans que l'appel puisse faire échouer
 * l'écriture métier (best-effort).
 */

jest.mock("@/services/authorization/contextGrants", () => ({
  syncContextGrantsForUser: jest.fn(async () => ({ success: true })),
}));

// --- auth / guards (le service accepte puis écrit) ---------------------------
jest.mock("@/server/auth/guards", () => ({ requireAuth: jest.fn(async () => null) }));
jest.mock("@/server/auth/session", () => ({
  getSession: jest.fn(async () => ({ cid: "ADMIN-1", role: "staff" })),
}));
jest.mock("@/server/authz/capabilities", () => ({
  hasProgramManagementAccess: jest.fn(() => true),
}));
jest.mock("@/server/authz/guards", () => ({
  requireAssignmentAccess: jest.fn(async () => null),
}));
jest.mock("@/models/authorization/index", () => ({
  requireAuthorization: jest.fn(async () => null),
}));
jest.mock("@/lib/programScopedAccess", () => ({
  requireProgramScope: jest.fn(async () => null),
  requireProgramScopeForAll: jest.fn(async () => null),
}));
jest.mock("@/models/lms/programRequirements", () => ({
  ensureProgramEnrollments: jest.fn(async () => ({})),
}));

// --- participant_programs (le write métier) ----------------------------------
jest.mock("@/models/participantPortal", () => ({
  getParticipantProgramAssignments: jest.fn(async () => ({ rows: [] })),
  getProgramById: jest.fn(async () => ({ rows: [{ id: "P1" }] })),
  getContactEmailByCid: jest.fn(async () => ({ rows: [{ email: "p@example.com" }] })),
  checkFacilitatorConflict: jest.fn(async () => ({ rows: [] })),
  insertParticipantProgram: jest.fn(async () => ({})),
  insertAssignmentAudit: jest.fn(async () => ({})),
  insertEnrollmentTimeline: jest.fn(async () => ({})),
  deleteParticipantProgram: jest.fn(async () => ({ rowsAffected: 1 })),
  insertRemovalAudit: jest.fn(async () => ({})),
  insertWithdrawalTimeline: jest.fn(async () => ({})),
}));

// --- LMS (le write métier) ---------------------------------------------------
jest.mock("@/models/lms/errors", () => ({
  LmsError: class LmsError extends Error {
    constructor(key, status) {
      super(key);
      this.key = key;
      this.status = status;
    }
  },
}));
jest.mock("@/models/lms/courses", () => ({
  getCourse: jest.fn(async () => ({ id: "C1", title: "Course" })),
}));
jest.mock("@/models/lms/learningStore", () => ({
  selectContactCidByEmail: jest.fn(async () => ({ rows: [{ cid: "LEARN-1" }] })),
  insertEnrollment: jest.fn(async () => ({})),
  selectEnrollmentsByCourse: jest.fn(async () => ({ rows: [] })),
  selectContactsByCids: jest.fn(async () => ({ rows: [] })),
}));

const { syncContextGrantsForUser } = require("@/services/authorization/contextGrants");
const {
  assignParticipantToProgramsService,
  removeParticipantFromProgramService,
} = require("@/services/programs/participantPrograms");
const { enrollLearner } = require("@/services/lms/learning/enrollments");
const participantPortal = require("@/models/participantPortal");
const learningStore = require("@/models/lms/learningStore");

beforeEach(() => {
  jest.clearAllMocks();
  syncContextGrantsForUser.mockResolvedValue({ success: true });
  participantPortal.getProgramById.mockResolvedValue({ rows: [{ id: "P1" }] });
  participantPortal.checkFacilitatorConflict.mockResolvedValue({ rows: [] });
  participantPortal.deleteParticipantProgram.mockResolvedValue({ rowsAffected: 1 });
});

describe("PARTICIPANT — acceptation à un programme → reconcile inline", () => {
  test("assigner un participant déclenche le couple (program, participant)", async () => {
    const result = await assignParticipantToProgramsService({
      participant_id: "USR-1",
      program_ids: ["P1", "P2"],
      assigned_by: "ADMIN-1",
    });

    expect(result.success).toBe(true);
    expect(result.assigned).toEqual(["P1", "P2"]);
    // Un seul reconcile par personne, avec le bon couple — pas un par programme.
    expect(syncContextGrantsForUser).toHaveBeenCalledTimes(1);
    expect(syncContextGrantsForUser).toHaveBeenCalledWith("USR-1", {
      context: "program",
      roleKey: "participant",
    });
  });

  test("un échec de reconcile ne fait PAS échouer l'acceptation (best-effort)", async () => {
    syncContextGrantsForUser.mockRejectedValueOnce(new Error("db blip"));
    jest.spyOn(console, "error").mockImplementation(() => {});

    const result = await assignParticipantToProgramsService({
      participant_id: "USR-1",
      program_ids: ["P1"],
      assigned_by: "ADMIN-1",
    });

    expect(result.success).toBe(true);
    expect(result.assigned).toEqual(["P1"]);
  });

  test("aucun programme assigné → aucun reconcile", async () => {
    await assignParticipantToProgramsService({
      participant_id: "USR-1",
      program_ids: ["P1"],
      assigned_by: "ADMIN-1",
    });
    syncContextGrantsForUser.mockClear();
    // Un conflit facilitateur fait sauter l'écriture : pas de carte à ouvrir.
    participantPortal.checkFacilitatorConflict.mockResolvedValue({ rows: [{ id: 1 }] });

    const result = await assignParticipantToProgramsService({
      participant_id: "USR-1",
      program_ids: ["P1"],
      assigned_by: "ADMIN-1",
    });

    expect(result.assigned).toEqual([]);
    expect(syncContextGrantsForUser).not.toHaveBeenCalled();
  });
});

describe("PARTICIPANT — retrait d'un programme → reconcile inline", () => {
  test("retirer un participant réévalue la carte (fermeture si plus de programme)", async () => {
    const result = await removeParticipantFromProgramService({
      participant_id: "USR-1",
      program_id: "P1",
      assigned_by: "ADMIN-1",
    });

    expect(result.success).toBe(true);
    expect(syncContextGrantsForUser).toHaveBeenCalledWith("USR-1", {
      context: "program",
      roleKey: "participant",
    });
  });
});

describe("LEARNER — inscription LMS → reconcile inline", () => {
  test("enrôler un apprenant déclenche le couple (lms, learner)", async () => {
    const result = await enrollLearner({ courseId: "C1", userCid: "LEARN-1", source: "admin" });

    expect(result.success).toBe(true);
    expect(learningStore.insertEnrollment).toHaveBeenCalledWith("C1", "LEARN-1", "admin");
    expect(syncContextGrantsForUser).toHaveBeenCalledWith("LEARN-1", {
      context: "lms",
      roleKey: "learner",
    });
  });

  test("une inscription par email résout le cid puis réconcilie", async () => {
    await enrollLearner({ courseId: "C1", userEmail: "l@example.com", source: "admin" });

    expect(learningStore.selectContactCidByEmail).toHaveBeenCalledWith("l@example.com");
    expect(syncContextGrantsForUser).toHaveBeenCalledWith("LEARN-1", {
      context: "lms",
      roleKey: "learner",
    });
  });
});

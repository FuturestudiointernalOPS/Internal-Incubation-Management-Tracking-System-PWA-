/**
 * PHASE 6 — tranche 5 : expérience APPRENANT (LMS) = « soi-même ».
 *
 * Les routes d'apprentissage agissent sur l'apprenant connecté : la remise
 * d'évaluation et la complétion d'une leçon doivent transmettre `session.cid`,
 * jamais un identifiant fourni par le client.
 */

const SESSION = { cid: "SELF-CID", role: "member", email: "me@x.test" };
const mockLearning = {
  submitAssessment: jest.fn(async () => ({ score: 1 })),
  completeLesson: jest.fn(async () => ({ ok: true })),
};

jest.mock("@/lib/db", () => ({
  __esModule: true,
  initDb: jest.fn(async () => {}),
  default: { execute: jest.fn(async () => ({ rows: [] })) },
}));
jest.mock("@/server/auth/guards", () => ({ requireAuth: jest.fn(async () => null) }));
jest.mock("@/server/auth/session", () => ({ getSession: jest.fn(async () => SESSION) }));
jest.mock("@/services/lms/learning", () => mockLearning);

const submit = require("@/app/api/lms/assessments/[id]/submit/route");
const complete = require("@/app/api/lms/lessons/[id]/complete/route");

const params = (obj) => ({ params: Promise.resolve(obj) });

beforeEach(() => jest.clearAllMocks());

test("remise d'évaluation : le score est calculé pour session.cid", async () => {
  const answers = [{ questionId: "Q1", answer: "a" }];
  const res = await submit.POST({ json: async () => ({ answers }) }, params({ id: "A1" }));

  expect(res.status).toBe(200);
  expect(mockLearning.submitAssessment).toHaveBeenCalledWith("A1", "SELF-CID", answers);
});

test("complétion de leçon : session.cid, jamais un cid du corps", async () => {
  const res = await complete.POST(
    { json: async () => ({ cid: "OTHER-CID" }) },
    params({ id: "L1" }),
  );

  expect(res.status).toBe(200);
  expect(mockLearning.completeLesson).toHaveBeenCalledWith("L1", "SELF-CID");
  expect(mockLearning.completeLesson).not.toHaveBeenCalledWith("L1", "OTHER-CID");
});

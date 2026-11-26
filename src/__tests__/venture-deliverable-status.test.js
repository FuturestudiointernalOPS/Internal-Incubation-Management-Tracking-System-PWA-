/**
 * PATCH /api/ventures/[id]/deliverables — the deliverable's PROGRESS.
 *
 * The screen sends a word (`not_started`, `in_progress`, `blocked`) while the
 * column stores a different word (`pending`, `in_progress`, `blocked`). The
 * route is the one place that translates them; before this, `status_word` was
 * not accepted at all, so every status change answered 400 "No fields to
 * update" and never reached the database.
 *
 * Review outcomes are deliberately NOT settable here: approving or requesting
 * changes goes through `action: "review"`, which demands evidence and writes
 * the audit row. A status dropdown must not be able to grant an approval.
 */
jest.mock("@/lib/api/createHandler", () => ({
  createHandler: (handler) => handler,
}));

jest.mock("@/lib/ventureScopedAccess", () => ({
  requireVentureScopedAccess: jest.fn(async () => ({ session: { cid: "USR-1", role: "staff", name: "Sam" } })),
}));

jest.mock("@/lib/ventureDeliverables", () => ({
  canDefineDeliverables: jest.fn(async () => true),
  canReviewDeliverable: jest.fn(async () => true),
}));

jest.mock("@/services/ventures/deliverables", () => ({
  listDeliverables: jest.fn(async () => []),
  createDeliverable: jest.fn(async () => ({ id: 1 })),
  updateDeliverable: jest.fn(async () => ({ updated: true })),
  getDeliverable: jest.fn(async () => ({ id: 7, milestone_id: 3, status: "pending" })),
}));

jest.mock("@/services/translations/ventureContent", () => ({
  scheduleVentureTranslationWarmup: jest.fn(),
}));

jest.mock("@/models/ventureWorkspace", () => ({
  getVentureDbIdByCodeOrId: jest.fn(async () => ({ rows: [{ id: 1 }] })),
  getVentureMilestoneForDeliverables: jest.fn(async () => ({ rows: [{ id: 3 }] })),
}));

jest.mock("@/services/ventures/deliverableReview", () => ({
  readDeliverableDecision: jest.fn(async () => ({})),
  afterDeliverableSubmitted: jest.fn(async () => ({})),
  afterDeliverableReviewed: jest.fn(async () => ({})),
}));

const { updateDeliverable } = require("@/services/ventures/deliverables");
const { PATCH } = require("@/app/api/ventures/[id]/deliverables/route");

const patch = (body) =>
  PATCH(
    new Request("http://localhost/api/ventures/VNT-1/deliverables", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: "VNT-1" }) },
  );

beforeEach(() => jest.clearAllMocks());

test("a progress word is translated to the value the column stores", async () => {
  const response = await patch({ id: 7, status_word: "in_progress" });

  expect(response.status).toBe(200);
  expect(updateDeliverable).toHaveBeenCalledTimes(1);
  expect(updateDeliverable.mock.calls[0][1]).toMatchObject({ status: "in_progress" });
});

test("'not started' is stored as pending, not as the displayed word", async () => {
  await patch({ id: 7, status_word: "not_started" });

  expect(updateDeliverable.mock.calls[0][1]).toMatchObject({ status: "pending" });
});

test("an approval cannot be granted from the status control", async () => {
  const response = await patch({ id: 7, status_word: "approved" });

  expect(response.status).toBe(400);
  const body = await response.json();
  expect(body.error).toMatch(/review action/i);
  expect(updateDeliverable).not.toHaveBeenCalled();
});

test("an unknown word is refused rather than written", async () => {
  const response = await patch({ id: 7, status_word: "banana" });

  expect(response.status).toBe(400);
  expect(updateDeliverable).not.toHaveBeenCalled();
});

test("a status change alongside a definition edit still saves both", async () => {
  await patch({ id: 7, title: "Signed contract", status_word: "blocked" });

  expect(updateDeliverable.mock.calls[0][1]).toMatchObject({
    title: "Signed contract",
    status: "blocked",
  });
});

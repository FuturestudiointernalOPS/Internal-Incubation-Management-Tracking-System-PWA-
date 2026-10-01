/**
 * Investor relationships — the DECISIONS.
 *
 * These used to sit inline in `src/app/api/investor/relationships/route.js` and
 * `src/app/api/investor/relationships/meetings/route.js`. They now live in
 * `src/services/investor/relationships.js` and
 * `src/services/investor/relationshipMeetings.js`. This suite pins the
 * observable behaviour: the own-scope binding, the workspace create/update
 * orchestration, and the meeting creation + completion cascade.
 */

jest.mock("@/models/investorRelations", () => ({
  getInvestorUserIdByProfileId: jest.fn(),
  getPipelineById: jest.fn(),
  getRelationshipWorkspaceDetail: jest.fn(),
  getVentureIdByWorkspaceId: jest.fn(),
  getVentureNameForCompletedMeeting: jest.fn(),
  getVentureNameForScheduledMeeting: jest.fn(),
  getWorkspaceForMeetingCompletion: jest.fn(),
  insertMeetingCompletedTimeline: jest.fn(),
  insertMeetingScheduledTimeline: jest.fn(),
  insertRelationshipMeeting: jest.fn(),
  insertWorkspaceCreatedTimeline: jest.fn(),
  insertWorkspaceStatusChangedTimeline: jest.fn(),
  listMeetingsForWorkspace: jest.fn(),
  listRelationshipWorkspaces: jest.fn(),
  listWorkspaceMeetings: jest.fn(),
  listWorkspaceTimeline: jest.fn(),
  notifyIntroductionApproved: jest.fn(),
  setWorkspaceNextAction: jest.fn(),
  updateRelationshipMeeting: jest.fn(),
  updateRelationshipWorkspace: jest.fn(),
  upsertRelationshipWorkspace: jest.fn(),
}));

jest.mock("@/models/authorization/investorScope", () => ({
  resolveInvestorScope: jest.fn(),
  isSameInvestor: jest.fn(),
  investorOwnsWorkspace: jest.fn(),
}));

const relations = require("@/models/investorRelations");
const scope = require("@/models/authorization/investorScope");
const {
  listRelationshipsForViewer,
  createRelationshipWorkspace,
  updateRelationshipWorkspaceWithTimeline,
} = require("@/services/investor/relationships");
const {
  listMeetingsForViewer,
  createRelationshipMeeting,
  updateRelationshipMeetingCascade,
} = require("@/services/investor/relationshipMeetings");

const session = { cid: "C1", id: "C1", role: "member" };

beforeEach(() => {
  jest.clearAllMocks();
});

describe("listRelationshipsForViewer", () => {
  it("lets management list without a profile binding", async () => {
    scope.resolveInvestorScope.mockResolvedValue({ management: true, profileId: null });
    relations.listRelationshipWorkspaces.mockResolvedValue({ rows: [{ id: "w1" }] });

    const result = await listRelationshipsForViewer({ workspaceId: null, ventureId: null, session });

    expect(result).toEqual({ ok: true, workspaces: [{ id: "w1" }] });
    expect(relations.listRelationshipWorkspaces).toHaveBeenCalledWith({
      investorId: null,
      ventureId: null,
    });
  });

  it("returns nothing for a caller with no investor profile", async () => {
    scope.resolveInvestorScope.mockResolvedValue({ management: false, profileId: null });

    const result = await listRelationshipsForViewer({ workspaceId: null, ventureId: null, session });

    expect(result).toEqual({ ok: true, workspaces: [] });
    expect(relations.listRelationshipWorkspaces).not.toHaveBeenCalled();
  });

  it("scopes the list to the caller's own profile", async () => {
    scope.resolveInvestorScope.mockResolvedValue({ management: false, profileId: 7 });
    relations.listRelationshipWorkspaces.mockResolvedValue({ rows: [] });

    await listRelationshipsForViewer({ workspaceId: null, ventureId: "v9", session });

    expect(relations.listRelationshipWorkspaces).toHaveBeenCalledWith({
      investorId: 7,
      ventureId: "v9",
    });
  });

  it("refuses another investor's workspace detail with a 404", async () => {
    scope.resolveInvestorScope.mockResolvedValue({ management: false, profileId: 7 });
    scope.isSameInvestor.mockReturnValue(false);
    relations.getRelationshipWorkspaceDetail.mockResolvedValue({ rows: [{ id: 3, investor_id: 9 }] });

    const result = await listRelationshipsForViewer({ workspaceId: "3", ventureId: null, session });

    expect(result).toEqual({ ok: false, status: 404, error: "errors.notFound" });
    expect(relations.listWorkspaceMeetings).not.toHaveBeenCalled();
  });

  it("returns the caller's own workspace detail with its meetings and timeline", async () => {
    scope.resolveInvestorScope.mockResolvedValue({ management: false, profileId: 7 });
    scope.isSameInvestor.mockReturnValue(true);
    relations.getRelationshipWorkspaceDetail.mockResolvedValue({ rows: [{ id: 3, investor_id: 7 }] });
    relations.listWorkspaceMeetings.mockResolvedValue({ rows: [{ id: "m1" }] });
    relations.listWorkspaceTimeline.mockResolvedValue({ rows: [{ id: "t1" }] });

    const result = await listRelationshipsForViewer({ workspaceId: "3", ventureId: null, session });

    expect(result).toEqual({
      ok: true,
      detail: { workspace: { id: 3, investor_id: 7 }, meetings: [{ id: "m1" }], timeline: [{ id: "t1" }] },
    });
  });
});

describe("createRelationshipWorkspace", () => {
  it("requires a pipeline", async () => {
    expect(await createRelationshipWorkspace({ pipelineId: null, session })).toEqual({
      ok: false,
      status: 400,
      error: "pipeline_id required",
    });
  });

  it("reports a missing pipeline", async () => {
    relations.getPipelineById.mockResolvedValue({ rows: [] });

    expect(await createRelationshipWorkspace({ pipelineId: "p1", session })).toEqual({
      ok: false,
      status: 404,
      error: "Pipeline not found",
    });
  });

  it("upserts the workspace, logs the creation and notifies the investor", async () => {
    relations.getPipelineById.mockResolvedValue({ rows: [{ investor_id: 7, venture_id: 5 }] });
    relations.upsertRelationshipWorkspace.mockResolvedValue({
      rows: [{ id: "w1", investor_id: 7 }],
    });
    relations.getInvestorUserIdByProfileId.mockResolvedValue({ rows: [{ user_id: "u1" }] });

    const result = await createRelationshipWorkspace({ pipelineId: "p1", session });

    expect(result).toEqual({ ok: true, workspace: { id: "w1", investor_id: 7 } });
    expect(relations.upsertRelationshipWorkspace).toHaveBeenCalledWith("p1", 7, 5, null, null);
    expect(relations.insertWorkspaceCreatedTimeline).toHaveBeenCalledWith("w1", "C1");
    expect(relations.notifyIntroductionApproved).toHaveBeenCalledWith("u1");
  });
});

describe("updateRelationshipWorkspaceWithTimeline", () => {
  it("requires an id", async () => {
    expect(await updateRelationshipWorkspaceWithTimeline({ id: null, fields: {}, session })).toEqual({
      ok: false,
      status: 400,
      error: "id required",
    });
  });

  it("reports nothing to update", async () => {
    relations.updateRelationshipWorkspace.mockResolvedValue({ updated: false });

    expect(
      await updateRelationshipWorkspaceWithTimeline({ id: "w1", fields: { status: "active" }, session }),
    ).toEqual({ ok: false, status: 400, error: "Nothing to update" });
  });

  it("reports a missing workspace", async () => {
    relations.updateRelationshipWorkspace.mockResolvedValue({ rows: [] });

    expect(
      await updateRelationshipWorkspaceWithTimeline({ id: "w1", fields: {}, session }),
    ).toEqual({ ok: false, status: 404, error: "Workspace not found" });
  });

  it("logs a status change on the timeline", async () => {
    relations.updateRelationshipWorkspace.mockResolvedValue({ rows: [{ id: "w1" }] });

    const result = await updateRelationshipWorkspaceWithTimeline({
      id: "w1",
      fields: { status: "active" },
      session,
    });

    expect(result).toEqual({ ok: true, workspace: { id: "w1" } });
    expect(relations.insertWorkspaceStatusChangedTimeline).toHaveBeenCalledWith(
      "w1",
      "Workspace status changed to: active",
      "C1",
    );
  });

  it("does not log when the status is untouched", async () => {
    relations.updateRelationshipWorkspace.mockResolvedValue({ rows: [{ id: "w1" }] });

    await updateRelationshipWorkspaceWithTimeline({ id: "w1", fields: { current_stage: "x" }, session });

    expect(relations.insertWorkspaceStatusChangedTimeline).not.toHaveBeenCalled();
  });
});

describe("listMeetingsForViewer", () => {
  it("requires a workspace", async () => {
    expect(await listMeetingsForViewer({ workspaceId: null, session })).toEqual({
      ok: false,
      status: 400,
      error: "workspace_id required",
    });
  });

  it("refuses a workspace the caller does not own", async () => {
    scope.resolveInvestorScope.mockResolvedValue({ management: false, profileId: 7 });
    scope.investorOwnsWorkspace.mockResolvedValue(false);

    expect(await listMeetingsForViewer({ workspaceId: "w9", session })).toEqual({
      ok: false,
      status: 404,
      error: "errors.notFound",
    });
  });

  it("returns the meetings of the caller's own workspace", async () => {
    scope.resolveInvestorScope.mockResolvedValue({ management: false, profileId: 7 });
    scope.investorOwnsWorkspace.mockResolvedValue(true);
    relations.listMeetingsForWorkspace.mockResolvedValue({ rows: [{ id: "m1" }] });

    expect(await listMeetingsForViewer({ workspaceId: "w1", session })).toEqual({
      ok: true,
      meetings: [{ id: "m1" }],
    });
  });

  it("lets management through without an ownership check", async () => {
    scope.resolveInvestorScope.mockResolvedValue({ management: true, profileId: null });
    relations.listMeetingsForWorkspace.mockResolvedValue({ rows: [] });

    const result = await listMeetingsForViewer({ workspaceId: "w1", session });

    expect(result).toEqual({ ok: true, meetings: [] });
    expect(scope.investorOwnsWorkspace).not.toHaveBeenCalled();
  });
});

describe("createRelationshipMeeting", () => {
  it("requires a workspace", async () => {
    expect(await createRelationshipMeeting({ workspaceId: null, session })).toEqual({
      ok: false,
      status: 400,
      error: "workspace_id required",
    });
  });

  it("inserts with the defaults and logs the scheduling", async () => {
    relations.insertRelationshipMeeting.mockResolvedValue({ rows: [{ id: "m1" }] });
    relations.getVentureIdByWorkspaceId.mockResolvedValue({ rows: [{ venture_id: 5 }] });
    relations.getVentureNameForScheduledMeeting.mockResolvedValue({ rows: [{ name: "Acme" }] });

    const result = await createRelationshipMeeting({
      workspaceId: "w1",
      meetingType: "introductory",
      scheduledDate: "2026-05-01",
      session,
    });

    expect(result).toEqual({ ok: true, meeting: { id: "m1" } });
    expect(relations.insertRelationshipMeeting).toHaveBeenCalledWith(
      "w1",
      "introductory",
      "2026-05-01",
      null,
      60,
      null,
      null,
    );
    expect(relations.insertMeetingScheduledTimeline).toHaveBeenCalledWith(
      "w1",
      "introductory meeting scheduled for 2026-05-01",
      "C1",
    );
  });
});

describe("updateRelationshipMeetingCascade", () => {
  it("requires an id", async () => {
    expect(await updateRelationshipMeetingCascade({ id: null, fields: {}, session })).toEqual({
      ok: false,
      status: 400,
      error: "meeting id required",
    });
  });

  it("reports nothing to update", async () => {
    relations.updateRelationshipMeeting.mockResolvedValue({ updated: false });

    expect(
      await updateRelationshipMeetingCascade({ id: "m1", fields: { status: "completed" }, session }),
    ).toEqual({ ok: false, status: 400, error: "Nothing to update" });
  });

  it("reports a missing meeting", async () => {
    relations.updateRelationshipMeeting.mockResolvedValue({ rows: [] });

    expect(await updateRelationshipMeetingCascade({ id: "m1", fields: {}, session })).toEqual({
      ok: false,
      status: 404,
      error: "Meeting not found",
    });
  });

  it("logs the completion and seeds the workspace next action", async () => {
    relations.updateRelationshipMeeting.mockResolvedValue({ rows: [{ id: "m1" }] });
    relations.getWorkspaceForMeetingCompletion.mockResolvedValue({ rows: [{ id: "w1", venture_id: 5 }] });
    relations.getVentureNameForCompletedMeeting.mockResolvedValue({ rows: [{ name: "Acme" }] });

    const result = await updateRelationshipMeetingCascade({
      id: "m1",
      fields: { status: "completed", outcome: "great", action_items: ["follow up", "next"] },
      session,
    });

    expect(result).toEqual({ ok: true, meeting: { id: "m1" } });
    expect(relations.insertMeetingCompletedTimeline).toHaveBeenCalledWith(
      "w1",
      "Meeting completed: great for Acme",
      "C1",
    );
    expect(relations.setWorkspaceNextAction).toHaveBeenCalledWith("follow up", "w1");
  });

  it("leaves the workspace alone when the meeting is not completed", async () => {
    relations.updateRelationshipMeeting.mockResolvedValue({ rows: [{ id: "m1" }] });

    await updateRelationshipMeetingCascade({ id: "m1", fields: { status: "scheduled" }, session });

    expect(relations.getWorkspaceForMeetingCompletion).not.toHaveBeenCalled();
  });
});

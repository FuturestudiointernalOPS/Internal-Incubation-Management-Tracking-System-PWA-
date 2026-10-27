/**
 * CRM — timeline visibility (Lot 1 decisions).
 *
 * The decision under test: every event carries the domain it came from, and an
 * internal reader only receives the domains their rights open. CRM events never
 * follow a programme grant; form submissions follow the runs right, never the
 * CRM right. A personal identity reading its own record is unchanged.
 */

jest.mock("@/models/contacts/programMembership", () => ({
  getProgramIdsForPm: jest.fn(async () => ({ rows: [] })),
}));
jest.mock("@/services/authorization/programManagement", () => ({
  isProgramManagerProfileSession: jest.fn(async () => false),
}));
jest.mock("@/services/authorization/context", () => ({ can: jest.fn() }));
jest.mock("@/models/contacts/timeline", () => ({
  getContactTimelineEvents: jest.fn(async () => ({ rows: [] })),
  getTimelineContactIdentity: jest.fn(async () => ({ rows: [] })),
  createContactTimelineEvent: jest.fn(),
}));

const { can } = require("@/services/authorization/context");
const { getContactTimelineEvents } = require("@/models/contacts/timeline");
const { listContactTimeline } = require("@/services/contacts/timeline");

function grant(...keys) {
  const granted = new Set(keys);
  can.mockImplementation(async (_session, moduleKey, capability) =>
    granted.has(`${moduleKey}.${capability}`),
  );
}

const internal = { cid: "u-1", role: "staff" };
const personal = { cid: "c-1", role: "participant" };
const scope = { limit: 10, offset: 0 };

beforeEach(() => {
  jest.clearAllMocks();
  getContactTimelineEvents.mockResolvedValue({ rows: [] });
});

test("an internal reader receives only the domains their rights open", async () => {
  grant("crm.view", "programs.view");

  await listContactTimeline(internal, "c-1", scope);

  const [, options] = getContactTimelineEvents.mock.calls[0];
  expect(options.includeCrm).toBe(true);
  expect(options.visibleModules).toEqual(expect.arrayContaining(["crm", "programs"]));
  expect(options.visibleModules).not.toContain("ventures");
  expect(options.visibleModules).not.toContain("forms");
});

test("a reader without the CRM right never receives CRM events", async () => {
  grant("programs.view");

  await listContactTimeline(internal, "c-1", scope);

  const [, options] = getContactTimelineEvents.mock.calls[0];
  expect(options.includeCrm).toBe(false);
  expect(options.visibleModules).not.toContain("crm");
});

test("form submissions follow the runs right, never the CRM right", async () => {
  grant("crm.view");
  await listContactTimeline(internal, "c-1", scope);
  expect(getContactTimelineEvents.mock.calls[0][1].visibleModules).not.toContain("forms");

  grant("crm.view", "runs.view");
  await listContactTimeline(internal, "c-1", scope);
  expect(getContactTimelineEvents.mock.calls[1][1].visibleModules).toContain("forms");
});

test("a personal identity reading its own record keeps its existing timeline", async () => {
  grant("crm.view");

  await listContactTimeline(personal, "c-1", scope);

  const [, options] = getContactTimelineEvents.mock.calls[0];
  expect(options.visibleModules).toBeNull();
  expect(options.includeCrm).toBe(true);
});

/**
 * CRM — the timeline query the visibility decisions compile to.
 *
 * White-box on purpose: the rule lives in the SQL, and a regression here is a
 * data leak, so the WHERE clauses are asserted directly.
 */

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn(async () => ({ rows: [] })) },
}));

const db = require("@/lib/db").default;
const { getContactTimelineEvents } = require("@/models/contacts/timeline");

const scope = { limit: 10, offset: 0 };

beforeEach(() => {
  jest.clearAllMocks();
});

test("without CRM access the query excludes CRM events but keeps unlabelled rows", async () => {
  await getContactTimelineEvents("c-1", { ...scope, includeCrm: false });

  const [{ sql }] = db.execute.mock.calls[0];
  expect(sql).toContain("(context_module IS NULL OR context_module != 'crm')");
});

test("the visible domains are a whitelist that always keeps unlabelled rows", async () => {
  await getContactTimelineEvents("c-1", { ...scope, visibleModules: ["crm", "programs"] });

  const [{ sql, args }] = db.execute.mock.calls[0];
  expect(sql).toContain("(context_module IS NULL OR context_module IN (?,?))");
  expect(args).toEqual(["c-1", "crm", "programs", 10, 0]);
});

test("no visible domain means only unlabelled rows", async () => {
  await getContactTimelineEvents("c-1", { ...scope, visibleModules: [] });

  const [{ sql }] = db.execute.mock.calls[0];
  expect(sql).toContain("AND context_module IS NULL");
});

test("no restriction is the default (personal identity reading its own record)", async () => {
  await getContactTimelineEvents("c-1", { ...scope });

  const [{ sql }] = db.execute.mock.calls[0];
  expect(sql).not.toContain("context_module IN");
  expect(sql).not.toContain("context_module != 'crm'");
});

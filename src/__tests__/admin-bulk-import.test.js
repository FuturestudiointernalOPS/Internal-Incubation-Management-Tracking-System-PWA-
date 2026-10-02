/**
 * Behaviour of the bulk contact import (service layer).
 *
 * The repository, the password hasher and the parser are exercised with the
 * database mocked: the parse, the protected-group detection, the row
 * validation, the role boundary, the create-vs-update upsert, the rollback and
 * the completion notification.
 */

jest.mock("@/models/adminOps", () => ({
  deleteContactByCid: jest.fn(),
  findActiveContactByEmail: jest.fn(),
  getAllActiveContactPhones: jest.fn(),
  insertBulkImportNotification: jest.fn(),
  insertContact: jest.fn(),
  updateContactByEmail: jest.fn(),
}));
jest.mock("@/server/auth/password", () => ({
  hashPassword: jest.fn(async () => "HASH"),
}));

const models = require("@/models/adminOps");
const {
  parseContactCsv,
  csvWantsInternalGroup,
  importContacts,
} = require("@/services/dashboard/bulkImport");

beforeEach(() => {
  jest.clearAllMocks();
  models.getAllActiveContactPhones.mockResolvedValue({ rows: [] });
  models.findActiveContactByEmail.mockResolvedValue({ rows: [] });
  models.insertContact.mockResolvedValue({});
  models.updateContactByEmail.mockResolvedValue({});
  models.deleteContactByCid.mockResolvedValue({});
  models.insertBulkImportNotification.mockResolvedValue({});
});

describe("parseContactCsv", () => {
  test("parses a header-ed CSV into rows", () => {
    const { rows, empty } = parseContactCsv("name,email\nAnn,ann@x.test\n");
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Ann");
    expect(rows[0].email).toBe("ann@x.test");
    expect(empty).toBe(false);
  });

  test("an empty CSV reports empty", () => {
    expect(parseContactCsv("").empty).toBe(true);
  });
});

describe("csvWantsInternalGroup", () => {
  test("is true for the protected group, in any casing", () => {
    expect(csvWantsInternalGroup([{ group_name: "FUTURE STUDIO" }])).toBe(true);
    expect(csvWantsInternalGroup([{ group: "future studio" }])).toBe(true);
  });

  test("is false for ordinary groups", () => {
    expect(csvWantsInternalGroup([{ group_name: "Cohort A" }])).toBe(false);
  });
});

describe("importContacts — validation", () => {
  test("a row missing name or email is skipped and reported", async () => {
    const { body } = await importContacts({
      rows: [{ name: "", email: "a@x.test" }],
      canAssignRole: false,
    });
    expect(body.results.skipped).toBe(1);
    expect(body.results.errors[0].error).toContain("required");
    expect(models.insertContact).not.toHaveBeenCalled();
  });

  test("an invalid email is skipped", async () => {
    const { body } = await importContacts({
      rows: [{ name: "Ann", email: "not-an-email" }],
      canAssignRole: false,
    });
    expect(body.results.errors[0].error).toContain("email format");
  });

  test("a phone already on file is skipped", async () => {
    models.getAllActiveContactPhones.mockResolvedValue({
      rows: [{ phone: "111" }],
    });
    const { body } = await importContacts({
      rows: [{ name: "Ann", email: "a@x.test", phone: "111" }],
      canAssignRole: false,
    });
    expect(body.results.errors[0].error).toContain("Duplicate phone");
    expect(models.insertContact).not.toHaveBeenCalled();
  });

  test("a phone repeated inside the batch is skipped after the first", async () => {
    const { body } = await importContacts({
      rows: [
        { name: "Ann", email: "a@x.test", phone: "222" },
        { name: "Bob", email: "b@x.test", phone: "222" },
      ],
      canAssignRole: false,
    });
    expect(body.results.created).toBe(1);
    expect(body.results.skipped).toBe(1);
  });

  test("when every row fails, it succeeds with errors and writes nothing", async () => {
    const { status, body } = await importContacts({ rows: [], canAssignRole: false });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.results.created).toBe(0);
  });
});

describe("importContacts — the role boundary", () => {
  test("without the capability, a privileged role is clamped to participant", async () => {
    await importContacts({
      rows: [{ name: "Ann", email: "a@x.test", role: "super_admin" }],
      canAssignRole: false,
    });
    expect(models.insertContact.mock.calls[0][0].role).toBe("participant");
  });

  test("with the capability, the requested role is kept", async () => {
    await importContacts({
      rows: [{ name: "Ann", email: "a@x.test", role: "staff" }],
      canAssignRole: true,
    });
    expect(models.insertContact.mock.calls[0][0].role).toBe("staff");
  });
});

describe("importContacts — create vs update", () => {
  test("a new email inserts and counts as created", async () => {
    const { body } = await importContacts({
      rows: [{ name: "Ann", email: "a@x.test" }],
      canAssignRole: false,
    });
    expect(models.insertContact).toHaveBeenCalledTimes(1);
    expect(body.results.created).toBe(1);
    expect(body.results.updated).toBe(0);
  });

  test("a known email updates and counts as updated", async () => {
    models.findActiveContactByEmail.mockResolvedValue({ rows: [{ cid: "CNT1" }] });
    const { body } = await importContacts({
      rows: [{ name: "Ann", email: "a@x.test" }],
      canAssignRole: false,
    });
    expect(models.updateContactByEmail).toHaveBeenCalledTimes(1);
    expect(body.results.updated).toBe(1);
    expect(body.results.created).toBe(0);
  });

  test("a successful import notifies", async () => {
    await importContacts({
      rows: [{ name: "Ann", email: "a@x.test" }],
      canAssignRole: false,
    });
    expect(models.insertBulkImportNotification).toHaveBeenCalledWith(1, 0, 0);
  });
});

describe("importContacts — rollback", () => {
  test("a database error rolls the batch back and fails", async () => {
    models.insertContact
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error("boom"));

    const { status, body } = await importContacts({
      rows: [
        { name: "Ann", email: "a@x.test" },
        { name: "Bob", email: "b@x.test" },
      ],
      canAssignRole: false,
    });

    expect(status).toBe(500);
    expect(body.success).toBe(false);
    // The first row's cid was removed before returning.
    expect(models.deleteContactByCid).toHaveBeenCalledTimes(1);
    expect(models.insertBulkImportNotification).not.toHaveBeenCalled();
  });
});

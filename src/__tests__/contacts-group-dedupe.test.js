/**
 * A group name is the key contacts are filed under, so a second row with the
 * same name is not a second group: creation must reuse the existing row instead
 * of inserting a duplicate (which used to also auto-create a duplicate form).
 */

const mockModels = {
  findGroupByExactName: jest.fn(),
  createGroup: jest.fn(),
  createGroupAfterColumnSelfHeal: jest.fn(),
  addFamilyDescriptionColumn: jest.fn(),
  addFamilyDefaultRoleColumn: jest.fn(),
  addFamilyIsArchivedColumn: jest.fn(),
  updateGroup: jest.fn(),
  updateGroupAfterColumnSelfHeal: jest.fn(),
  addFamilyDescriptionColumnOnUpdate: jest.fn(),
  addFamilyDefaultRoleColumnOnUpdate: jest.fn(),
  addFamilyIsArchivedColumnOnUpdate: jest.fn(),
};

jest.mock("@/models/groups/contactGroups", () => mockModels);

const { createContactGroup } = require("@/services/contacts/groups");

beforeEach(() => {
  jest.clearAllMocks();
});

test("reuses the existing group and never inserts a duplicate", async () => {
  mockModels.findGroupByExactName.mockResolvedValue({
    rows: [{ id: 5, registration_id: "GRP-5", program_id: "P1" }],
  });

  await expect(
    createContactGroup({ name: "Interns 2026", programId: "P1" }),
  ).resolves.toEqual({
    id: 5,
    registration_id: "GRP-5",
    program_id: "P1",
    existing: true,
  });

  expect(mockModels.createGroup).not.toHaveBeenCalled();
  expect(mockModels.updateGroup).not.toHaveBeenCalled();
});

test("attaches a program-less existing group to the requested program", async () => {
  mockModels.findGroupByExactName.mockResolvedValue({
    rows: [{ id: 5, registration_id: "GRP-5", program_id: null }],
  });
  mockModels.updateGroup.mockResolvedValue({});

  await expect(
    createContactGroup({ name: "Interns 2026", programId: "P1" }),
  ).resolves.toEqual({
    id: 5,
    registration_id: "GRP-5",
    program_id: "P1",
    existing: true,
  });

  expect(mockModels.updateGroup).toHaveBeenCalledWith(
    ["program_id = ?"],
    ["P1", 5],
  );
  expect(mockModels.createGroup).not.toHaveBeenCalled();
});

test("creates a new group when the name is free", async () => {
  mockModels.findGroupByExactName.mockResolvedValue({ rows: [] });
  mockModels.createGroup.mockResolvedValue({
    rows: [{ id: 9, registration_id: "GRP-X" }],
  });

  await expect(
    createContactGroup({ name: "Cohort A", programId: null }),
  ).resolves.toEqual({ id: 9, registration_id: "GRP-X", program_id: null });

  expect(mockModels.createGroup).toHaveBeenCalledTimes(1);
  expect(mockModels.createGroup.mock.calls[0][0][0]).toBeNull();
});

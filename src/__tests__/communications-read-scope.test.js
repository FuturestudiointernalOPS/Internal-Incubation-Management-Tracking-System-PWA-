/**
 * The mark-read write is restricted to what the caller may see.
 *
 * The route-level session and `messaging/view` checks never proved ownership of
 * the ids a caller sent; the repository now re-applies the same visibility
 * predicate the inbox uses, so an id the caller cannot list updates zero rows.
 */

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn() },
}));

const db = require("@/lib/db").default;
const { updateMessagesReadByIds } = require("@/models/communications/messages");

beforeEach(() => {
  db.execute.mockReset().mockResolvedValue({ rows: [], rowsAffected: 1 });
});

test("a scoped plan restricts the update to the caller's own and group/program messages", async () => {
  const plan = {
    isSuperAdmin: false,
    targetCid: "USR1",
    groupIds: ["G1"],
    programIds: ["P1"],
    isFutureStudioStaff: true,
  };

  await updateMessagesReadByIds([7, 8], plan);

  const { sql, args } = db.execute.mock.calls[0][0];
  expect(sql).toContain("UPDATE v2_messages SET is_read = 1 WHERE id IN (?,?) AND (");
  expect(sql).toContain("(recipient_id = ? OR sender_id = ?)");
  expect(sql).toContain("(target_type = 'role' AND target_id = '__staff__')");
  expect(sql).toContain("(target_type = 'role' AND target_id IN (?))");
  expect(sql).toContain("(target_type = 'program' AND target_id IN (?))");
  expect(args).toEqual([7, 8, "USR1", "USR1", "G1", "P1"]);
});

test("a super-admin plan is unrestricted", async () => {
  await updateMessagesReadByIds([7], {
    isSuperAdmin: true,
    targetCid: "ADMIN",
    groupIds: [],
    programIds: [],
    isFutureStudioStaff: false,
  });

  const { sql, args } = db.execute.mock.calls[0][0];
  expect(sql).toBe("UPDATE v2_messages SET is_read = 1 WHERE id IN (?)");
  expect(args).toEqual([7]);
});

test("a scoped plan with no groups or programs still filters on the caller's cid", async () => {
  await updateMessagesReadByIds([9], {
    isSuperAdmin: false,
    targetCid: "USR2",
    groupIds: [],
    programIds: [],
    isFutureStudioStaff: false,
  });

  const { sql, args } = db.execute.mock.calls[0][0];
  expect(sql).toBe(
    "UPDATE v2_messages SET is_read = 1 WHERE id IN (?) AND ((recipient_id = ? OR sender_id = ?))",
  );
  expect(args).toEqual([9, "USR2", "USR2"]);
});

test("an empty id list writes nothing", async () => {
  const result = await updateMessagesReadByIds([], {
    isSuperAdmin: true,
    targetCid: "A",
    groupIds: [],
    programIds: [],
    isFutureStudioStaff: false,
  });

  expect(result.rowsAffected).toBe(0);
  expect(db.execute).not.toHaveBeenCalled();
});

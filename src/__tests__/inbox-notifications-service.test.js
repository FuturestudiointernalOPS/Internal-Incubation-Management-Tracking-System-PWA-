import {
  resolveInboxRecipient,
  canCreateNotificationFor,
  canModifyInboxNotification,
  selectUnreadRows,
  collectNotificationIds,
  parseUnreadCount,
} from "@/services/communications/inboxNotifications";

const member = { cid: "4", role: "member" };

describe("resolveInboxRecipient", () => {
  it.each(["super_admin", "staff", "program_manager"])(
    "lets %s target another inbox",
    (role) => {
      expect(resolveInboxRecipient({ cid: "1", role }, "9")).toBe("9");
    },
  );

  it("pins a non-privileged caller onto their own inbox", () => {
    expect(resolveInboxRecipient(member, "9")).toBe("4");
  });

  it("keeps the requested id when it is the caller's own", () => {
    expect(resolveInboxRecipient(member, "4")).toBe("4");
  });

  it("defaults to the caller when nothing is requested", () => {
    expect(resolveInboxRecipient(member, undefined)).toBe("4");
  });

  it("falls back to 'sa' with neither a request nor a cid", () => {
    expect(resolveInboxRecipient({ role: "staff" }, undefined)).toBe("sa");
  });

  it("tolerates a missing session", () => {
    expect(resolveInboxRecipient(null, "9")).toBe("9");
    expect(resolveInboxRecipient(null, undefined)).toBe("sa");
  });
});

describe("canCreateNotificationFor", () => {
  it("allows creating for oneself when no target is given", () => {
    expect(canCreateNotificationFor(member, undefined)).toBe(true);
  });

  it("compares ids as strings (4 and '4' are the same caller)", () => {
    expect(canCreateNotificationFor(member, 4)).toBe(true);
  });

  it("denies a non-privileged caller targeting someone else", () => {
    expect(canCreateNotificationFor(member, "9")).toBe(false);
  });

  it("allows privileged roles to target someone else", () => {
    for (const role of ["super_admin", "staff", "program_manager"]) {
      expect(canCreateNotificationFor({ cid: "1", role }, "9")).toBe(true);
    }
  });
});

describe("canModifyInboxNotification", () => {
  it("allows the recipient (ids compared as strings)", () => {
    expect(canModifyInboxNotification(member, 4)).toBe(true);
  });

  it("denies another non-privileged caller", () => {
    expect(canModifyInboxNotification(member, "9")).toBe(false);
  });

  it("allows privileged roles on any notification", () => {
    for (const role of ["super_admin", "staff", "program_manager"]) {
      expect(canModifyInboxNotification({ cid: "1", role }, "9")).toBe(true);
    }
  });
});

describe("selectUnreadRows", () => {
  it("keeps rows whose is_read is 0, '0', null or missing", () => {
    const rows = [
      { id: 1, is_read: 0 },
      { id: 2, is_read: 1 },
      { id: 3, is_read: null },
      { id: 4 },
      { id: 5, is_read: "0" },
    ];
    expect(selectUnreadRows(rows).map((row) => row.id)).toEqual([1, 3, 4, 5]);
  });

  it("returns an empty list for an empty list", () => {
    expect(selectUnreadRows([])).toEqual([]);
  });
});

describe("collectNotificationIds", () => {
  it("keeps every defined id, including 0", () => {
    const rows = [{ id: 1 }, { id: 0 }, { id: undefined }, { id: null }, {}];
    expect(collectNotificationIds(rows)).toEqual([1, 0]);
  });

  it("returns an empty list for missing rows", () => {
    expect(collectNotificationIds(undefined)).toEqual([]);
    expect(collectNotificationIds(null)).toEqual([]);
  });
});

describe("parseUnreadCount", () => {
  it("parses a string count", () => {
    expect(parseUnreadCount({ rows: [{ c: "7" }] })).toBe(7);
  });

  it("accepts a numeric count", () => {
    expect(parseUnreadCount({ rows: [{ c: 3 }] })).toBe(3);
  });

  it("returns 0 when the query returned no row", () => {
    expect(parseUnreadCount({ rows: [] })).toBe(0);
    expect(parseUnreadCount({})).toBe(0);
  });

  it("returns 0 when the count is null or 0", () => {
    expect(parseUnreadCount({ rows: [{ c: null }] })).toBe(0);
    expect(parseUnreadCount({ rows: [{ c: 0 }] })).toBe(0);
  });

  it("still throws on an undefined result so the route can fall back", () => {
    expect(() => parseUnreadCount(undefined)).toThrow();
  });
});

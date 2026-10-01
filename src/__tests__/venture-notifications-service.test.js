import {
  resolveNotificationRecipient,
  canAccessNotification,
} from "@/services/communications/ventureNotifications";

describe("resolveNotificationRecipient", () => {
  it("lets a super_admin target another recipient", () => {
    expect(
      resolveNotificationRecipient({ cid: "1", role: "super_admin" }, "9"),
    ).toBe("9");
  });

  it("keeps the requested id when it is the caller's own", () => {
    expect(
      resolveNotificationRecipient({ cid: "4", role: "staff" }, "4"),
    ).toBe("4");
  });

  it("pins a non-admin back to their own id", () => {
    expect(
      resolveNotificationRecipient({ cid: "4", role: "staff" }, "9"),
    ).toBe("4");
  });

  it("defaults to the caller when nothing is requested", () => {
    expect(
      resolveNotificationRecipient({ cid: "4", role: "staff" }, null),
    ).toBe("4");
  });

  it("falls back to 'sa' with neither a request nor a cid", () => {
    expect(
      resolveNotificationRecipient({ role: "super_admin" }, undefined),
    ).toBe("sa");
  });

  it("compares ids as strings (4 and '4' are the same caller)", () => {
    expect(
      resolveNotificationRecipient({ cid: "4", role: "staff" }, 4),
    ).toBe(4);
  });
});

describe("canAccessNotification", () => {
  it("allows the recipient", () => {
    expect(
      canAccessNotification({ cid: "4", role: "staff" }, { recipient_id: "4" }),
    ).toBe(true);
  });

  it("compares ids as strings", () => {
    expect(
      canAccessNotification({ cid: "4", role: "staff" }, { recipient_id: 4 }),
    ).toBe(true);
  });

  it("denies another non-admin", () => {
    expect(
      canAccessNotification({ cid: "4", role: "staff" }, { recipient_id: "9" }),
    ).toBe(false);
  });

  it("allows a super_admin on any notification", () => {
    expect(
      canAccessNotification({ cid: "1", role: "super_admin" }, { recipient_id: "9" }),
    ).toBe(true);
  });
});

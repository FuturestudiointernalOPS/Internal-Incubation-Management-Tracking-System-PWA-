const {
  deriveMembershipStatus,
  isEffectiveMembership,
  sortGroups,
  dedupeMemberships,
  EXPIRING_SOON_DAYS,
} = require("@/lib/membership-ui");

const NOW = new Date("2026-08-27T12:00:00Z");
const future = (days) => new Date(NOW.getTime() + days * 86_400_000).toISOString();
const past = (days) => new Date(NOW.getTime() - days * 86_400_000).toISOString();

describe("deriveMembershipStatus", () => {
  test("active with no expiry → active", () => {
    expect(deriveMembershipStatus({ status: "active", expires_at: null }, NOW)).toBe("active");
    expect(deriveMembershipStatus({ status: "active", expires_at: undefined }, NOW)).toBe("active");
  });

  test("active with far-future expiry → active", () => {
    expect(deriveMembershipStatus({ status: "active", expires_at: future(365) }, NOW)).toBe("active");
  });

  test("active with expiry within 30 days → expiringSoon", () => {
    expect(deriveMembershipStatus({ status: "active", expires_at: future(EXPIRING_SOON_DAYS - 1) }, NOW)).toBe("expiringSoon");
    expect(deriveMembershipStatus({ status: "active", expires_at: future(1) }, NOW)).toBe("expiringSoon");
  });

  test("active with past expiry → expired (display mirrors resolver)", () => {
    expect(deriveMembershipStatus({ status: "active", expires_at: past(2) }, NOW)).toBe("expired");
  });

  test("backend expired/ended statuses win", () => {
    expect(deriveMembershipStatus({ status: "expired", expires_at: future(100) }, NOW)).toBe("expired");
    expect(deriveMembershipStatus({ status: "ended", expires_at: null }, NOW)).toBe("ended");
  });

  test("missing row → active (defensive)", () => {
    expect(deriveMembershipStatus(null, NOW)).toBe("active");
  });
});

describe("isEffectiveMembership", () => {
  test("active/no-expiry is effective", () => {
    expect(isEffectiveMembership({ status: "active", expires_at: null }, NOW)).toBe(true);
  });
  test("past expiry is NOT effective", () => {
    expect(isEffectiveMembership({ status: "active", expires_at: past(1) }, NOW)).toBe(false);
  });
  test("expired/ended are NOT effective", () => {
    expect(isEffectiveMembership({ status: "expired", expires_at: null }, NOW)).toBe(false);
    expect(isEffectiveMembership({ status: "ended", expires_at: null }, NOW)).toBe(false);
  });
});

describe("sortGroups", () => {
  test("protected groups first, then alphabetical", () => {
    const sorted = sortGroups([
      { name: "BOOTCAMP", isProtected: false },
      { name: "FUTURE STUDIO", isProtected: true },
      { name: "ALUMNI", isProtected: false },
    ]);
    expect(sorted.map((g) => g.name)).toEqual(["FUTURE STUDIO", "ALUMNI", "BOOTCAMP"]);
  });
});

describe("dedupeMemberships", () => {
  test("dedupes by user_cid + group_name, last row wins", () => {
    const rows = dedupeMemberships([
      { user_cid: "U1", group_name: "FUTURE STUDIO", status: "active" },
      { user_cid: "U1", group_name: "FUTURE STUDIO", status: "ended" },
      { user_cid: "U2", group_name: "FUTURE STUDIO", status: "active" },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.user_cid === "U1").status).toBe("ended");
  });
});

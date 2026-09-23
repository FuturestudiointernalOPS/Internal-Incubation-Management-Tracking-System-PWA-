/**
 * SECURITY — regression tests for Lot 6 (P3 hardening).
 */

const fs = require("fs");
const path = require("path");
const { rowsToCsv } = require("@/lib/csv");
const { cidOrNull, isValidCid } = require("@/lib/ventureInput");

const ROOT = path.join(__dirname, "..", "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

describe("CSV exports neutralise formulas", () => {
  test("a formula cell is prefixed so a spreadsheet reads it as text", () => {
    const csv = rowsToCsv([["=cmd|' /C calc'!A0"], ["+1"], ["@SUM(A1)"]]);
    expect(csv).toContain("'=cmd|' /C calc'!A0");
    expect(csv).toContain("'+1");
    expect(csv).toContain("'@SUM(A1)");
  });

  test("plain negative numbers are left alone", () => {
    expect(rowsToCsv([[-12, -3.5]])).toBe("-12,-3.5");
  });

  test("the existing quoting rules still hold", () => {
    expect(rowsToCsv([["a,b"]])).toBe('"a,b"');
  });
});

describe("session hardening", () => {
  const src = read("src/lib/auth.js");

  test("no token material is logged", () => {
    expect(src).not.toMatch(/token:[\s\S]{0,40}substring\(0, 8\)/);
    expect(src).not.toMatch(/console\.log\([\s\S]{0,80}token\.substring/);
  });

  test("impersonation is persisted on the session row and returned", () => {
    expect(src).toMatch(/is_impersonation\)\s*\n?\s*VALUES \(\?, \?, \?, \?, \?, \?\)/);
    expect(src).toMatch(/is_impersonation: session\.is_impersonation === true/);
    expect(src).toMatch(/ensureSessionColumns/);
  });
});

describe("privileged writes and secrets", () => {
  test("running platform migrations requires the super_admin role", () => {
    const src = read("src/app/api/system/database/route.js");
    expect(src).toMatch(/requireAuth\(\["super_admin"\]\)/);
  });

  test.each([
    "src/app/api/notifications/due-reminders/route.js",
    "src/app/api/notifications/overdue/route.js",
    "src/app/api/engineering/permissions/context-grants-sweep/route.js",
  ])("%s reads the secret from a header first", (file) => {
    expect(read(file)).toMatch(/req\.headers\.get\("x-cron-secret"\) \|\| searchParams\.get\("key"\)/);
  });
});

describe("no raw HTML and server-controlled fields", () => {
  test("the public success message is sanitised", () => {
    const src = read("src/app/s/[runId]/page.js");
    expect(src).toMatch(/sanitizeRichText\(/);
  });

  test("lms enrollments force the admin source", () => {
    expect(read("src/app/api/lms/enrollments/route.js")).toMatch(/source: "admin"/);
  });

  test("the JSON store rejects prototype keys and non-arrays", () => {
    const src = read("src/app/api/data/route.js");
    expect(src).toMatch(/hasOwnProperty\.call\(db, table\)/);
    expect(src).toMatch(/Array\.isArray\(db\[table\]\)/);
  });

  test("program-types GET no longer runs DDL", () => {
    const src = read("src/app/api/program-types/route.js");
    const get = src.slice(src.indexOf("export async function GET"), src.indexOf("export async function POST"));
    expect(get).not.toMatch(/createProgramTypeOptionsTable|ensureProgramTypeOptionsTable/);
  });

  test("the project invitation cancel compares a cid, not a name", () => {
    const src = read("src/app/api/projects/invitations/respond/route.js");
    expect(src).not.toMatch(/session\.name !== invitation\.inviter_id/);
    expect(src).toMatch(/String\(session\.cid\) === String\(inviterCid\)/);
  });

  test("audit actors come from the session", () => {
    expect(read("src/app/api/admin/reject-user/route.js")).toMatch(/session\?\.name \|\| session\?\.cid \|\| "system"/);
    expect(read("src/app/api/tasks/comments/route.js")).toMatch(/session\.name \|\| sender_name \|\| session\.cid/);
  });
});

describe("person references are validated", () => {
  test("a cid must be a bounded, non-empty string", () => {
    expect(cidOrNull("  CNT-123  ")).toBe("CNT-123");
    expect(cidOrNull("")).toBeNull();
    expect(cidOrNull(null)).toBeNull();
    expect(cidOrNull(undefined)).toBeNull();
    expect(cidOrNull({ cid: "CNT-1" })).toBeNull();
    expect(cidOrNull(["CNT-1"])).toBeNull();
    expect(cidOrNull(42)).toBeNull();
    expect(cidOrNull("x".repeat(65))).toBeNull();
  });

  test("absent owners stay valid so a milestone can have no owner", () => {
    expect(isValidCid(null)).toBe(true);
    expect(isValidCid(undefined)).toBe(true);
    expect(isValidCid("CNT-1")).toBe(true);
    expect(isValidCid({})).toBe(false);
  });

  test("the milestone routes validate the owner before writing", () => {
    const src = read("src/app/api/ventures/[id]/milestones/route.js");
    expect(src).toMatch(/isValidCid\(body\.owner_cid\)/);
    expect(src).toMatch(/cidOrNull\(body\.owner_cid\)/);
  });
});

describe("legacy dependencies are typed and integer-keyed", () => {
  const src = read("src/app/api/ventures/[id]/timeline/route.js");

  test("only milestone/task dependencies are accepted", () => {
    expect(src).toMatch(/DEPENDENCY_TYPES = new Set\(\["milestone", "task"\]\)/);
    expect(src).toMatch(/DEPENDENCY_TYPES\.has\(sourceType\)/);
    expect(src).toMatch(/DEPENDENCY_TYPES\.has\(targetType\)/);
  });

  test("both add and remove require positive integer ids", () => {
    expect(src).toMatch(/Number\.isInteger\(sourceId\) \|\| sourceId <= 0/);
    expect(src).toMatch(/Number\.isInteger\(targetId\) \|\| targetId <= 0/);
    expect(src).toMatch(/Number\.isInteger\(dependencyId\) \|\| dependencyId <= 0/);
    expect(src).not.toMatch(/parseInt\(body\.source_id\)/);
  });
});

describe("the Resend webhook cannot be replayed", () => {
  const src = read("src/app/api/webhooks/resend/route.js");

  test("signatures are compared in constant time", () => {
    expect(src).toMatch(/crypto\.timingSafeEqual/);
    expect(src).not.toMatch(/\.includes\(expected\)/);
  });

  test("a stale signature is refused", () => {
    expect(src).toMatch(/MAX_SIGNATURE_AGE_SECONDS = 300/);
    expect(src).toMatch(/Math\.abs\(Date\.now\(\) \/ 1000 - timestampSeconds\) > MAX_SIGNATURE_AGE_SECONDS/);
    expect(src).toMatch(/Stale signature/);
  });
});

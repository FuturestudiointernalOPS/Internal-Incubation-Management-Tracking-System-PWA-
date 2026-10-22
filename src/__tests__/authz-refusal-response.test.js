/**
 * Lot 2.2 — one refusal shape.
 *
 * Every authentication/authorization refusal is built by the same helper, so
 * the body and the diagnostic header cannot drift between guards.
 */

const fs = require("node:fs");
const path = require("node:path");
const { refusalResponse } = require("@/server/http/refusal");

const read = (file) =>
  fs.readFileSync(path.join(process.cwd(), file), "utf8");

describe("refusalResponse", () => {
  test("always returns the stable body and status", async () => {
    const response = refusalResponse({
      status: 403,
      errorKey: "errors.insufficientPermissions",
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "errors.insufficientPermissions",
    });
  });

  test("a scoped refusal carries the missing right/perimeter", async () => {
    const response = refusalResponse({
      status: 403,
      errorKey: "errors.insufficientPermissions",
      missing: { capability: "ventures.edit", scope: "venture_own" },
    });

    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "errors.insufficientPermissions",
      missing: { capability: "ventures.edit", scope: "venture_own" },
    });
  });

  test("the diagnostic header is set only when a decision is supplied", () => {
    const withDecision = refusalResponse({
      status: 403,
      errorKey: "errors.insufficientPermissions",
      decision: "out-of-scope",
    });
    const withoutDecision = refusalResponse({
      status: 401,
      errorKey: "errors.authRequired",
    });

    expect(withDecision.headers.get("X-Authz-Decision")).toBe("out-of-scope");
    expect(withoutDecision.headers.get("X-Authz-Decision")).toBeNull();
  });
});

describe("the guards use the single builder", () => {
  const guarded = [
    "src/server/auth/guards.js",
    "src/server/authz/guards.js",
    "src/server/authz/responses.js",
    "src/lib/programScopedAccess.js",
    "src/lib/ventureScopedAccess.js",
  ];

  test.each(guarded)("%s imports refusalResponse and builds no JSON itself", (file) => {
    const src = read(file);
    expect(src).toContain("refusalResponse");
    expect(src).not.toContain("NextResponse.json");
  });
});

/**
 * Lot 2.2 — refusals are codes, not English sentences.
 *
 * A refusal returned to a screen carries an `errors.*` key that both locales
 * translate. The scan below is deliberately conservative: it only reports a
 * sentence when the nearest `status:` around it is 401 or 403, so a 404/400
 * message in the next branch is not blamed.
 */
describe("refusals are translated, not hardcoded", () => {
  // Server-to-server signals never reach a screen: provider signature errors and
  // cron-secret rejections stay in English on purpose.
  const TECHNICAL_ONLY = new Set([
    "src/services/email/resendWebhook.js",
    "src/app/api/notifications/due-reminders/route.js",
    "src/app/api/notifications/overdue/route.js",
    "src/app/api/tasks/notify-deadlines/route.js",
  ]);

  const SENTENCE = /error:\s*["'`]([A-Z][^"'`]{5,})["'`]/;
  const AUTHZ_STATUS = /status:\s*(401|403)\b/;
  const OTHER_STATUS = /status:\s*(400|404|409|410|422|429|500|503)\b/;

  function walk(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.posix.join(dir, entry.name);
      if (entry.isDirectory()) walk(file, out);
      else if (file.endsWith(".js")) out.push(file);
    }
    return out;
  }

  test("no 401/403 refusal is an English sentence", () => {
    const offenders = [];

    for (const file of [...walk("src/services"), ...walk("src/app/api")]) {
      if (TECHNICAL_ONLY.has(file)) continue;
      const lines = read(file).split("\n");

      lines.forEach((line, index) => {
        const match = line.match(SENTENCE);
        if (!match) return;

        let verdict = null;
        for (let distance = 0; distance <= 6 && !verdict; distance += 1) {
          const around = [lines[index - distance] || "", lines[index + distance] || ""];
          if (around.some((candidate) => AUTHZ_STATUS.test(candidate))) verdict = "authz";
          else if (around.some((candidate) => OTHER_STATUS.test(candidate))) verdict = "other";
        }

        if (verdict === "authz") offenders.push(`${file}:${index + 1} → ${match[1]}`);
      });
    }

    expect(offenders).toEqual([]);
  });

  test("the shared authentication keys replaced the old sentences", () => {
    const files = [...walk("src/app/api")];
    const offenders = files.filter((file) =>
      /error:\s*["'`](Authentication required\.|Not authenticated)["'`]/.test(read(file)),
    );
    expect(offenders).toEqual([]);
  });
});

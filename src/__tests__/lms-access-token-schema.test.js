/**
 * REGRESSION PIN — the paid-course access token must stay writable on the REAL
 * schema.
 *
 * The one-time link that lets a buyer choose their own password lives in
 * `password_setup_tokens`, a table shared with the invite / password-reset flow.
 * That flow owns the `token_type` column (added by
 * `src/migrations/phase_auth_invite_flow.sql`) and its constraint only admits
 * `staff_invite`, `participant_invite`, `password_reset` and `family_invite` —
 * and some environments never created the column at all.
 *
 * Writing `token_type = 'lms_purchase'` there made the INSERT fail. The failure
 * was swallowed by the access step, so a CONFIRMED payment was recorded as
 * "access failed": the buyer got a receipt with no link and no button, and
 * could neither sign in nor choose a password. The behavioural suite runs on a
 * fake database that cannot enforce a column constraint, so the guard has to be
 * here, on the source, where it cannot silently regress.
 */

const fs = require("node:fs");
const path = require("node:path");

const CHECKOUT_MODEL = "src/models/lms/checkout.js";

/** The values the invite/reset constraint accepts (the ONLY safe ones to write). */
const ALLOWED_TOKEN_TYPES = ["staff_invite", "participant_invite", "password_reset", "family_invite"];

test("the paid-course access token writes NO invite-only token type", () => {
  const src = fs.readFileSync(CHECKOUT_MODEL, "utf8");
  const insert = src.match(/INSERT INTO password_setup_tokens[\s\S]*?`/);
  expect(insert).not.toBeNull();
  // The column belongs to another flow; the access token is validated by its own
  // hash, expiry and `used` flag, so it must not depend on it.
  expect(insert[0]).not.toMatch(/\btoken_type\b/);
});

test("every token_type written anywhere is one the shared column accepts", () => {
  const writes = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // Tests describe the rule in prose; only production code is the subject.
        if (entry.name === "__tests__") continue;
        walk(fullPath);
        continue;
      }
      if (!/\.(js|mjs)$/.test(entry.name)) continue;
      const src = fs.readFileSync(fullPath, "utf8");
      // Only files that actually insert into the token table are relevant.
      if (!/INSERT INTO password_setup_tokens/.test(src)) continue;
      for (const hit of src.matchAll(/token_type[\s\S]{0,80}?'([a-z_]+)'/g)) {
        writes.push({ file: fullPath.replace(/\\/g, "/"), value: hit[1] });
      }
    }
  };
  walk("src");

  for (const write of writes) {
    expect(ALLOWED_TOKEN_TYPES).toContain(write.value);
  }
});

#!/usr/bin/env node
/**
 * Verify the legacy space addresses really redirect to their new homes.
 *
 * Usage:
 *   node scripts/check-space-redirects.mjs [base-url]
 *   SPACE_CHECK_COOKIE="impactos_session=…" node scripts/check-space-redirects.mjs https://…
 *
 * It asks for each old address WITHOUT following the redirect and checks that
 * the answer is a redirect (307 while the migration is being validated, 308
 * once SPACE_REDIRECTS_PERMANENT=1 is set) whose location is the new one.
 *
 * A session cookie is only needed if your middleware answers old page addresses
 * with the login redirect before the config redirect can run. If every line
 * reports a redirect to /login, pass SPACE_CHECK_COOKIE.
 */

import { SPACE_REDIRECTS } from "../src/spaces/redirects.js";

const BASE = (process.argv[2] || process.env.SPACE_CHECK_BASE || "http://localhost:3000").replace(
  /\/+$/,
  "",
);
const COOKIE = process.env.SPACE_CHECK_COOKIE || "";
const SAMPLE = "sample/path";

const concrete = (value) => value.replace(":path*", SAMPLE);
const pathOf = (location) => {
  try {
    return new URL(location, BASE).pathname;
  } catch {
    return location;
  }
};

let failures = 0;

console.log(`Checking ${SPACE_REDIRECTS.length} space redirects against ${BASE}\n`);

for (const entry of SPACE_REDIRECTS) {
  const from = concrete(entry.source);
  const expected = concrete(entry.destination);

  let response;
  try {
    response = await fetch(BASE + from, {
      redirect: "manual",
      headers: COOKIE ? { cookie: COOKIE } : {},
    });
  } catch (error) {
    failures += 1;
    console.log(`FAIL ${from} — request failed: ${error.message}`);
    continue;
  }

  const status = response.status;
  const isRedirect = status === 307 || status === 308;
  const location = response.headers.get("location") || "";
  const actual = pathOf(location);

  if (!isRedirect) {
    failures += 1;
    console.log(`FAIL ${from} — expected a redirect, got ${status} (${actual || "no location"})`);
    continue;
  }
  if (actual !== expected) {
    failures += 1;
    console.log(`FAIL ${from} — expected ${expected}, got ${actual}`);
    continue;
  }

  console.log(`ok   ${from} → ${actual} (${status})`);
}

console.log("");
if (failures > 0) {
  console.log(`${failures} redirect(s) failed.`);
  process.exit(1);
}
console.log("All space redirects point at their new homes.");

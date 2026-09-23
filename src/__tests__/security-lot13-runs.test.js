/**
 * SECURITY — Lot 13 (platform Runs: the submitter_id read).
 *
 * Registry finding BOLA-FORM-1: the platform Runs domain is a GLOBAL,
 * capability-gated surface, so most of it cannot be scoped without a product
 * decision (there is no tenant dimension on `platform_form_runs`). One part was
 * a genuine, fixable BOLA: `GET /api/platform/form-runs?submitter_id=X` returned
 * ANY user's submissions — the id came straight from the query string and only
 * `runs.view` guarded it.
 */

const fs = require("fs");
const path = require("path");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", "..", file), "utf8");

describe("platform Runs submitter reads are session-bound", () => {
  const src = read("src/app/api/platform/form-runs/route.js");

  test("the submitter_id branch binds the target to the session", () => {
    expect(src).toMatch(
      /const targetSubmitter = session\.role === "super_admin" \? submitterId : session\.cid/,
    );
    expect(src).toMatch(/getSubmissionsBySubmitterId\(targetSubmitter\)/);
  });

  test("the raw client-supplied id is no longer passed straight through", () => {
    expect(src).not.toMatch(/getSubmissionsBySubmitterId\(submitterId\)/);
  });

  test("the self-service path still binds to the session cid", () => {
    expect(src).toMatch(/getMySubmissionsBySubmitterId\(session\.cid\)/);
  });
});

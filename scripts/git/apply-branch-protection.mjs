#!/usr/bin/env node
/**
 * Turn on the server-side half of the branch guard.
 *
 * Run this once, with `gh` authenticated as an administrator of the repository:
 *
 *   gh auth login
 *   node scripts/git/apply-branch-protection.mjs
 *
 * It protects `main` so that:
 *   - a pull request is required (no direct push),
 *   - the `branch-guard` workflow must pass before the merge,
 *   - force pushes and branch deletion are refused,
 *   - administrators are held to the same rule.
 *
 * The `interns` side of the rule (never accept `white_label_os`) is enforced by
 * the workflow itself, which closes offending pull requests. GitHub branch
 * protection cannot express "only this source branch", so the workflow is the
 * blocking layer there.
 *
 * See docs/BRANCH_PROTECTION.md.
 */

import { execFileSync, spawnSync } from "node:child_process";

const MAIN_BRANCH = process.env.MAIN_BRANCH ?? "main";
const REQUIRED_CHECK = process.env.REQUIRED_CHECK ?? "guard";

function fail(message) {
  console.error(`branch-protection: ${message}`);
  process.exit(1);
}

function gh(args, input) {
  return execFileSync("gh", args, {
    input,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "inherit"],
  });
}

function main() {
  const auth = spawnSync("gh", ["auth", "status"], { encoding: "utf8" });
  if (auth.status !== 0) {
    fail(
      "gh is not authenticated. Run `gh auth login` as an administrator of the repository, then retry.",
    );
  }

  const repo = gh([
    "repo",
    "view",
    "--json",
    "nameWithOwner",
    "-q",
    ".nameWithOwner",
  ]).trim();

  if (!repo) {
    fail("could not resolve the repository. Run this from inside the clone.");
  }

  const protection = {
    required_status_checks: {
      strict: true,
      contexts: [REQUIRED_CHECK],
    },
    enforce_admins: true,
    required_pull_request_reviews: {
      dismiss_stale_reviews: true,
      require_code_owner_reviews: false,
      required_approving_review_count: 0,
    },
    restrictions: null,
    allow_force_pushes: false,
    allow_deletions: false,
    required_conversation_resolution: true,
    required_linear_history: false,
  };

  console.log(`branch-protection: protecting ${repo}#${MAIN_BRANCH} ...`);

  try {
    gh(
      [
        "api",
        "--method",
        "PUT",
        `/repos/${repo}/branches/${MAIN_BRANCH}/protection`,
        "-H",
        "Accept: application/vnd.github+json",
        "--input",
        "-",
      ],
      JSON.stringify(protection),
    );
  } catch {
    fail(
      `GitHub refused the protection update. Check that your account is an administrator of ${repo}.`,
    );
  }

  console.log(
    `branch-protection: done. Direct pushes to ${MAIN_BRANCH} are blocked, and the '${REQUIRED_CHECK}' check is required.`,
  );
  console.log(
    "branch-protection: to require an approval as well, raise required_approving_review_count in this script.",
  );
}

main();

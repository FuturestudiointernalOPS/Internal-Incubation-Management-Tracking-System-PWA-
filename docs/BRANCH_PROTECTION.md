# Branch protection

Two merge directions are forbidden on this repository:

| Direction | Rule |
|---|---|
| any branch → `main` | only `G` may be merged into `main` |
| `white_label_os` → `interns` | never allowed |

`G` → `main` is the documented promotion path (see `docs/PRODUCTION_TEST.md`).
Everything else reaching `main` — `interns`, a revert branch, a feature branch —
is an accident and must be refused.

The rule is enforced in three independent layers, because each one covers a
different way the mistake can happen.

## 1. Pull requests — `.github/workflows/branch-guard.yml`

The workflow runs on every pull request (`opened`, `reopened`, `synchronize`,
`edited`). The job is named **`guard`**.

- If the pull request breaks one of the two rules, the workflow comments the
  reason and **closes the pull request**.
- The job also fails, so the `guard` check is red.

The close step needs the `pull-requests: write` permission, which works for
branches in this repository. A pull request opened from a fork cannot be closed
by the workflow, but its `guard` check still fails.

The two values live at the top of the job, in `env`:

```yaml
MAIN_SOURCE_BRANCH: G
BLOCKED_INTO_INTERNS: white_label_os
```

## 2. Server-side protection of `main`

The workflow only runs for pull requests. To also block direct pushes to
`main`, turn on branch protection once, from a clone where `gh` is
authenticated as an administrator:

```bash
gh auth login
node scripts/git/apply-branch-protection.mjs
```

This enables, on `main`:

- a pull request is required (no direct push),
- the `guard` check must pass before merging,
- force pushes are refused,
- branch deletion is refused,
- administrators are held to the same rule.

GitHub branch protection cannot express “only this source branch”, so the
`white_label_os` → `interns` rule is carried by the workflow (layer 1), not by
branch protection.

To remove the protection again:

```bash
gh api --method DELETE /repos/:owner/:repo/branches/main/protection
```

## 3. Local guard before pushing — `scripts/git-hooks/pre-push`

Install it once per clone:

```bash
sh scripts/git-hooks/install.sh
```

The hook refuses, before anything reaches GitHub:

- a push to `main` whose commit is not reachable from the local `G` branch
  (fetch it first with `git fetch origin G:G` if needed);
- a push to `interns` whose history contains `white_label_os`.

It reads the refs Git passes on standard input and checks ancestry, so it
catches a local merge that was made by mistake as well as a direct push.

Undo with:

```bash
git config --unset core.hooksPath
```

## Changing the rules

- Change the allowed source for `main` or the blocked source for `interns` in
  the `env` block of the workflow.
- Keep the local hook in step: it looks for `refs/heads/G` (or
  `refs/remotes/origin/G`) and `refs/heads/white_label_os` (or
  `refs/remotes/origin/white_label_os`).
- Update the table at the top of this file.

## Limitations

- A pull request from a fork cannot be closed automatically; it is still
  blocked by the failing `guard` check once branch protection requires it.
- Someone who does not install the local hook can still merge locally. The
  server-side layers (1 and 2) remain the authority.
- The workflow does not prevent a direct push to `interns` from a machine that
  has not installed the hook. There is no GitHub mechanism to restrict the
  source branch of a direct push; the hook is the measure there.

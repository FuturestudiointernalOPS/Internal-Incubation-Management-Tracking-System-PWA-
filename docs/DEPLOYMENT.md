# Deployment — permanently pointed at FutureStudio

This project belongs to **Future Studio** and deploys to the **FutureStudio Vercel
project**, from the **FutureStudio GitHub organisation**. Nothing on this machine
should ever push, build or deploy it as another account.

The settings below are **repo-local** (`git config --local`), so they travel with
this checkout rather than with the person using it.

---

## 1. The repository

| Setting | Value |
|---|---|
| `remote.origin.url` | `https://github.com/FuturestudiointernalOPS/Internal-Incubation-Management-Tracking-System-PWA-.git` |
| `user.name` | `Future Studio Ops` |
| `user.email` | `ops@futurestudio.bj` |

Verify:

```bash
git config --local --get remote.origin.url
git config --local --get user.name
git config --local --get user.email
```

The commit identity matters: it is what the Vercel deployment and the GitHub
history attribute the work to.

---

## 2. Credentials — why `store`, and why the order matters

Git reads `credential.helper` from **system → global → local**, and the *first*
helper that can answer wins. On this workstation the system and global configs
both register Git Credential Manager:

```
credential.helper=manager   # /etc/gitconfig
credential.helper=manager   # ~/.gitconfig
```

That GCM identity is a **personal** GitHub account with no access to the
FutureStudio organisation, so every push failed with:

```
remote: Permission to FuturestudiointernalOPS/… denied to digitalgalaxy200-VibeC.
fatal: … The requested URL returned error: 403
```

The FutureStudio credential already exists in `~/.git-credentials`
(`https://FuturestudiointernalOPS:<token>@github.com`). The fix is to make this
repository ignore every inherited helper and read only that store:

```bash
git config --local --unset-all credential.helper
git config --local --add credential.helper ""      # empty value RESETS the list
git config --local --add credential.helper store
```

`git config --local --get-all credential.helper` then prints an empty line
followed by `store`. The empty entry is what cancels the two `manager` entries
inherited from above.

Verify that auth resolves as FutureStudio **without prompting**:

```bash
GIT_TERMINAL_PROMPT=0 git ls-remote origin HEAD
```

A commit hash means the right credential was used. A `403` means the store
entry is missing or expired — re-create it with:

```bash
git config --local --add credential.helper store
# then push once and enter the FutureStudio token when asked
```

> The token is stored in plain text in `~/.git-credentials`. That is acceptable
> on a dedicated workstation; on a shared machine, prefer `manager` with the
> FutureStudio account signed in instead.

---

## 3. Deployment

Deployments are produced by the **Vercel ↔ GitHub integration**, not by anything
in this repository. There is deliberately no `.vercel/` directory and no
`vercel.json`: the project's framework and build settings live in the Vercel
dashboard, and a committed override would silently disagree with them.

| Branch | Vercel |
|---|---|
| `main` | **Production** — the promotion target |
| `G` | Preview (staging) |
| `Ventures` | Preview |

So "deploying to FutureStudio" means **merging into `main` on the FutureStudio
repository**; Vercel picks it up and builds it in the FutureStudio project. The
domains reported by that project are the ones ending in
`futurestudiointernalops-projects.vercel.app`.

Promotion to `main` is gated by the **production test** —
`docs/PRODUCTION_TEST.md`. A green build is not a substitute: production and
staging are different databases.

### If Vercel CLI deploys are ever needed

`.vercel` is gitignored, so a link is per-machine. Without it, `npx vercel` only
offers to create a **new** project under whichever account happens to be logged
in — which is exactly the drift this document exists to prevent. Always link
explicitly, to the existing FutureStudio project and scope:

```bash
npx vercel link --yes --project <futurestudio-project> --scope futurestudiointernalops-projects
```

Do **not** run `npx vercel` (auto-link) or `npx vercel --yes` from this folder.

---

## 4. Checklist before every push or promotion

- [ ] `git config --local --get remote.origin.url` → FutureStudio repository
- [ ] `git config --local --get user.email` → `ops@futurestudio.bj`
- [ ] `GIT_TERMINAL_PROMPT=0 git ls-remote origin HEAD` succeeds
- [ ] Pushing to `main`? Run `docs/PRODUCTION_TEST.md` first
- [ ] Never `git add -A`; stage files explicitly

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
in this repository. Production is served from **https://impactos.futurestudio.bj**.

| Branch | Vercel |
|---|---|
| `main` | **Production** — the promotion target |
| `G` | Preview (staging) |
| `Ventures` | Preview |

So "deploying to FutureStudio" means **merging into `main` on the FutureStudio
repository**; Vercel picks it up and builds it in the FutureStudio project.

Promotion to `main` is gated by the **production test** —
`docs/PRODUCTION_TEST.md`. A green build is not a substitute: production and
staging are different databases.

### This workstation is linked (do not re-link blindly)

`vercel link` writes `.vercel/project.json`, which `.gitignore` excludes — so the
link is **per machine** and must be recreated on a new checkout. This machine is
linked to:

| Setting | Value |
|---|---|
| Project | `internal-incubation-management-tracking-system-pwa` |
| Project ID | `prj_cJF1IF7D2sdrDsA4IUsfzldHZ2Vn` |
| Team (org) ID | `team_hu1bP8PCeANzCNu25wSu9tTF` |
| Account | `futurestudiointernalops` |
| Active team | `futurestudiointernalops-projects` |
| Production domain | https://impactos.futurestudio.bj |

Recreate it on a new machine with the exact command — never auto-link:

```bash
npx vercel login                          # browser device flow, approve as futurestudiointernalops
npx vercel link --yes \
  --project internal-incubation-management-tracking-system-pwa \
  --scope futurestudiointernalops-projects
```

Verify:

```bash
npx vercel whoami                 # futurestudiointernalops
npx vercel project ls             # project must already exist in the list
cat .vercel/project.json          # projectId + orgId as above
```

> **`vercel link` edits `.env.local`.** It downloads a fresh `VERCEL_OIDC_TOKEN`
> and writes that line. It does not touch `DATABASE_URL` — verified after
> linking: the file kept its 7 keys and `DATABASE_URL` still pointed at the
> Supabase `eu-west-1` pooler. Still, re-check before running anything that
> touches the database, because a link against the wrong project can rewrite
> the whole file.

### The one remaining way to drift

Running bare `npx vercel` in a folder with **no** `.vercel/project.json` offers
to create a **new** project under whatever account is logged in. That is how a
deploy ends up somewhere other than FutureStudio. Always check
`vercel whoami` first, and always link explicitly as shown above.

---

## 4. Checklist before every push or promotion

- [ ] `git config --local --get remote.origin.url` → FutureStudio repository
- [ ] `git config --local --get user.email` → `ops@futurestudio.bj`
- [ ] `GIT_TERMINAL_PROMPT=0 git ls-remote origin HEAD` succeeds
- [ ] `npx vercel whoami` → `futurestudiointernalops` (only if deploying via CLI)
- [ ] Pushing to `main`? Run `docs/PRODUCTION_TEST.md` first
- [ ] Never `git add -A`; stage files explicitly

# The address contract — every screen, one address

Status: **foundation built (P0)**. `D1` and `D3` are settled (see §11). The
address catalogue lists 197 screens and 73 pending moves; **no address has moved
yet**, and no redirect is emitted until a move is finished. See §12 for the
foundation and the two-agent split.

The goal: every page address is readable as **role / context / feature**, the
folder tree says the same thing as the address, and no screen has two addresses.

---

## 1. The rule

| Shape | Used for | Example |
|---|---|---|
| `/{role}` | the space's own home | `/staff` |
| `/{role}/{feature}` | the space's core screens — **stay short** | `/staff/tasks` |
| `/{role}/{context}` | a context's home | `/staff/finance` |
| `/{role}/{context}/{feature}` | a screen that belongs to a context | `/admin/operations/tasks` |
| `/{role}/{context}/{feature}/{id}?tab={view}` | one record, its views behind `?tab=` | `/admin/ventures/VNT-1?tab=journey` |

Four supporting rules:

1. **One screen, one address.** Two doors to the same screen keep one canonical
   address; the other becomes a redirect.
2. **Detail is a tab.** A record's views never add a path segment; they are
   `?tab=` values on the record's address. A *different screen* may still nest
   (a project inside a venture, a lesson inside a course).
3. **Old addresses never break.** Everything that existed is added to the
   existing redirect table: temporary while validating, permanent after
   `docs/PRODUCTION_TEST.md` passes.
4. **Untouched:** public/token pages (`/login`, `/join/…`, `/verify/…`,
   `/form/…`, `/open/…`, `/invite/…`, `/s/…`) and all 499 API endpoints.

Vocabulary used below: **role** = member | staff | admin; **context** = what the
screen's owner does there; **feature** = the screen.

---

## 2. Context catalogue per role

**member** — cumulative, taken from the member context manifest:

| Context | Owns |
|---|---|
| `participant` | programmes, courses/learning, certificates, messages, profile, progress, timeline, rituals, announcements, assignments, ventures |
| `founder` | meetings |
| `investor` | deal flow, diligence, portfolio, organisations, history, profile, deck |
| `facilitator` | programmes, reviews, profile |
| `team` | the team workspace |

**staff**:

| Context | Owns |
|---|---|
| *(core)* | `/staff`, dashboard, weekly ops, tasks, projects, messages, my account |
| `lead-manager` | the venture workspace (my ventures, a venture, its views) |
| `program-manager` | programmes, progress, submissions, LMS courses, communications |
| `venture-admin` | portfolio-wide ventures, portfolio rollup, reporting settings |
| `crm` | every CRM screen |
| `finance` | the finance screen |
| `create` | delegated creation (venture, programme, investor) |

**admin** — the twelve permission sections are the contexts, so permissions,
sidebar and addresses agree:

| Context | Owns |
|---|---|
| `ventures` | all ventures, a venture and its views, document types, portfolio, reporting settings, venture permissions, venture projects |
| `investors` | the nine investor screens |
| `programs` | programmes, a programme, groups, teams, progress |
| `crm` | CRM, people, duplicates, membership, timeline, bulk import |
| `communication` | campaigns, contacts, responses, segments, announcements, messages, **forms** |
| `operations` | ops board, projects, tasks, blockers |
| `reports` | reports, program reports, op reports, program health, journey reports |
| `knowledge` | the knowledge base |
| `lms` | courses, registrations |
| `security` | security, permissions, pending approvals, user access, audit logs |
| `settings` | settings, system monitoring, standardisation, recycle bin, notifications |
| `finance` | finance |

Two admin areas do not fit the twelve and stay as their own contexts:
`intelligence` and the platform owner's personal `profile` (`D5`).

---

## 3. Canonical owner of shared screens

Your rule: each role's shared screen is owned by that role's context.

| Shared screen | Canonical address | Redirected from |
|---|---|---|
| Staff venture workspace | `/staff/lead-manager/ventures` (`D2`) | `/staff/ventures` |
| Member ventures | `/member/participant/ventures` | `/founder/ventures` (already) |
| The one member dashboard | `/member/dashboard` (`D4`) | `/dashboard` |
| Forms workspace | `/admin/communication/forms` | `/platform`, `/admin/platform/*` |
| Admin venture directory | `/admin/ventures` | — |

---

## 4. Admin — what moves

Unchanged (already conform): `/admin`, `ventures/*` (37 — of which 27 are
record views, §8), `investors/*` (10), `programs/*` (5), `crm/*` (5),
`security/*` (9), `lms/*` (4), `finance`, `knowledge`, `reports`,
`reports/responses`, `settings`, `intelligence`, `profile`,
`ventures/document-types`, `ventures/portfolio`, `ventures/reporting-settings`,
`ventures/permissions`, `ventures/projects`, `ventures/projects/[id]`,
`ventures/projects/emails`.

| Current | Target |
|---|---|
| `/admin/communications/campaigns` | `/admin/communication/campaigns` |
| `/admin/communications/contacts` | `/admin/communication/contacts` |
| `/admin/communications/responses` | `/admin/communication/responses` |
| `/admin/communications/segments` | `/admin/communication/segments` |
| `/admin/announcements` | `/admin/communication/announcements` |
| `/admin/internal-comms` | `/admin/communication/messages` |
| `/admin/platform/import` | `/admin/communication/forms/import` |
| `/admin/platform/import/review` | `/admin/communication/forms/import/review` |
| `/admin/platform/scores` | `/admin/communication/forms/scores` |
| `/admin/tasks` | `/admin/operations/tasks` |
| `/admin/blockers` | `/admin/operations/blockers` |
| `/admin/work` | `/admin/operations/board` |
| `/admin/projects` | `/admin/operations/projects` |
| `/admin/projects/[id]` | `/admin/operations/projects/[id]` |
| `/admin/op-reports` | `/admin/reports/op-reports` |
| `/admin/metrics` | `/admin/reports/metrics` |
| `/admin/journey-reports` | `/admin/reports/journey-reports` |
| `/admin/progress` | `/admin/programs/progress` |
| `/admin/pending-users` | `/admin/security/pending-users` |
| `/admin/bulk-upload` | `/admin/crm/bulk-upload` |
| `/admin/audit-logs` | `/admin/security/audit-logs` |
| `/admin/access` | `/admin/security/access` |
| `/admin/system` | `/admin/settings/system` |
| `/admin/standardization` | `/admin/settings/standardization` |
| `/admin/recycle-bin` | `/admin/settings/recycle-bin` |
| `/admin/notifications` | `/admin/settings/notifications` |

That is 26 admin addresses; only the four `communications` ones rename their
context (`D6`).

---

## 5. Staff — what moves

Unchanged (already conform): `/staff`, `program-manager/*` (13), `crm/*` (15),
`venture-admin/*` (4), `create/*` (3), `finance`, `dashboard`, `me`, `messages`,
`tasks`, `projects`, `projects/[id]`, `op-report`.

| Current | Target |
|---|---|
| `/staff/ventures` | `/staff/lead-manager/ventures` |
| `/staff/ventures/all` | `/staff/venture-admin/ventures` (duplicate, `D3`) |
| `/staff/ventures/[id]` | `/staff/lead-manager/ventures/[id]` |
| `/staff/ventures/[id]/document-types` | `/staff/lead-manager/ventures/[id]?tab=document-types` |
| `/staff/ventures/[id]/emails` | `/staff/lead-manager/ventures/[id]?tab=emails` |
| `/staff/ventures/portfolio` | `/staff/venture-admin/portfolio` (duplicate) |
| `/staff/ventures/reporting-settings` | `/staff/venture-admin/reporting-settings` (duplicate) |
| `/staff/ventures/document-types` | `/staff/lead-manager/ventures/document-types` |

Three pairs are genuinely the same screen rendered twice — the directory,
portfolio rollup, and reporting settings — so one address of each survives
(`D3`). The table above keeps the `venture-admin` address; if you prefer, the
directory can stay at `/staff/lead-manager/ventures/all` instead.

---

## 6. Member — what moves

Everything already conforms except the home:

| Current | Target |
|---|---|
| `/dashboard` (served by rewrite) | `/member/dashboard` |

`/member` (the chooser) stays. `/member/team` has no page of its own although the
team door points at it — that is a missing screen, not an address problem.

**Known deviation, accepted for now:** the learner context's screens live under
`participant` (learning, courses, lessons, assessments). Splitting them into
`/member/learner/…` would be more literal but touches four screens and every
learning link. Kept out of the first wave (`D7`).

---

## 7. Forms — what moves

The forms workspace becomes part of Communication, as you chose:

| Current | Target |
|---|---|
| `/platform` | `/admin/communication/forms` |
| `/platform/forms` | `/admin/communication/forms/list` |
| `/platform/collections` | `/admin/communication/forms/collections` |
| `/platform/modules` | `/admin/communication/forms/modules` |
| `/platform/responses` | `/admin/communication/forms/responses` |
| `/platform/runs` | `/admin/communication/forms/runs` |
| `/platform/runs/review/[submissionId]` | `/admin/communication/forms/runs/review/[submissionId]` |
| `/platform/runs/submit` | `/admin/communication/forms/runs/submit` |
| `/platform/runs/submit/[runId]` | `/admin/communication/forms/runs/submit/[runId]` |
| `/platform/runs/view/[token]` | `/admin/communication/forms/runs/view/[token]` |
| `/platform/settings` | `/admin/communication/forms/settings` |
| `/s/[runId]` (public runner) | unchanged |

The forms area currently carries its own outer frame; moving it under admin means
it must inherit the admin frame instead of drawing a second one — one shell per
space, as with every other move.

---

## 8. Detail behind `?tab=` — the heavy wave

Your rule 2 keeps detail out of the path. Two groups are affected.

**Admin venture hub — 27 screens become views of one address.** The hub already
mixes both conventions (some tabs are real routes, some are `?tab=`); this
finishes the job:

| Current suffix after `/admin/ventures/[id]` | Tab |
|---|---|
| `analytics`, `coaches`, `feedback`, `founders`, `fundraising`, `history`, `investment`, `investors`, `journey`, `knowledge`, `milestones`, `notes`, `permissions`, `sessions`, `tasks`, `timeline`, `verification`, `reports`, `document-types` | `?tab=` the same word |
| `documents` | `?tab=dataRoom` (same word as staff) |
| `dashboard` | the hub's default view |
| `edit` | `?tab=edit` (or fold into a settings view, `D8`) |
| `reporting`, `reporting/dashboard`, `reporting/quarterly` | `?tab=reporting`, `?view=dashboard`, `?period=quarterly` |
| `projects` | `?tab=projects` |
| `projects/emails` | `?tab=projects&view=emails` |

The venture's projects are top-level screens (`/admin/ventures/projects`), not
record views, so they keep their segments.

**Staff venture detail — 2 screens** (`document-types`, `emails`) become
`?tab=document-types` and `?tab=emails`, as above.

This wave is screen surgery, not renaming: each pane has to be rendered by the
hub screen before its address can go away. Keep the current detail addresses
working until the pane exists.

---

## 9. Compatibility and enforcement

- **Redirect table.** Every row above is added to the existing table, in order
  (most specific first), temporary until `docs/PRODUCTION_TEST.md` passes.
  Bookmarks, emails already sent, audit-log links and shared links keep working.
- **Public-address list.** The gate that runs before pages names a few addresses
  (e.g. the investor password setup). Those entries must learn the new addresses,
  otherwise a signed-out visitor is stopped before the redirect can happen.
- **One address builder.** Menus, cards, reminders and notifications ask it for a
  link instead of writing one; ~550 raw addresses are removed over the waves.
- **Two checks** keep it honest: every address the menu advertises resolves, and
  every screen has exactly one canonical address (its old ones redirect).

---

## 10. Waves

| Wave | Content | Screens | Stop condition |
|---|---|---|---|
| W0 | this contract, decisions settled | 0 | **done** |
| W0.5 | foundation: catalogue, builder, generated redirects, checks, split navigation | 0 | **done** — no address moved |
| W1 | staff venture workspace + member dashboard | 9 | build + production test |
| W2 | admin bare screens, `communication` rename, forms area | 37 | build + production test |
| W3 | admin record views → `?tab=` (the venture hub) | 27 | build + production test |
| W4 | redirects permanent | 0 | `docs/PRODUCTION_TEST.md` green |

Under the two-agent split (§12), W1 and W2 run in one stream and W3 in the
other: they do not block each other, because W3 only touches the venture hub and
its record views, while W1/W2 never touch them.

Every screen not listed above (~125 of the 200 role screens, plus the public
pages and the 499 API endpoints) is not touched.

---

## 11. Decisions I need from you

| # | Question | My proposal |
|---|---|---|
| `D1` | Is `lead-manager` the right name for the staff venture context, or should `ventures` stay a context of its own? | **settled: `lead-manager`** |
| `D2` | Confirm the staff venture workspace address | `/staff/lead-manager/ventures` |
| `D3` | Which of the duplicated pairs survives (directory, portfolio rollup, reporting settings)? | **settled: the `venture-admin` one** |
| `D4` | Should the one member dashboard move to `/member/dashboard`, with `/dashboard` redirecting? | yes |
| `D5` | Do `intelligence` and the owner's `profile` stay short contexts of admin, or fold into an existing one? | stay short |
| `D6` | `communications` (plural) → `communication` (singular, matching the permission section)? | rename |
| `D7` | Split learning into `/member/learner/…` now or later? | later |
| `D8` | Is `edit` a view (`?tab=edit`) or part of a settings view? | `?tab=edit` |

---

## 12. Parallel execution — two agents

The three surfaces that made a straight parallel start impossible — one
navigation tree, one redirect table, one set of frozen expectations — were
resolved by the foundation below. What remains is two streams whose write scopes
never overlap, meeting at exactly one point (B6).

```text
P0  foundation (serial) — DONE
     │
     ├── Agent A — Addresses  (W1 + W2)   46 addresses, 4 areas
     └── Agent B — Views      (W3)        27 admin + 2 staff views → tabs
                          │
                          └── W4 permanence (serial, after both)
```

### P0 — the foundation (done)

Nothing was renamed: every address still answers where it did, and no redirect
is emitted yet. What now exists:

1. **The catalogue** — `src/lib/routes/screens/`, split into four lists so the
two streams never edit the same file:

   | File | Rows | Owner |
   |---|---:|---|
   | `member.js` | 33 | Agent A |
   | `staff.js` | 49 | Agent A |
   | `admin.js` | 78 | Agent A |
   | `adminVentures.js` | 37 | Agent B |

   197 screens: the 3 duplicate addresses of D3 are attached to their canonical
   screen as `legacy`, not listed as screens. Each row carries
   `role / context / feature / path / tab? / query? / legacy[] / pending?`.
2. **The builder** — `src/lib/routes/index.js`: `path(id, params)`,
   `addressOf`, `toNextPattern`, `redirectsFor`, `screenRedirects`,
   `isPending`, `pendingScreens`. This is the only place an address is written.
3. **Generated redirects** — `screenRedirectsForNext()` is appended to the Next
   redirect table after the space aliases. It is **empty today** (all 73 moves
   are pending), so wiring it changed no behaviour.
4. **The split navigation tree** — `nav/admin.js`, `nav/staff.js`,
   `nav/member.js`, `nav/shared.js`; `nodes.js` composes them in the original
   order. Shared leaf nodes are defined once and referenced, never copied.
5. **The checks** — `src/__tests__/address-contract.test.js` (17 checks):
   unique ids, valid role/context, one canonical address per screen, no
   orphaned page, a pending move still serves its old address, a finished move
   has its target, generated redirects are correct and pending ones emit
   nothing, and every address a menu advertises is catalogued.

### The procedure for every move (both streams)

1. Move the folder so the row's `path` exists.
2. Point the links at `path(id, params)` instead of the literal.
3. Delete `pending: true` from the row.
4. `npm test -- address-contract` — it now requires the target page and emits
   the redirects for every `legacy` address.
5. Build, lint, and the production test.

Never write a redirect by hand: the list is generated from the catalogue, so one
catalogue row is the only edit a move needs on that side.

### Agent A — “Addresses” (W1 + W2)

Mission: change addresses and links only. Never change what a screen displays.

| Order | Work | Screens |
|---|---|---:|
| A1 | staff venture workspace → `/staff/lead-manager/ventures` (+ the 3 duplicate pairs → `venture-admin`) | 6 |
| A2 | member dashboard → `/member/dashboard`, `/dashboard` redirects | 1 |
| A3 | admin bare screens → their section (tasks, projects, reports, security, settings…) + `communications` → `communication` | 23 |
| A4 | forms area → `/admin/communication/forms/*`, and remove its own outer frame so it inherits the admin one | 14 |
| A5 | carry the staff venture sub-screens (`document-types`, `emails`) along in the rename, same shape, so nothing 404s before B converts them | 2 |
| A6 | redirect coverage for every retired address, verified address by address | — |

Write scope: `src/app/staff/**`, `src/app/member/**` (dashboard only),
`src/app/platform/**`, `src/components/shared/forms/**`,
`src/components/shared/platform/**`, the named admin screen folders, the admin /
staff / member nav modules, the member / staff / admin / forms redirect modules.

**Does not touch:** `/admin/ventures/**`, `src/spaces/admin/components/ventures/**`,
the shared venture panels, or any record view.

Acceptance per step: build, lint, both checks, targeted tests, and a click-through
of the affected menu entry.

### Agent B — “Views” (W3)

Mission: make the venture record views live behind `?tab=` — 27 in the admin hub,
2 in the staff hub. Never rename an unrelated address.

| Order | Work | Screens |
|---|---|---:|
| B1 | inventory the 27 admin views, their links and panels; fix the final tab set and bar | 27 |
| B2 | render each pane from the hub, keyed by `?tab=`, preserving tab visibility per role | 27 |
| B3 | retire the 27 addresses into its own redirect module → `?tab=` | 27 |
| B4 | update every internal link to a view (hub bar, dashboard cards, reminders that deep-link) | — |
| B5 | tests for the address → tab mapping | — |
| B6 | **after A merges:** the staff hub's two sub-screens become `?tab=document-types` and `?tab=emails` | 2 |

Write scope: `src/app/admin/ventures/[id]/**`, the venture hub screen,
`src/spaces/admin/components/ventures/**`, shared venture panels, its own redirect
module — and, in B6 only, `src/app/staff/lead-manager/ventures/[id]/**`.

**Does not touch:** member, forms, or any bare admin screen.

Acceptance: every retired view address lands on the right tab, build, lint, both
checks, production test.

### The interface between the two

Only through the catalogue: each stream edits its own screen file and removes
`pending` as it finishes a move. Redirects, navigation order and the checks are
derived, so neither can break the other's surface by forgetting a list.

| Surface | Owner while parallel |
|---|---|
| `screens/member.js`, `screens/staff.js`, `screens/admin.js` | A |
| `screens/adminVentures.js` | B |
| the builder and the generated redirects | neither (read-only for both) |
| admin, staff, member navigation modules | A |
| `/admin/ventures/**`, venture hub, shared venture panels | B |
| `/staff/lead-manager/ventures/**`, staff venture panels | A, then B in B6 |
| `/admin/communication/**` and `/admin/communication/forms/**` | A |
| `address-contract.test.js` | neither (it reads the catalogue) |
| venture hub tab tests | B |
| design kit, locale files, API, database | neither (no change expected) |

### Merge order

1. **P0** merges to the working branch first; both agents branch from it.
2. **A** and **B** run concurrently. B's admin work (B1–B5) can merge before or
   after A; **B6 merges only after A** (it edits files A has moved).
3. **W4** — redirects become permanent — runs after both, by one agent, only
   once `docs/PRODUCTION_TEST.md` is green.

A is broad and mechanical (46 addresses, many small edits); B is deep and
surgical (29 panes, one large hub screen). They are roughly balanced. The only
ordered pair is A5 → B6: B keeps the two staff sub-screens untouched until A's
rename has merged, then converts them. Everything else in B (the 27 admin views)
is independent of A.

### Risks introduced by parallelism

- **A node defined twice** in the split navigation tree — each screen keeps one
  definition; the split must move, not copy.
- **Two legacy rows for one address** — the catalogue check fails; the owning
  stream resolves it, never by deleting the other's row.
- **A link missed in the other stream's area** — the “every advertised address
  resolves” check catches it before merge.
- **Tests edited by both** — the per-area split in P0 is what prevents this; if a
  test genuinely spans both areas, it belongs to P0 and is data-driven.

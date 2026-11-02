# Venture Cockpit — Permission Tick-List

**Status:** draft for sign-off. Nothing is deleted or rewritten until every box in §8 is ticked.
**Date:** 2026-11-01
**Scope:** super admin + venture manager only.

**FROZEN — do not touch:** `/founder/**`, `/participant/ventures/**`, and the
`/founder/ventures → /participant/ventures` rewrites in `next.config.mjs`.
The founder's dashboard has been reviewed and approved as-is.

---

## 1. The one rule

> Permission decides **what appears**. It never decides **what the page is**.

The cockpit is a new *view* over decisions that already exist. It does not add,
remove, widen or narrow a single permission. Every gate stays where it is, on the
server.

**No API route changes. No service changes. No SQL changes. No model changes.**

---

## 2. The gate every venture route already uses

`requireVentureScopedAccess({ ventureId, module, capability })` in
`src/lib/ventureScopedAccess.js`:

```
super-admin bypass  →  CAPABILITY (module.capability, resolver)
                    →  SCOPE (venture_own = active membership OR active staff assignment)
                    →  ALLOW
```

Refusals are explicit: `401`, `403 capability-missing`, `403 out-of-scope`,
`404 not-found`. The UI must never be able to say something the gate would refuse —
`GET /api/ventures/[id]/my-access` reads the same verdict function.

---

## 3. Baseline census — captured BEFORE any change

```
node scripts/authz-venture-coverage.mjs

AUTHZ VENTURE COVERAGE — 97 route files
  NEW SYSTEM (scoped) : 67
  OLD GATE (legacy)   : 0
  NO VENTURE GATE     : 30   (SA-only / custom guard)
```

**Acceptance:** after the work this output must be *identical*. Any drift is a stop.

The 30 custom-guard files include the Data Room, notes, verification and
startup-profile routes. They keep their own guards; the cockpit does not touch them.

---

## 4. Server-side distinctions that must never move to the client

| # | Distinction | Where it lives | Who qualifies today | After |
|---|---|---|---|---|
| 1 | Internal audit stream + `'sa'` notification feed | `isInternalViewer` in `/api/ventures/[id]/dashboard` | `super_admin` only | unchanged |
| 2 | Staff instruments: analytics, feedback analytics, fundraising, investors/matching, investment readiness, review queue | `isStaffActorForVenture` | staff family only (founder gets 403) | unchanged |
| 3 | Document permission grants + status transitions | `PRIVILEGED = staff, program_manager, super_admin` + `isFounderForDocument*` | as coded | unchanged |
| 4 | Catalogue coach PATCH/DELETE | venture `edit` **and** global `ventures.edit` | global authority only | unchanged |
| 5 | Review queue narrowed to assignment scope | scope filter, cap 20 | wide reach keeps full queue | unchanged |
| 6 | Blocker resolution | creator-only unless staff family | as coded | unchanged |
| 7 | Venture list scoping | `/api/ventures` | global = all · delegated = assigned · others = membership | unchanged |

The cockpit displays the *result* of these. It never re-implements one.

---

## 5. Venture manager screen — surface by surface

Source today: `src/app/staff/ventures/[id]/page.js` (Overview + 9 tabs).

| Surface | Today | In the cockpit | Gate behind it | Lost? |
|---|---|---|---|---|
| Identity | flat header; **logo never passed** | identity band with logo, stage, ID, manager, coach, last activity | `GET /api/ventures/[id]` (view + scope) | nothing — logo bug fixed |
| Numbers | none | 4 KPIs | composed from payloads already fetched | new, nothing lost |
| "My role" card | responsibility codes, scope type/ref | one chip in the identity band | roles read | display only |
| Needs attention | card 2 of 6 | promoted to the top-left action queue | `GET .../submissions/review-queue` (staff actor + scope) | nothing |
| Approve / Request changes | in the queue | same two actions, inline | `POST .../tasks/[taskId]/submissions` `action=review` | nothing |
| Founders & members | list card | snapshot column | members read | nothing |
| About / description | card | moves to the Profile tab | read | still reachable |
| Milestones & tasks lists | unbounded, unstyled | one paginated roster table | existing reads | nothing — capped, not removed |
| "read-only panes" footnote | shown | removed | — | a note, not a feature |
| Journey tab | `JourneyManagerPanel` | unchanged | `ventures.edit` + scope | nothing |
| Projects tab (lead only) | `ProjectsWorkItemsView` + timeline + people + emails | unchanged | scope-derived (see §7a) | see §7a |
| Investment tab | read | unchanged | view + staff actor | nothing |
| Tasks tab | `VentureTasksPanel`, `PATCH .../tasks?id=` | unchanged | edit + scope | nothing |
| Sessions tab | `CoachSessionPanel` (`get_session`, `add_note`) | unchanged | edit + scope | nothing |
| Notes tab | `VentureNotesPanel` (`POST`/`DELETE .../notes`) | unchanged | custom guard | nothing |
| Data Room tab | `VentureDataRoom` + upload/grant/review/version | unchanged | custom guard | nothing |
| Profile tab (lead only) | `VentureProfileReadOnly` | unchanged | scope-derived (see §7a) | see §7a |
| Setup rail | none (a hint box today) | "next 3 steps", dismissible | display only | new |

---

## 6. Super admin screen — surface by surface

Source today: `VentureHubNav` + `VentureDashboard` + 8 tabs + Projects.

| Surface | Today | In the cockpit | Gate | Lost? |
|---|---|---|---|---|
| Hub nav (logo, stage, VNT, tabs) | full bar | becomes the identity band + tab bar | `GET /api/ventures/[id]` | nothing |
| Attention widget | own card | action queue, top-left | `GET .../journey-report` | nothing |
| Health tiles (4) | 4 coloured gradients | 4 KPIs | dashboard payload | nothing (duplicate team count removed) |
| Quick actions | 5 buttons, 2 go to the same place | one primary action + overflow | unchanged destinations | one duplicate button |
| Verification / data bank | full widget | admin band | custom guard | nothing |
| Team | widget | snapshot column | dashboard payload | nothing |
| Coaching & advisors | widget | snapshot column | dashboard payload | nothing |
| Meetings | widget | queue column | dashboard payload | nothing |
| Activity (internal feed) | widget | admin band | `isInternalViewer` — **super_admin only** | nothing; stays admin-only |
| Notifications | widget | header bell | as today | nothing |
| Reports · Journey · Investment · Data Room · Profile · Team · Activity · Projects | tabs | same tabs | unchanged | nothing |
| Verification · Permissions · Document types · Analytics · Fundraising · Investors · Feedback · History · Timeline · Coaches · Knowledge · Sessions | separate routes | same routes, reachable from the admin band | unchanged | nothing — every URL still resolves |

---

## 7. Two changes that are *not* losses — but need your sign-off

**7a. Projects and Profile tabs for the venture manager become scope-derived.**
Today `isLeadManager` checks only `responsibility_code === "venture_manager"` and
ignores `scope_type`. A **milestone-scoped** manager therefore sees Projects and
Profile even though the server refuses them roadmap restructuring (proven by
`src/__tests__/milestone-in-journey.test.js`).
After the change, the tabs follow capability **and** scope — matching the server.

- Venture-wide manager: no change.
- Milestone-scoped manager: loses two tabs they cannot actually use today.
- This is a tightening, not a grant.

**7b. The UI stops guessing.**
The page will read `GET /api/ventures/[id]/my-access` and show exactly what the gate
would allow — so what you see and what you may do can no longer disagree.

---

## 8. Tick-list for sign-off

**Founder (frozen)**
- [ ] No file under `src/app/founder/**` is modified
- [ ] No file under `src/app/participant/ventures/**` is modified
- [ ] No rewrite in `next.config.mjs` is modified

**Server (untouched)**
- [ ] No file under `src/app/api/**` is modified
- [ ] No file under `src/services/**` is modified
- [ ] No file under `src/models/**` is modified
- [ ] Coverage census identical to §3

**Venture manager, nothing lost**
- [ ] Every tab still reachable
- [ ] Approve / Request changes still available to the same people
- [ ] Journey, Tasks, Sessions, Notes, Data Room, Investment, Projects, Profile all still work
- [ ] Review queue still scope-filtered the same way
- [ ] Profile still read-only

**Super admin, nothing lost**
- [ ] Every admin route still reachable by URL
- [ ] Internal feed still super-admin only
- [ ] Verification, permissions, document types still reachable
- [ ] No admin capability moved to the client

**New surface**
- [ ] 4 KPIs link to the right filtered tab
- [ ] Action queue shows only actions the viewer may perform
- [ ] Admin band renders only for super admin
- [ ] Setup rail offers manager-owned actions only (no profile editing)

**Gates**
- [ ] `npm run lint` — 0 errors
- [ ] `npm run i18n:parity` — pass
- [ ] `npm run check:lines` — pass
- [ ] `npm test` — venture workspace suites green

---

## 9. Proof plan (how "nothing lost" is verified, not promised)

1. **Census diff** — `node scripts/authz-venture-coverage.mjs` before and after; output must match §3 exactly.
2. **Verdict diff** — `GET /api/ventures/[id]/my-access` recorded for three identities
   (super admin · venture-wide manager · milestone-scoped manager) before and after; must be identical.
3. **Strict audit snapshot** — `GET /api/engineering/permissions/venture-strict-audit`
   captured before and after; diff must be empty.
4. **Tick-list** — §8 completed, item by item, before any old screen is removed.

---

## 10. Deletion order

Old manager Overview markup and the re-homed admin widgets are removed **only after**
§8 and §9 pass, and in a **separate commit** from the one that adds the cockpit.
That keeps the revert trivial if anything is questioned.

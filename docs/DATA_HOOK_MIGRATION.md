# Data-hook migration — status and work remaining

This document tracks the migration of screens onto the shared data-reading
hook (`src/lib/hooks/useApi.js`). It exists so the screens that were **not**
converted, and the reason each one was left, stay visible in the repository
instead of living in a conversation.

Read `AGENTS.md` first for the layering rules; this document only covers the
reading pattern.

---

## 1. What is being changed, and why

Most screens were written with their own copy of the same loader:

```js
const [data, setData] = useState([]);
const [loading, setLoading] = useState(true);

const load = useCallback(async (bypassCache = false) => {
  if (!bypassCache) {
    const cached = cacheGet(url);           // hand-rolled cache-first paint
    if (cached !== null && cached.success) apply(cached);
  }
  const res = await fetch(url);             // hand-rolled stale handling
  const json = await res.json();
  if (json.success) cacheSet(url, json);
  apply(json);
}, []);

useEffect(() => { load(); }, [load]);       // ← the effect that sets state
```

`useApi` already owns all of that: the 30 s cache, the cache-first paint, the
discarding of a stale response, and the background refresh. A screen that reads
through it keeps **no data state of its own**, and therefore never sets state
from an effect — which is what the `react-hooks/set-state-in-effect` rule
reports.

The rule is correct, not a false positive: a screen that paints from its own
cache and then corrects itself in an effect really does render twice and can
briefly show content that disagrees with the data.

### The conversion recipe

```js
// Module scope on purpose: the hook keys its internal callback on the
// transformation, so an inline arrow would be a new identity every render and
// refetch in a loop.
const pickThings = (d) => (d?.success ? d.things || [] : []);

const { data: things, loading, refresh } = useApi(URL, {
  defaultValue: [],              // or null, or a module-level empty shape
  transform: pickThings,
  deps: [primitiveValue],        // only when the screen follows a filter/id/tab
});

// Actions that used to call load(true) now call refresh().
```

Two rules that are easy to get wrong:

- **The transformation must live at module scope.** An inline arrow changes
  identity every render, which changes the hook's internal callback, and a
  callback that changes every render starts a read on every render. It is not a
  runaway loop (the hook settles as soon as a read produces no state change), but
  it is one request per render of the screen, which is one per keystroke on a
  screen with a search box.
- **A screen must not keep its own copy of the data.** Converting the loader
  but resynchronising the result into local state reproduces the original
  pattern (and the rule's warning) exactly.

The default value is the one thing here that does **not** have to be stable.
`defaultValue: []` written inline is correct and is what most callers write; the
hook gates what it returns on the address during render instead of treating the
default as part of the read's identity. See section 3.8 for what that cost before
it was true.

### A read that fills in a form: a derived base plus the edits

A form whose starting values come from a read is **not** a reason to leave the
screen alone, and it does not need an effect either. The stored values are the
base, the person's changes are recorded against the field they touch, and what is
shown is the two merged:

```js
const [edits, setEdits] = useState({});
const answers = { ...(stored?.data || {}), ...edits };
// and on a change:  setEdits((prev) => ({ ...prev, [fieldId]: value }))
```

Nothing is copied, so no effect has to notice the values arriving - which is what
would erase something typed in the moment before they did.

Two shapes of the same idea are worth knowing, because they are the ones that
actually come up:

| Shape | When |
|---|---|
| An **explicit override** over a computed default | A value that is usually derived but that the person can choose - the week under review, which source is selected. Storing the *choice* rather than the result also stops a background refresh throwing the choice away. |
| An **edit recorded with the address it belongs to** | A value read for one address and edited for that address - a day's attendance sheet. Without the address, a mark made for one day shows on another. |

The test to apply **before** choosing this shape: **is the stored value ever
assigned back over the edits?** If it is - a discard-changes button, a reset, a
reload - the shape is wrong for that value and the read has to be separated from	he form instead.

For a screen that reads several endpoints whose URLs contain a runtime value
(an id, a filter), prefer **one `useApi` call per endpoint** with the value as
a plain dependency. `useApiMulti` needs an array whose identity is stable, so
a parameterised list would have to be memoised; separate calls make the
parameter a string comparison and cannot loop.

### Reading the signed-in identity

A screen that needs to know *who* is signed in before it can ask for anything
should consume `src/lib/hooks/useSessionUser.js`:

```js
const { cid, role } = useSessionUser();
const { data, loading: readLoading } = useApi(
  cid ? `/api/tasks?user_id=${cid}` : null,
  { defaultValue: [], transform: pickTasks, deps: [cid] },
);
// The identity is absent for the first moment of a cold load, so the screen must
// keep its placeholder rather than claim there is nothing to show.
const loading = !cid || readLoading;
```

It reads the shell's session cache through `useSyncExternalStore`, so it adds no
request: the shell has already fetched the session, and this only observes it.
Do **not** re-read the browser's stored copy of the user, and do not fetch the
session endpoint again — both were the problem this replaced.

### Accepted behaviour changes

These apply to every converted screen. They are deliberate, not incidents:

| Change | Detail |
|---|---|
| Failures are cached too | The hand-rolled loaders cached only `success` payloads. The hook caches every response, so a failure is repainted from cache for the remainder of its 30 s life before the network converges. |
| Shared copies | Screens that used the cache and screens that did not now share the same short-lived copy for the same URL. |
| A failed read shows the empty state | Where a loader left the previous list untouched on a failed *refresh*, the screen now shows the empty state. First-load failures already behaved this way. |

Anything beyond these three was called out individually in the commit message
for that screen.

---

## 2. Progress

| Measure | Start | Now |
|---|---:|---:|
| ESLint warnings, total | 2192 | 119 |
| `react-hooks/set-state-in-effect` | 200 | 114 |
| ESLint errors | 0 | 0 |
| `no-unused-vars` | 2 | 0 |
| Production build | passes | passes |

Screens carrying a `set-state-in-effect` warning: **77**.

| Group | Screens |
|---|---:|
| Application pages | 18 |
| Shared components (`src/components/`) | 32 |
| Venture screens | 23 |
| `src/lib/` modules | 4 |

Of these 77 screens, **58 carry a single warning**; the remaining 19 carry two
to five.

> The test count is not recorded here any more: another workstream adds and
> renames suites in this same working tree, so any figure went stale within the
> hour. What matters is that the suite is green when a lot is committed.

> The hook itself accounts for 4 of the remaining warnings (`src/lib/hooks/useApi.js`):
> two "state written in an effect" and two "a spread in the dependency array". They
> are left deliberately - see section 3.7.

> Note: the repository currently reports 2 `no-unused-vars`, both in
> `src/__tests__/program-assignment-grants.test.js`. They were introduced by a
> different workstream and are unrelated to this migration.

---

## 3. Deliberately deferred — with the reason and the next step

These are **not** abandoned. Each was examined and left for a stated reason.
The next step column is what a follow-up pass has to do.

### 3.1 The screen needs a capability the hook does not expose

**Solved.** The hook now reports the HTTP status of the last response, as
`status`, so a screen can tell the three failures apart:

```js
const { data, loading, error, status } = useApi(url, { ... });
// 401                the session expired
// other >= 400       the server refused
// null, with `error` the request never got an answer
```

It is null before the first answer, after a request that threw, and again the
moment the address changes - a screen that moves to another address must not keep
reading the previous one's verdict. That last property is why the hook holds the
status together with the address it came from and compares them **during render**:
an effect that reset it would be state written from an effect, which is the
pattern this whole migration exists to remove.

Adding it changed nothing for existing callers: a field was added to the returned
object, and `error` still means exactly what it meant before.

Converted onto it:

| Screen | What the status bought it |
|---|---|
| `src/app/admin/finance/page.js` | "your session expired" is shown instead of "the server failed", which is the whole point of the distinction. Its three reads are now three `useApi` calls, its chosen source is derived rather than stored, and its dependency-array warning is gone with the effect. |
| `src/app/admin/integrations/page.js` | Four endpoints through `useApiMulti`. |
| `src/app/admin/crm/duplicates/page.js` | The read failure is now a panel with a retry rather than a four-second message, and the "no duplicates" panel is no longer shown when the read failed - telling someone there are no duplicates when the page never managed to look is a statement the page cannot support. |

Accepted behaviour change, on the duplicates screen only: a failed load used to
raise a transient message; it now raises a panel that stays until a retry
succeeds. On the finance dashboard a refused refresh now empties the cards
instead of leaving the previous figures under a failure banner - the shared
consequence of converting to the hook, already listed in section 1.

### 3.2 The screen asks one request per element (an existing N+1)

| Screen | Why it is deferred | Next step |
|---|---|---|
| `src/app/admin/reports/responses/page.js` | After loading the program list it issues **one request per program** to resolve KPI names, in a loop, and stores the merged result. | This is a performance matter (a batch endpoint, or a single query that already returns the names). Parked with the database work; converting the loop into a hook is not possible anyway (hooks cannot be called in a loop). |
| `src/app/platform/responses/page.js` | Loads the run list, then the detail of **every active run**, and merges them. | Same as row 1. |

### 3.3 The loader has side effects beyond storing the result

| Screen | Why it is deferred | Next step |
|---|---|---|
| `src/app/s/[runId]/page.js` | The loader also switches the interface language and builds a machine-translated payload; a second effect keeps a local draft of the answers. | Separate the read from the translation side effect first (translate after the payload arrives, or on demand), then convert the read. |

### 3.4 The value is initialised from a source that is not the network

The signed-in identity used to be in this group: five screens re-read it from the
browser's stored copy, because that is the only place it is available
synchronously, and a browser store cannot be read during the render that the
server also produces.

**That has been solved.** The shell already fetches the session and publishes it
through the shared shell cache (`src/lib/dashboardSession.js`), which now notifies
its subscribers, and `src/lib/hooks/useSessionUser.js` reads it with
`useSyncExternalStore`. Consuming the identity therefore costs **no request**, and
the server snapshot is deliberately null — React also uses it for the hydration
render, so the first client render matches what the server sent and the identity
simply arrives a moment later. A screen consuming it must treat an absent
identity as *not known yet* and keep its placeholder, not as *empty*.

Moved onto it: the developer's own tasks, the developer's assigned tasks, the
admin blockers console (whose request addresses are now a plain result of the
identity), the staff stand-up screen, the **staff dashboard** and the **programme
manager's promote screen**.

The staff dashboard needed a decision, and it is worth recording: it keyed its
reads on the identifier the browser had stored, which is the person's RECORD id,
while the task endpoint authenticates against the SESSION identifier and refuses
any other with 403. A staff member who was not a super admin was therefore being
refused rather than drawn - the screen showed nothing to do. Reading the identity
from the session fixes the address as well as the effect.

| Screen | Source | Note |
|---|---|---|
| `src/app/platform/modules/page.js`, `src/app/platform/settings/page.js` | The registered-modules registry, read synchronously | Not a network read at all. |
| `src/app/developer/retro/page.js` | The current week | Computing it during render would mismatch between the server's clock and the browser's. |
| `src/app/investor/profile/page.js` | Server data used to **initialise an editable form** | The effect is the standard way; removing it means restructuring the form (e.g. a keyed child component). |
| `src/app/activate/page.js` | The token and mode, read from the browser's address bar | Same shape as the registration link that was converted; converting needs the navigation-parameter route plus a derived token state. Doable, do it deliberately: this is a sign-in screen. |

### 3.5 The screen would show a message that is not true

None left. The two that were here are resolved:

- the facilitator dashboard now gives its program read a transformation that
  reports `null` on failure, so "no programs assigned yet" is only shown when the
  list is actually present and empty;
- the announcements screen was converted with the spinner on a filter change
  accepted, stated in its commit message.

### 3.6 Structural or large

| Screen | Why it is deferred |
|---|---|
| Screens over ~800 lines (`admin/programs`, `admin/projects`, `admin/projects/[id]`, `admin/communications/contacts`, `staff/op-report`, `staff/projects/[id]`, `pm/programs/[id]`, `admin/op-reports`) | Not examined individually yet. Several load more than one endpoint and some mix loads with mutations, so each needs a read before conversion. |

A group here is **parked with the database work** on purpose: two screens ask for one
record per element of a list they just read.

| Screen | What it asks for |
|---|---|
| `src/app/admin/reports/responses/page.js` | The reports feed, then **one KPI request per programme** in a serial loop, only to build a lookup of KPI names (`{id, title}`). The names live in `v2_kpis` next to the programme, so one query can return all of them. |
| `src/app/platform/responses/page.js` | The run list, then **the detail of every active run**, one after another. |

The cost is `2 + N` requests in sequence, and the screen stays on its spinner until
the last one answers - so the wait grows with the number of programmes or runs,
not with the amount of data shown.

**A conversion does not touch this.** A hook cannot be called in a loop: the number
of reads has to be fixed at the top of a component, not decided by the data it
just read. And even if it could be, `N` requests would still be `N` requests. What
removes the loop is a server answer that already carries what the loop was
collecting - a batch parameter (`?program_ids=a,b,c`), or, better, the join the
endpoint could do itself, since the reports feed already knows which KPI each
report is about and the names sit in the same table as the programme. Those are
new or changed endpoints, which is why this waits with the database work.

Converted out of this list:

- the **programme manager's submissions console** — its reads were keyed on the
  browser's stored identifier, which is the person's RECORD id where the endpoint
  authenticates against the SESSION id, so a programme manager could see a
  silently short list. And the schedule dialog's event fields are filled where the
  dialog is opened rather than by an effect watching it, which is what it was: an
  event, not a consequence to be synchronised.
- the **programme workspace** (administrator) — four reads through the hook, and
  the public registration link resolved from the programme's own runs, with the
  address built inside the read because it is made of the browser's own origin and
  a render also happens on the server, where no origin exists.
- the **work board** — its three reads through the multi-endpoint form, and the
  role that decides whether a card may be dragged coming from the session cache
  instead of the browser's stored copy. A dragged card still moves at once and a
  refused move re-reads, now through the same read's own setter.
- the **task console** — four reads, one of them addressed on the task that is
  open and not addressed at all when none is. The assignment control turned out to
  be display-only: choosing someone else writes to the server and updates the open
  task, and never wrote the value it displays, so the value is a consequence of the
  open task rather than state that had to be kept in step.
- the **staff project screen** — three reads and the identity from the session
  cache, which also removed a flag whose value was never read.
- the **project list** — two reads, the staff list read only while the create dialog
  is open (which the old code expressed by fetching it from the button that opened
  it), the role from the session cache, and a dead totals holder dropped. Its
  create dialog opens because the ADDRESS asks for it rather than because an effect
  copied the address into state, and closing it tidies the address - a navigation,
  not a state write.

  One accepted difference there, in the address rather than the screen: arriving
  from the sidebar's "Create Project" link and then refreshing keeps the dialog
  open, where the old code stripped the parameter on arrival so a refresh did not
  reopen it. The address now describes what is on screen, which is what makes the
  dialog possible to reason about at all.

Screens whose read fills in a form the person then edits. They DO convert, and
the shape is the same in all three: the stored answers are a derived base and an
edit is recorded against the one field it changes, so the answer for a field is
the edit if there is one and the stored value otherwise. Nothing is copied into
state, so there is no effect and nothing to resynchronise. Section 1 has the two
variations this takes when the value is a choice or belongs to an address.

The test to apply first: **is the stored value ever assigned back over the
edits?** If it is - a discard-changes button, a reset - the base-and-edits shape
is wrong and the read has to be separated from the form instead (a child that
owns the form and is keyed on the record, so a different record remounts it). In
the three below, every write is already a per-field merge, so there is nothing to
separate.

| Screen | Still open, and why |
|---|---|
| `src/app/platform/runs/review/[submissionId]/page.js` | See 3.9: its read also writes, and the write needs a decision. |
| `src/app/investor/profile/page.js` | Reads the server's values into a profile form. Needs the test in section 1 applied before it is touched. |
| `src/app/s/[runId]/page.js` | Public form. Its loader also switches the interface language, and a second effect keeps a local draft, so the read has to be separated from those two first. |

Converted:

- the **platform submission screen** — the stored answers are the base and a
  collapsed section is recorded as a collapse, so a section that arrives later is
  open rather than shut until an effect opens it.
- the **facilitator's programme workspace** — five reads, an attendance sheet
  whose marks are recorded with the day they were made on, and the week under
  review recorded as a choice. That last one changes a visible behaviour: the
  computed week used to be reassigned on every load, so a background refresh threw
  away the week the person had picked.

Converted out of this list:

- the **programme manager's registry** — its reads were keyed on the browser's
  stored identifier, which is the person's RECORD id where both endpoints
  authenticate against the SESSION id. Same repair as the staff dashboard: a
  programme manager may now see programmes that were previously missing.
- the **knowledge bank** — its second effect copied one note's first document
  into state, so the viewer lagged one render behind the note that was open. The
  value is now derived, and the effect is gone.
- the **platform form list** and the **investor campaign list** — two and two
  reads through the hook.
- the **person detail screen** — five reads, all of them display-only.
- the **investor relations console** — its two reads through the hook, and the
  role it asked the session endpoint for now comes from the shell's session
  cache. Its detail and document reads stay imperative because they are opened by
  a click rather than by arriving on the page.
- the **access console** — its people list and module catalogue through the hook,
  plus two derived values that were state: the filtered list (which could
disagree with the query that made it) and the page number (which was reset in an
  effect, so the list was drawn for one frame under the previous query's page).
- the **team workspace** — a chain rather than a set: the team names the
  programme, and the programme names three reads below it. Each address is
  derived from the value above it, so an unknown value is simply an address that
  is not known yet. Its task list is read only while its tab is open, which the
  effect used to express by deciding whether to call its loader.

The two consoles that stood here are converted:

- the **admin system console** read nine endpoints, two of them the same job
  statistics feeds two separate figures — so it now makes eight reads, one
  fewer request on every load. Its health-check action re-reads two of them and
  its report action re-reads one, writing through those reads' own setters. It
  is the one screen whose loader really could throw (the others caught their own
  failures), so its failure banner is kept, but it is only shown when the main
  payload is absent, so a failed refresh cannot replace a console already on
  screen.
- the **admin security console** read seven endpoints, four of which composed
  one summary. The summary is now derived from them and stays absent until all
  four have answered, which is what the old loader did by applying only when
  every response succeeded. Its failure banner was unreachable — each of the
  four loaders swallowed its own error, so the promise combining them could
  never reject — and was removed rather than carried forward.

Resolved from this list:

- the **admin metrics dashboard** — a single self-contained read; the note that
  put it here was over-cautious;
- the **notifications screen** — the value it stores for preferences really is the
  whole stored row, so its two local edits were already consistent and were
  preserved as they were;
- the **invitation link** — converted by splitting the link failure from the
  form's own submission failure, which is what this list asked for first.

### 3.7 The hook's own four warnings

`src/lib/hooks/useApi.js` is itself reported twice for "state written in an
effect" (it starts a read by setting `loading` and clearing `error`) and twice
for "a spread in the dependency array" (its `deps` option is spread, so the rule
cannot verify the caller's list).

Both are left on purpose, and not out of convenience:

- the "state in an effect" reports are the hook *being* the removal target. The
  conversion it performs is precisely "stop writing state from an effect", and it
  cannot perform it on itself. Deferring the writes by a tick would silence the
  rule while changing when the spinner appears and when a previous error clears,
  for no functional gain.
- the spread is the feature: the caller owns part of the dependency list. The
  alternative is asking every caller to pass a memoised array, which trades a
  warning for a foot-gun - an array rebuilt each render refetches forever.

The counts for this file therefore do not go down as the migration proceeds, and
should not be read as an unconverted screen.

### 3.8 What the hook's own reads cost, and the defect that was found there

Teaching the hook to report the status introduced a request flood, and it is
recorded here because the way it hid is the point.

`status` is state, so every response wrote it - as a fresh object, which is always
a change. A change re-renders. And the read was keyed on `defaultValue`, which
callers write inline (`defaultValue: []`), so that identity changed on every
render too. Each render therefore started another read, and each read re-rendered.
Measured on a single screen with a counter on `fetch`: **26 requests where there
should have been 1**, and the screen looked perfectly correct throughout.

Two fixes, both of them the honest one rather than a suppression:

1. republishing a verdict that has not changed is not a change, so `status` is
   only written when the address or the status actually differs;
2. the default no longer takes part in deciding **whether** to read. What the
   hook returns is gated on the address during render - no address means nothing
   to read, nothing loading, no failure, and the caller's default to show. The
   default decides what is displayed, never whether to go and look.

The second one is the one that matters beyond this incident: it makes
`defaultValue: []`, the natural thing for a caller to write, safe.

`src/__tests__/use-api-hook.test.js` counts the requests in both cases, so the
flood cannot come back unnoticed.

### 3.9 The screen whose read also writes

`src/app/platform/runs/review/[submissionId]/page.js` reads a submission, and when
the read finds **no stored evaluation** - and only for someone holding the
`runs.review` capability - it fires a POST that triggers one. The comment already
in the code says why that matters: an evaluation **can auto-approve the applicant
and email them**.

That single step is what keeps the screen's warning, and no reorganisation of the
screen removes it:

- the trigger cannot be a derived value, because it is not a value;
- an effect that performs it still writes state (the evaluation it receives), so
the warning moves rather than goes;
- it cannot be keyed on something the read returns, because what it watches for is
  the read's ABSENCE of a result.

What has to be decided is therefore a product question, not a technical one:

| Option | Consequence |
|---|---|
| **A button.** The read stops at "not evaluated yet" and offers the action, like every other capability-gated action on the platform. | One extra click for a reviewer. The warning goes. |
| **Leave the trigger automatic.** | Nothing changes for anyone; the screen keeps its one warning, recorded here as deliberate. |
| Move the trigger into the endpoint the read already calls. | Not advised: that makes a GET approve applicants and send mail, and anything that fetches URLs - a prefetch, a crawler, a retry - would do it. |

Recommendation: the button. Firing an approval the applicant is told about as a
side effect of opening a page is the kind of thing a capability gate exists to make
deliberate, and the gate is already there to be used. But it changes what a
reviewer does, so it is the owner's call and the screen waits until it is made.

### 3.10 The screen whose source of truth is the address bar

`src/app/staff/op-report/page.js` is 4000 lines and reports four warnings, but they
come from one arrangement rather than four mistakes: the tab and the week live in
the query string, and the screen **mirrors** the query string into state on every
change so that browser back/forward and the sidebar's links work.

That means an effect reads the address and writes two pieces of state, and every
other warning on the screen is a consequence of that state existing:

- the six reads are keyed on the mirrored state rather than on the address;
- the standup draft is checked when the modal opens, through a timer whose comment
  says it exists "to let the week settle" - a state that has to settle is a state
  that is being kept in step rather than computed;
- the identity is fetched by the screen itself, with a redirect to sign-in on
  failure.

Converting it properly is not a conversion but a change of model: the tab and the
week become values **computed from the address**, the controls that change them
push to the address, the reads key on the address, the draft check becomes a
consequence of opening the dialog, and the identity comes from the session cache
with the shell owning the redirect. That is a deliberate piece of work on a large
screen, and a wrong turn in it locks people out of the week they are reporting on,
so it wants doing on its own and with the screen in front of you.

---

## 4. Not started

- **23 venture screens** (`src/app/admin/ventures/**`, `src/app/participant/ventures/**`).
  Deliberately postponed at the owner's request; they share a uniform shape
  (a venture plus one sub-resource) and the recipe above applies directly.
- **32 shared components** (`src/components/**`). These are rendered by several
  roles at once, so a mistake reaches several audiences — they are handled last,
  one at a time, never in bulk.
- **4 `src/lib/` modules.**

---

## 5. How to verify a conversion

Automated checks catch mistakes of shape, not of behaviour:

```bash
npx eslint .                 # 0 errors; the target rule must decrease by one per screen
npm test                     # full suite
npm run build                # catches things lint cannot, e.g. a missing loading boundary
```

`src/__tests__/use-api-hook.test.js` covers the hook's own contract - the status of
a success, of a 401, of a 500, of a request that never answered, and its clearing
when the address changes; and the number of requests it makes, which is where a
mistake here is invisible on screen. A change to the hook cannot take either away
from the screens that now depend on it.

> **Concurrency note:** another workstream builds in this same working tree.
> Two `next build` runs at once corrupt each other's output (a build manifest
> disappears) and the second one reports "Another next build process is already
> running". If a build fails with `ENOENT ... _buildManifest.js.tmp`, check for
> a running build before suspecting the code.

Behaviour itself can only be checked on screen. For each converted screen,
look at: **the first paint**, **the return from another page**, and **the empty
state**. Screens reached without signing in (public forms, registration links,
sign-in) deserve the most attention, because a mistake there blocks people
rather than inconveniencing them.

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

One rule that is easy to get wrong, and one that used to be:

- **A screen must not keep its own copy of the data.** Converting the loader
  but resynchronising the result into local state reproduces the original
  pattern (and the rule's warning) exactly.
- **Build the transformation once, at module scope** - a habit rather than a
  requirement. Neither the transformation nor the default value is part of what
  the hook reads, so neither can put a request on the wire any more: the read is
  keyed on the ADDRESS, both of those are mirrored, and the address is the only
  thing that decides whether to go and look. Building them once is still what
  makes a screen easiest to read, and a factory called inside a component
  (`pickList("tasks")` rather than at the top of the file) is the shape that
  looks correct and is not.

See section 3.8 for what the two of them cost before the hook was repaired.

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
| ESLint warnings, total | 2192 | 5 |
| `react-hooks/set-state-in-effect` | 200 | 2 |
| ESLint errors | 0 | 0 |
| `no-unused-vars` | 2 | 0 |
| Production build | passes | passes |

**NO SCREEN CARRIES THIS WARNING ANY MORE.** The two that remain are inside the
reading hook itself, and they are the ones §3.7 records as deliberate: the hook is
what PERFORMS the conversion - "stop writing state from an effect" - and it cannot
perform it on itself. Its two `exhaustive-deps` are deliberate for the same reason
(the caller owns part of its dependency list).

The remaining five, in full:

| File | Rule | Why it is not a screen to convert |
|---|---|---|
| `src/lib/hooks/useApi.js` | `set-state-in-effect` ×2 | §3.7 - the hook is the removal target and cannot remove this from itself. |
| `src/lib/hooks/useApi.js` | `exhaustive-deps` ×2 | §3.7 - the spread IS the feature: the caller owns part of the list. |
| `src/__tests__/result-pdf-layout.test.js` | `no-unused-vars` | Not this migration's: a test file added by the other workstream (one unused constant). |

The two that stood in this table as "not a conversion" - the scores
memoisation note and the operational report's image - are both gone. §3.12
records what each one actually needed.

### What is left, and under which reason

**Nothing is left at all.** Every screen has been converted, and the sections below
record what each family needed. The two screens this section named last - the
sign-in link and the public form - are done, and each one's own note says what it
took:

| Screen | What it took |
|---|---|
| `src/app/activate/page.js` | The token and the mode ARE the address, so they are read during render and the link check became a read addressed on the token. A Suspense boundary was needed because the address is read with `useSearchParams` on a statically rendered page; its fallback is the same spinner the screen already showed. The three-way verdict is preserved, including that an EXPIRED link keeps its own wording and a request that never answered is invalid. |
| `src/app/s/[runId]/page.js` | Four separations, one per reason the loader had: the read is a hook read; the SAVED DRAFT rides with the read's answer instead of a second effect; the TRANSLATION is an override keyed on the language it was made for, so the raw payload stays what everything is restored from; and the interface language still follows the form's own, which is a STORE write rather than a state write. |

The reasons that were once reasons, and are not any more: the screens that needed
a capability the hook did not expose (§3.1); the ones that asked for one record per
element (§3.2); the one whose read also wrote (§3.9); the standup screen's address
mirror and its form read (§3.10); the venture group (§4.1); the screen that
republished its state from its writes (§4.1); the whole shared-component group,
shell included (§4.0); the four biggest console pages, the last large screen, the
runs console and the programme manager's workspace (§3.6); the screens whose value
was never from the network, and the investor profile's editable form (§3.4); the
three providers (§4.4); the two section guards (§3.11); and the last two - the
sign-in link (§3.4) and the public form (§3.3). Their sections record what each one
needed.

> The test count is not recorded here any more: another workstream adds and
> renames suites in this same working tree, so any figure went stale within the
> hour. What matters is that the suite is green when a lot is committed.

> The hook itself accounts for 4 of the remaining warnings (`src/lib/hooks/useApi.js`):
> two "state written in an effect" and two "a spread in the dependency array". They
> are left deliberately - see section 3.7.

> Note: the repository currently reports one `no-unused-vars`, in
> `src/__tests__/result-pdf-layout.test.js` (a single unused constant). It was
> introduced by a different workstream and is unrelated to this migration.

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

### 3.2 The screen asks one request per element — CONVERTED

These two were the screens that asked for one record per element of a list they
had just read. Both now ask once, and the answer carries what the loop was
collecting:

| Screen | What it asks for now |
|---|---|
| `src/app/admin/reports/responses/page.js` | The reports feed, which now carries the names of the KPIs its rows cite. The screen used to ask the KPI endpoint once per programme on the page - and that endpoint RECALCULATES when it holds no cached progress, so opening the screen could write once per programme. One query for every programme in the answer, and a read that recalculates nothing. |
| `src/app/platform/responses/page.js` | One answer with every submission of every open run, instead of the FULL detail of each open run in sequence - each detail carrying assignments, reviews, evaluations, email logs, activation logs and the form's fields. |

Both answers keep their per-item forms: asking for one programme's KPIs, or one
run's detail, still returns exactly that. This added a way to ask for many.

### 3.3 The loader has side effects beyond storing the result - CONVERTED

| Screen | What it needed |
|---|---|
| `src/app/s/[runId]/page.js` | FOUR separations, one per reason the loader had. The read is a hook read. The SAVED DRAFT rides with the read's answer instead of a second effect - it is a fact about the browser, and the request's own answer is the only moment the browser is the one asking. The TRANSLATION is an OVERRIDE keyed on the language it was made for, so the raw payload stays the thing everything is restored from (which is what the four refs held) and a language switch needs no clearing. And the interface language still follows the form's own when the visitor has not chosen one - which is a STORE write, not a state write, so it needs only a small effect whose job that is. |

### 3.4 The value is initialised from a source that is not the network - DONE

All five are converted, and the shape they turned out to share is worth naming:
NONE of them needed the value to be fetched or moved - only for the thing that was
in the way to be recognised as something that can be read during render. Four times
out of five that thing was the IDENTITY, which was already a store.

| Screen | What it actually needed |
|---|---|
| `src/app/platform/modules/page.js` | The registry is a PURE function of the role, so it is computed during render. The only browser dependency was the role, which is already a subscribed value. The registry fails CLOSED on an unknown role, so the first paint - before the session has arrived - shows nothing rather than every module. |
| `src/app/platform/settings/page.js` | Same registry, and a service list that is pure too. Both are simply constants of the module, so both are computed during render. |
| `src/app/developer/retro/page.js` | The current week is a fact about the CLOCK, so it is taken once through the LAZY INITIALISER the operations view already uses. It is never rendered - only sent with the submission - so the server's render and the browser's first render do not have to agree on it. |
| `src/app/investor/profile/page.js` | The read fills ELEVEN values across TWO forms, one per tab. A keyed child per form would have unmounted the other tab's form on every switch, losing typing that survives today - so the restructure the document named would have REMOVED behaviour. One bag of edits over a base computed from the record keeps both tabs' typing in one place exactly as the eleven separate states did, and a background re-read can no longer wipe what someone is typing. |
| `src/app/activate/page.js` | The token and the mode ARE the address, so they are read during render and the link check became a read addressed on the token. Reading the address with `useSearchParams` needs a Suspense boundary on a statically rendered page; its fallback is the same spinner the screen already showed while the link was being checked. The three-way verdict is preserved exactly - including that an EXPIRED link keeps its own wording, and that a request that never answered counts as invalid. **It is a SIGN-IN screen**, so it is on the walk list below. |

The lesson, for the last screen: "the value comes from somewhere that is not the
network" is not by itself a reason to defer. It is a reason to ask WHICH part of it
is not readable during render - and four times out of five, that part was only the
identity, which was already a store.

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

The screens that have not been read one by one yet. All are over 800 lines and
several read more than one address and mix reads with mutations, so each needs a
reading before it is converted rather than a recipe.

| Screen | Warning | Note |
|---|---:|---|
| `src/app/admin/programs/page.js` | 5 | The programme list; several reads and the archive actions. |
| `src/app/admin/projects/[id]/page.js` | 5 | One project plus its sub-resources. |
| `src/app/admin/op-reports/page.js` | 4 | The operational reports console. |
| `src/app/admin/communications/contacts/page.js` | 4 | Messaging console; overlaps the shared messaging component. |
| `src/app/pm/programs/[id]/page.js` | 3 | Nearly 7000 lines; the programme manager's workspace. |
| `src/app/platform/runs/page.js` | 2 | The runs console. **Another workstream was editing this one at the time of writing** — check with them before touching it. |

Of the eight originally here, `staff/projects/[id]` and `staff/op-report` are
converted (the second is under §3.10, with one read group left), and `platform/forms`
and `admin/reports/responses` are converted elsewhere in this document.

A group that used to sit here — the two screens that asked for one record per
element — is converted; see §3.2.

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
  form's own submission failure, which is what this list asked for first;
- the **four biggest console pages** — the programmes console, the project
  workspace, the operations report console and the contacts grid. All four carried
  one shape: the page number, the chosen segment and the chosen sub-team were HELD
  as state and corrected by an effect after the fact. Each is now recorded against
  the filter combination it belongs to and read during render, which is the repair
  the access console already used. The project workspace also gave up a helper
  that was DEAD - kept, by its own comment, only so the compiler's rules would
  treat one read a certain way;
- the **portable runs console** — its run list follows the filter and the page
  while the five reference lists beside it do not, so the filter and the page went
  into the run read's ADDRESS and the rest stayed as they were. Its respondent
  table carried the reset-after-the-fact shape three times (page, selection,
  duplicates panel), and the selection is now safer than it was: a selection from
  an earlier filter combination is unreachable rather than merely invisible, where
  the old effect cleared it one render late;
- the **programme manager's workspace** — its registration-form link is a read
  whose address says which question is being asked, its reviews list is a read, and
  its identity comes from the session cache, which also removes a second call to
  the session endpoint.

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

The **same mistake was then found in the transformation**, which is a factory in
most conversions - `pickList("tasks")` written at the call site rather than at the
top of the file, inside a component, is a new function on every render. Ten reads
across three consoles were re-issuing a request per round trip, each re-running
its SQL, for as long as the screen stayed open; the stale-response guard could not
absorb it because the guard discards a late ANSWER and cannot un-send a request.
The hook now mirrors the transformation and applies the current one at fetch time,
so the read is keyed on the address - the same repair as the default, for the same
reason.

Both repairs are in the hook rather than at the call sites on purpose: the two
mistakes have one shape, and a rule that has to be remembered at every call site is
a rule that will be forgotten at one of them.

`src/__tests__/use-api-hook.test.js` counts the requests in both cases, so the
flood cannot come back unnoticed.

### 3.9 The screen whose read also writes — RESOLVED

`src/app/platform/runs/review/[submissionId]/page.js` used to fire an evaluation
as a side effect of being opened. **Another workstream removed that** before this
account was written, and their reasoning is the one worth keeping: it ran on EVERY
load, so a view spent a model call and appended a fresh evaluation row - and
because a fresh row carries no human values, it also hid whatever a reviewer had
entered. The action moved to a button in the header, labelled for what it does
("Run AI evaluation" when there is none, "Re-run AI" when there is), offered only
to someone who holds the capability.

The screen was then converted like any other: four reads through the hook, the
reviewer's scores recorded against the dimension they change and the evaluation
they were given in, and - since the action is now deliberate - the absence of an
evaluation said out loud, with the button that resolves it. Two keys added in both
languages.

The automated check that guards the rule (a page load is a read) still holds, and
is now stated against the new shape: no read is keyed on the reviewer's
permissions, so a permission arriving late cannot re-issue them.

The reason this one mattered, kept because it is the durable lesson: a read must
not have consequences. Firing it automatically was considered defensible as a
convenience, and it is not - it spent a model call on every view and it could
approve a person and write to them because somebody looked. The third option, moving
the trigger into the endpoint the read already calls, was rejected for the same
reason at one remove: anything that fetches a URL - a prefetch, an indexing robot,
a retry - would then approve applicants, which is not a thing a request should be
able to do.

### 3.10 The screen whose source of truth is the address bar - DONE

`src/app/staff/op-report/page.js` is 4000 lines and reported four warnings from
ONE arrangement rather than four mistakes: the tab and the week were state, an
effect read them out of the query string and a second wrote them back into it. A
two-way mirror - and every read on the screen was keyed on the mirror rather than
on the address.

Done: the tab and the week are computed from the address and the controls ask for
another one by changing it; the identity comes from the session cache instead of
the screen asking the session endpoint and falling back to the browser's copy (and
its own redirect to sign-in went with it - the request gate already does that for
every page behind a session); the stored draft is asked for where the dialog is
OPENED rather than by an effect watching it, with the fifty-millisecond delay that
existed only to let the screen's own state settle; the summary tab's three reads
are addressed on the person and the week and asked for only while that tab is
open; and the last read group - the report, the history, the tasks, the
assignments and the staff list - is five hook reads now.

The report read was the piece this section had put aside, and it needed one thing
the other forms did not: the person's typing is recorded WITH THE ADDRESS IT WAS
TYPED FOR, so changing week or type shows THAT week's report rather than carrying
the previous one's text across. Two shapes are kept apart on purpose - the form
before the read answers is NOT the shape an empty report produces, so the screen
cannot flicker from one to the other. One read is kept with its answer discarded
(the Future Studio staff list): that answer has never been read on this screen,
and dropping the request would be a change of behaviour smuggled into a cleanup.

### 3.11 The guard that runs outside the shell it guards - CONVERTED

`src/app/admin/layout.js` and `src/app/developer/layout.js` decide who may enter a
whole section. Each does two things: restores the role from the browser's stored
copy BEFORE the first paint, so entering the section never flashes a blank screen,
and then asks the session endpoint and treats its answer as the authority -
redirecting anyone else, refreshing the stored copy with what the server said, and
deleting it when there is definitively no session.

The reason this was not converted looked structural: this guard runs OUTSIDE the
shell it guards, and the session the shell publishes is fetched by the shell - so
the guard could not read it before deciding whether to render the shell at all.
And the pre-paint restore could not be moved into the session cache, whose value is
deliberately absent on the first render.

**That second half is what changed.** The session cache is not the only thing the
identity comes from: on a cold load it comes from the browser's stored copy, read
once and cached against the raw string so an unchanged copy keeps its identity
(`getDashboardSessionUser`). "The session the shell published, or the stored copy
while the session has none" is therefore readable as a STORE SNAPSHOT during
render - by the shell, and equally by a guard that renders before it.

So the guards SUBSCRIBE to it instead of copying a role into state, and the effect
is gone. The section boundary did NOT have to move. Three behaviours are preserved
deliberately, because the guards disagreed with each other on them:

- the fast path admits the developer section by ROLE only; the intern GROUP is
  honoured where it always was, in the check;
- a stored role that is not admitted still goes to THAT ROLE's own dashboard,
  not to sign-in;
- a check that answered "no session" still removes the stored copy first, and the
  removal is noticed immediately by the raw-string cache.

> Still worth walking after any change here: entering and leaving each section as
each role, on a COLD LOAD (not a navigation), and with an account whose role
> changed server-side.

---

### 3.12 The two that were "not a conversion" - BOTH FIXED

Both were fixed by removing the construct that produced the warning, not by
silencing it.

| Where | What the warning was | What it actually took |
|---|---|---|
| `src/app/admin/platform/scores/page.js` | the CSV export was declared BEFORE the `useMemo` list it reads | The compiler merged the two into one reactive scope, and its memoisation check then ran before that scope was registered - so it reported the memo as "not preserved" and gave up on the component. Declaring the export AFTER the list it reads fixes it, and that is also the order the data reads in. The diff is a **pure move**: the export still reads the filtered list. |
| `src/app/admin/op-reports/page.js` | a bare `<img>` for the report logo | It now uses the shared image component with the logo's real dimensions (1018×1024), exactly as the sidebar and the sign-in screen already do. `w-auto` is NOT optional: without it the width attribute wins and the logo is stretched. |

**Both deserve a screen walk:**

- the scores screen: export a CSV with filters applied and with none - the file
  must still hold the FILTERED rows, and the name must still come from the chosen
  run (falling back to the chosen form);
- the operational report: open a report and export the PDF. The logo sits inside
  the region the document is captured from, so this is the one image change that
  can alter a DOCUMENT rather than just a screen.

> **Recorded, not fixed.** The same scores screen still reads its scores inside a
> `try` with a `finally`. The React Compiler cannot build HIR for a `finally`
> clause and reports it as a `Todo` - a diagnostic this repository's config does
> not surface, so it is invisible today. It costs nothing while the compiler is
> not part of the build (`next.config.mjs` does not enable it), but it is the one
> construct that would keep that screen out of compilation the day it is. The
> repair is three lines (clear the loading flag after the block - the `catch`
> above already absorbs every failure), deliberately left out so that each change
> here has exactly one cause.

---

## 4. Remaining groups

### 4.0 What is left, exactly

**Nothing is left in `src/components/` except the shell.** The four shared
components this section used to list - the task console, the programme detail,
the chat and the shell - are done:

| Component | Warnings | What it needed |
|---|---:|---|
| `src/components/tasks/TaskManager.js` | 4 → 0 | The list was state synced from the prop by an effect; it is now the prop, with the one local action recording its result AGAINST THE PROP VALUE IT WAS PERFORMED ON, so a parent re-read stops the recording from applying. A single local list that never cleared would have shadowed every later update from the parent. The parent's `requestNewTask` counter became a derived half compared against the value the person last dismissed, so closing wins even while the signal is still up. |
| `src/components/dashboard/ProgramDetail.js` | 3 → 0 | Two identity reads off the browser's copy, and the read that fills the screen. Which week is open is derived: the course's current week by default, with only the weeks the person toggled recorded over it. |
| `src/components/messaging/MessagingChat.js` | 2 → 0 | The identity read, and four sources loaded together. The three-second poll is KEPT, now as the read's `refetchInterval` driven by a subscribed page-visibility value, so a hidden tab has no timer. |

**3 `src/lib/` modules** are still left: the translation provider, the theme
provider and the permission provider. (The reading hook is the fourth, and its own
four warnings are deliberate - §3.7.)

#### 4.0.1 The shell - CONVERTED

`src/components/layout/DashboardLayout.js` is the one file where a mistake
reaches every role at once. Its three warnings were diagnosed before any was
touched, and all three are now done.

| Warning | What it needed |
|---|---|
| the "My Learning" door | The read is addressed ON THE ROLE, so a non-personal surface has no address and the door is hidden without any write. The route stays a DEPENDENCY rather than part of the address, so navigating still re-asks and the door still opens as soon as an enrollment exists. The state it used to write is gone: it fed one comparison, and "unknown" and "no" hid the door alike. |
| the sidebar accordion | The person's hand-toggled sections are recorded TOGETHER WITH THE ROUTE they were toggled on, and the effective map is derived during render: the route's sections open, the rest closed, then those toggles laid over. Replaying the existing toggle against that map reproduces the behaviour exactly, including closing a section on the active path by hand. |
| the pre-paint session restore | The identity is now the SHARED STORE (`getDashboardSessionUser`, section 3.11), not a second copy beside it, and "are we authenticated" is derived from "do we know who this is, or have we finished asking". One writer publishes to the store and keeps the browser's copy in step - and it now PRESERVES the fields other surfaces put in the session (the capability matrix), where the old code replaced the whole object. |

> One guard test locks the learning door's rule by looking for the text of its
gate. The variable kept the name that test knows, so the rule it locks is still
the rule the code expresses.

**DONE — 28 shared components + the shell's two:** the six participant dashboard
views (`AssignmentsView`, `ParticipantDashboardHome`, `ProgramListing`,
`ProgressView`, `RitualsView`, `UnifiedOperationsView`), the ten LMS panels
(`AssessmentTake`, `CoachingRequestsPanel`, `CourseEditor`, `CourseList`,
`EnrollModal`, `LearnerCourse`, `LearnerLearning`, `LessonModal`,
`ProgramLearningSection`, `SessionResourcesSection`), the membership roster
(`MembershipScreen`), the two UI primitives (`NavigationLoader`,
`SearchableSelect`), the nine of the second slice (`ProfileView`,
`StandupRetroView`, `SubmissionVersionHistory`, `UnifiedDashboard`,
`LearnerCoachingButton`, `LearnerPlayer`, `MembershipSection`, `FacilitatorsPanel`,
`ErrorLogsView`) and the three of the third (`TaskManager`, `ProgramDetail`,
`MessagingChat`). None of them needs revisiting; the non-obvious shapes are
recorded in §4.3.

### 4.1 The venture group - CONVERTED

All 23 are converted. Twenty went through the recipe below; the last three each
looked like they needed a restructure, and each one's blocker turned out to be a
shape that the recipe already had an answer for. What each one needed, kept
because the next group will meet the same three shapes:

| Screen | What it looked like | What it actually needed |
|---|---|---|
| `src/components/ventures/VentureDashboard.js` | The read's answer became a per-widget map that each widget rewrote for itself, failure message included, and the read assigned the whole map back over those writes. | The map is derived from the payload **during render**; the only state kept is the transient pair a single widget goes through while being refreshed. The objection that the map needed the translator was about the SHAPER, and the shaper only had to return the payload. |
| `src/components/ventures/JourneyManagerPanel.js` | Its stage list was REPUBLISHED from the response body of six different writes, and the note said removing that state would turn each write into an extra read. | A write publishes its OWN answer into the read it belongs to - that is what the hook's setter is for - so nothing is read twice and no successful write can be undone on screen by a re-read that then fails. |
| `src/app/participant/ventures/[id]/page.js` | Some twenty-three reads fanned out by one tab-keyed effect, and the read that filled the profile form overwrote it, with the form's setter handed to eight child components through a context. | Only ONE of the reads was the blocker: the one that fills the form. Solving it alone made the two objecting reads stop objecting. The form is a derived base plus the person's edits, and `setForm` still accepts a whole form object - which is all the eight children ever passed - so their contract never changed. |

Two things this group settled, which the rest of the work depends on:

- **a write that already carries the new state should not buy a second read.**
  The rule is: publish the answer the write returned into the read it belongs to;
  call the read's `refresh` only from the writes whose body does NOT carry what
  the screen shows (the milestone and deliverable writes here, which return a
  status and not the structure).
- **a form filled by a read is a derived base plus the edits, and the setter can
  keep its old signature.** A child that hands over a whole form object is already
  handing over "the base with my changes applied", so recording it as the edits
  and laying it back over the base reproduces exactly what the child meant. The
  contract only has to change when a child passes something other than a whole
  form.

### 4.2 What is left on the founder's venture workspace

Its 22 remaining reads are still written out by hand (each one is the shared
cache, the `fetch`, and a `setState`). None of them carries a warning, because
they all write their state after an `await` and the rule only reports a write
reachable synchronously from an effect. They are a mechanical conversion from
here, and the two that need thought are already solved:

1. the identity and the venture record are done;
2. `fetchDocuments` takes `(search, category)` and builds its address from the
   page's own filter state - so as a hook read it is addressed **on that filter
   state**, the child's debounce and its `onKeyUp` reload both disappear, and the
   one-request-per-keystroke behaviour the screen already had is unchanged;
3. the rest map one-to-one: `fetchX` becomes `refreshX` under the same name in
   the workspace context, so the ~30 call sites inside the tab components do not
   have to change at all.

### 4.3 The two shapes the shared-component slice settled, and the toast rule

Two of the nineteen were not conversions at all, and both are general rather than
one-off:

- **State reset when a CONTROL OPENS belongs to the action, not to an effect.**
  The searchable select cleared its search and its highlight from an effect
  watching `open`, which could only ever be one render late - the popover's first
  paint still carried the previous search. Clearing them is part of opening the
  popover, so it happens in the handler that opens it. What remains in an effect
  is the focus, which is a DOM side effect and writes no state. **This is the fix
  for every "reset a transient field when the dialog opens" warning.**
- **A completion driven by the ADDRESS is derived, not written.** The global
  navigation bar wrote 100% from an effect keyed on the route. It now records the
  address the navigation STARTED FROM and derives "finished" during render by
  comparing that with the current address, so arriving costs no state write and
  cannot cascade a render. The effect keeps only the timers and the exit
  animation. **This is the fix for every "when X changes, finish/close/reset"
  warning where X is reachable during render** - the op-report screen's address
  mirror (§3.10) is the same repair.

And the rule for a failure signal the loader used to raise as an EVENT:

- the hook reports a failure as a **value**, so a loader's error toast cannot be
  carried over as it stands. Fold the refusal into the read's own value
  (`{ payload, failure }`, the shape `src/app/admin/crm/duplicates/page.js` uses)
  and raise the toast from a small effect whose ONLY job is the notification. That
  keeps the signal without inventing state. Do not silently drop the toast, and do
  not add an effect whose job is to copy the read into other state.
- consequence to expect: a failure is CACHED for its 30 s life, so a screen
  revisited inside that window re-raises the toast for the same refusal.

### What the venture recipe looks like, for whoever continues it

Twenty of the twenty-three were converted with one recipe, three at a time. Each
screen has one loader and one effect that calls it, and the loader is nothing but
the shared cache written out by hand:

1. the reads become `useApi` calls addressed on the venture's id, with named
   shapers at module scope (a list from a field, or the whole payload);
2. `loading` becomes the reads' loading flags, OR-ed;
3. the states the loader filled are deleted, and everything downstream reads the
   values directly;
4. the reload points become the reads' own `refresh` - or its `setData`, when the
   write's own body is what the screen shows (§4.1);
5. a read triggered by a CLICK - a document's detail, a session's detail - stays a
   plain fetch, so the file keeps using the shared cache directly for that one;
6. a read whose answer must not be kept by the browser says so:
   `fetchOptions: { cache: "no-store" }`, which the hook passes to the request.

The four mistakes that have cost a review cycle here, so they do not cost another:

- a state declaration that is not part of the read set must not be swept up with
  the ones that are - replace the specific declaration lines, never a block from
  "the first state" to "the effect";
- a shaper factory (`pickList("tasks")`) has to be built at module scope, not at
  the call site;
- a helper cannot call the hook for you - React reads a hook by the shape of the
  code, not by its name, and it will refuse one called from a function that is
  neither a component nor named `use…`. Seven reads in one file are written out;
- a screen that paints a whole object out of a read (a widget map, an updated
  record) keeps only what is TRANSIENT about it - the spinner and the failure
  message - and derives the rest, or a write's own answer has nowhere to go but a
  second request.

### 4.4 The three providers - CONVERTED

`src/lib/i18n.js`, `src/lib/ThemeProvider.js` and `src/lib/PermissionProvider.js`
were the last family, and all three were the same structural problem, one layer up
from the guards: each copied a value out of a BROWSER store into React state from
an effect, because it cannot be read during the render the server also produces.

**Each is now SUBSCRIBED instead of copied** - `useSyncExternalStore` over a small
module store, with the server snapshot deliberately the default, which is what
keeps the server's render and the browser's first render agreeing. Nothing is
copied into state, no render is cascaded, and the writes that touch the DOM stay in
effects.

| Provider | What it needed | 
|---|---|
| the translation provider | The account's own language wins over the loose preference, which wins over the browser's - the precedence TWO effects used to establish between them, now expressed once in the store's read. Switching a language still writes the account's copy, for the reason the old code gave: the account's language is read first, so a choice that did not update it would be undone. |
| the theme provider | Holds nothing at all now: the preference is the store, the resolved scheme is derived from it and a subscribed OS preference, and the DOM attribute is written by a LAYOUT effect that waits for the client - writing it during the hydration pass would undo the pre-hydration script that already resolved the real theme before the first paint. |
| the permission provider | Seeded from the shell's session cache, which IS a store, so the seed needs neither an effect nor a render of its own; the read then reports its own verdict. A request that THREW still leaves the cached matrix standing, which is what the loader did by not clearing it in its catch. The context value keeps a STABLE refresh, so consumers are not re-rendered merely because the provider rendered. |

> Note that the translation provider's dependency-list suppression went with the
effects it belonged to, as the note in the previous version of this section said it
would.

### 4.5 What the four store conversions had in common

Every one of them - the identity, the language, the theme, the capability matrix -
was the same shape, and the shape is the whole lesson:

1. the value lives in a browser store, so it cannot be read during the render the
   server also produces;
2. it is exposed as a module store with `subscribe` and `getSnapshot`, and the
   server snapshot is the DEFAULT rather than a guess;
3. **the snapshot must keep its identity** while nothing has changed, or React
   re-renders forever - so a snapshot that parses or rebuilds is cached: against
   the raw string, against the day, against the store's own object;
4. anything the value has to do to the DOM stays in an effect; the VALUE is what
   moves.

And the one trap: a browser store read at module scope has to notice a value that
was REMOVED, not only one that changed. Sign-out is where that bites.

The version of this section that stood here said the repair was a change to how the
app owns four values "walked in each role, not swept up here". It was done
carefully and it is done; the walk each one asks for is written where it is made.

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
sign-in) deserve the most attention, because a mistake there blocks people rather
than inconveniencing them.

### 5.1 The walks that are still owed

The migration is done, and four of its changes are wide enough that they are worth
walking once, deliberately, rather than trusting the green suite. Each is listed
where it was made; together they are:

| What changed | What to walk |
|---|---|
| The shell's identity, and the two section guards (§3.11, §4.0.1) | Sign in as EACH role: the sidebar's doors, entering and leaving a section, a COLD load (not a navigation), signing out, and an account whose role changed server-side. |
| The theme, the language and the capability matrix (§4.4) | The theme switch dark → light → system and a cold reload for a flash; the language switch, a reload, and an account whose language is stored; that no door is missing or extra for a role. |
| The dashboard's data hook, everywhere (§4.3) | For a converted screen: the first paint, the return from another page, and the empty state. |
| The two public screens (§3.3, §3.4) | The SIGN-IN link: a real invitation, an expired one, one with no token, a password-reset link, and the submission. The PUBLIC FORM: a link with a saved draft, a multi-section form, a FRENCH form opened with no language chosen, an ENGLISH form opened by someone whose language is French, a run that is not there, and a submission. |
rather than inconveniencing them.

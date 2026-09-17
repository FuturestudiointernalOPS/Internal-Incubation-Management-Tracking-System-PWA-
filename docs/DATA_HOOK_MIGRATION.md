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
| ESLint warnings, total | 2192 | 45 |
| `react-hooks/set-state-in-effect` | 200 | 40 |
| ESLint errors | 0 | 0 |
| `no-unused-vars` | 2 | 0 |
| Production build | passes | passes |

The total includes ONE `no-unused-vars` that is not this migration's: it is in a
new test file added by the other workstream (`result-pdf-layout.test.js`). On this
side the count is 44, and `no-unused-vars` is still 0.

Screens carrying a `set-state-in-effect` warning: **19** (plus the hook itself,
which is counted separately below).

| Group | Screens |
|---|---:|
| Application pages | 15 |
| The shell (`src/components/layout/DashboardLayout.js`) | 1 |
| `src/lib/` modules | 3 |

The hook itself accounts for the twentieth file, and for four warnings rather
than two (see the note below and §3.7).

Of these 19 screens, **11 carry a single warning**; the remaining 8 carry two to
five.

### What is left, and under which reason

Every screen still carrying a warning is accounted for below. Nothing is left
unsaid, and no screen is on this list merely because it looked hard.

| Reason | Screens | Where |
|---|---:|---|
| The address bar is the source of truth, with one read group to go | 1 | §3.10 |
| A guard that runs outside the shell it guards | 2 | §3.11 |
| The value comes from somewhere that is not the network | 4 | §3.4 |
| The read fills in a form | 1 | §1, the form table |
| The loader has side effects beyond storing the result | 1 | §3.3 |
| Large screens not yet examined one by one | 6 | §3.6 |
| The shell's pre-paint session restore | 1 | §4.0.1 |
| **`src/lib/` modules** | 3 | §3.7 and §4.0 |

Seven of the reasons above are no longer reasons: the screens that needed a
capability the hook did not expose (§3.1), the ones that asked for one record per
element (§3.2), the one whose read also wrote (§3.9), the standup screen's address
mirror (§3.10, mostly), the venture group, the screen that republished its state
from its writes, and the whole shared-component group except the shell itself are
converted, and their sections record what was done.
The whole venture group is converted, and its section records what each of the
three needed. Six of the reasons above are therefore no longer reasons: the
screens that needed a capability the hook did not expose (§3.1), the ones that
asked for one record per element (§3.2), the one whose read also wrote (§3.9), the
standup screen's address mirror (§3.10, mostly), the venture group and - no longer
listed - the screen that republished its state from its writes (§4).

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

### 3.10 The screen whose source of truth is the address bar — MOSTLY DONE

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
existed only to let the screen's own state settle; and the summary tab's three
reads are addressed on the person and the week and asked for only while that tab is
open.

**What is left is one read group**, the five the old code called together from one
effect: the report, the history, the tasks, the assignments and the staff list.
Four of them are plain reads. The report read is not: **it is what fills in the
report form**, and the week is part of that form's address - so converting it means
moving the form to the derived-base shape (section 1), with the edits recorded
against the week they belong to so that changing week shows that week's report
rather than carrying the previous one's typing across. That is a piece of its own
on the screen where a mistake would keep people from reporting at all.

### 3.11 The guard that runs outside the shell it guards

`src/app/admin/layout.js` and `src/app/developer/layout.js` decide who may enter a
whole section. Each does two things: restores the role from the browser's stored
copy BEFORE the first paint, so entering the section never flashes a blank screen,
and then asks the session endpoint and treats its answer as the authority -
redirecting anyone else, refreshing the stored copy with what the server said, and
deleting it when there is definitively no session.

The reason this is not converted is structural, not convenience: this guard runs
OUTSIDE the shell it guards, and the session the shell publishes is fetched by the
shell. The guard therefore cannot read it before deciding whether to render the
shell at all. And the pre-paint restore cannot be moved into the session cache,
whose value is deliberately absent on the first render - that is what keeps the
server's render and the browser's first render identical.

Converting it means moving the guard INSIDE the shell so that it can read the
session the shell already has. That is a change to the section boundary on the two
screens that decide who gets in, and it should be made deliberately, with the
sections walked in each role, rather than as part of a warning cleanup.

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

#### 4.0.1 The shell - TWO OF THREE DONE, and the one that is not

`src/components/layout/DashboardLayout.js` is the one file where a mistake
reaches every role at once. Its three warnings were diagnosed before any was
touched; two are now converted and the third is deliberately not.

| Warning | State |
|---|---|
| the "My Learning" door | **DONE.** The read is addressed ON THE ROLE, so a non-personal surface has no address and the door is hidden without any write. The route stays a DEPENDENCY rather than part of the address, so navigating still re-asks and the door still opens as soon as an enrollment exists. The state it used to write is gone: it fed one comparison, and "unknown" and "no" hid the door alike. |
| the sidebar accordion | **DONE, by derivation.** The person's hand-toggled sections are recorded TOGETHER WITH THE ROUTE they were toggled on, and the effective map is derived during render: the route's sections open, the rest closed, then those toggles laid over. Replaying the existing toggle against that map reproduces the behaviour exactly, including closing a section on the active path by hand. It also removes a state write and a second render per navigation, and the first paint now already has the route's section open. |
| the pre-paint session restore, line 991 | **LEFT, and it is structural.** The value comes from a browser store, so it cannot be read during the render the server also produces - the same reason §3.11 gives for the section guards. The honest repair is to make `user` a value SUBSCRIBED to the session cache (`useSyncExternalStore`, as `useSessionUser` does) instead of the shell's own state, and to derive `authChecked` from it. That is a change to how the shell owns the identity, which every role depends on, so it is made deliberately and walked in each role - not as part of a warning sweep. |

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

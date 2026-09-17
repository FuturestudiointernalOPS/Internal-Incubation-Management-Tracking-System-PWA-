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
  identity every render, which changes the hook's internal callback, which
  re-runs the effect — one request per render, forever.
- **A screen must not keep its own copy of the data.** Converting the loader
  but resynchronising the result into local state reproduces the original
  pattern (and the rule's warning) exactly.

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
| ESLint warnings, total | 2192 | 158 |
| `react-hooks/set-state-in-effect` | 200 | 149 |
| ESLint errors | 0 | 0 |
| `no-unused-vars` in converted files | 0 | 0 |
| Tests | 1539 / 1539 | 1588 / 1588 |
| Production build | passes | passes |

Screens carrying a `set-state-in-effect` warning: **98**.

| Group | Screens |
|---|---:|
| Application pages | 39 |
| Shared components (`src/components/`) | 32 |
| Venture screens | 23 |
| `src/lib/` modules | 4 |

Of these 98 screens, **70 carry a single warning**; the remaining 28 carry two
to five.

> Note: the repository currently reports 2 `no-unused-vars`, both in
> `src/__tests__/program-assignment-grants.test.js`. They were introduced by a
> different workstream and are unrelated to this migration.

---

## 3. Deliberately deferred — with the reason and the next step

These are **not** abandoned. Each was examined and left for a stated reason.
The next step column is what a follow-up pass has to do.

### 3.1 The screen needs a capability the hook does not expose

| Screen | Why it is deferred | Next step |
|---|---|---|
| `src/app/admin/finance/page.js` | The loader distinguishes a **401 (session expired)** from a **500 (server error)** by reading the response status, and shows a different message for each. `useApi` only surfaces a thrown error, so the distinction would be lost. | Teach the hook to expose the response status (or a `status`/`ok` pair) on failure, then convert. This is a hook change, so it affects every consumer — do it deliberately, with tests. |
| `src/app/admin/crm/duplicates/page.js` | The loader doubles as a **notifier**: when the read fails it dispatches a "could not load duplicates" message. That dispatch happens inside the loader, so converting removes the feedback. | Either derive the message and surface it from the render path, or add an error callback to the hook. Do not convert until one of those exists. |
| `src/app/admin/integrations/page.js` | Same shape as the finance dashboard: the loader reads the response status and translates a failure into a message. | Same as 3.1 row 1. |

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
identity) and the staff stand-up screen.

Still to move: the staff dashboard (which keys its reads on a field the session
endpoint does not return, so it needs a decision about which identifier it
should use) and the programme manager's promote screen.

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
| Screens over ~800 lines (`admin/programs`, `admin/projects`, `admin/tasks`, `admin/work`, `admin/access`, `admin/knowledge`, `admin/op-reports`, `pm/programs/[id]`, `pm/programs`, `pm/submissions`, `staff/op-report`, `staff/projects/[id]`, `team/[id]`, `platform/runs`, `platform/forms`, `admin/communications/contacts`, `admin/programs/[id]`, `admin/projects/[id]`) | Not examined individually yet. Several load more than one endpoint and some mix loads with mutations, so each needs a read before conversion. |

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

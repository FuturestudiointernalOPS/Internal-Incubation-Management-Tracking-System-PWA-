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
| ESLint warnings, total | 2192 | 168 |
| `react-hooks/set-state-in-effect` | 200 | 160 |
| ESLint errors | 0 | 0 |
| `no-unused-vars` in converted files | 0 | 0 |
| Tests | 1539 / 1539 | 1566 / 1566 |
| Production build | passes | passes |

Screens carrying a `set-state-in-effect` warning: **109**.

| Group | Screens |
|---|---:|
| Application pages | 50 |
| Shared components (`src/components/`) | 32 |
| Venture screens | 23 |
| `src/lib/` modules | 4 |

Of these 109 screens, **81 carry a single warning**; the remaining 28 carry two
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

These are legitimate uses of an effect: the value cannot be produced during
render without breaking server rendering or the first paint.

| Screen | Source | Note |
|---|---|---|
| `src/app/staff/tasks/page.js` | The signed-in person, from the browser's own storage | Passed down to a shared view. |
| `src/app/staff/dashboard/page.js` | Same, plus reads keyed on that person's id | |
| `src/app/pm/programs/[id]/promote/page.js` | Same | |
| `src/app/admin/blockers/page.js` | Same — and the **request URLs themselves** are built from the role read out of storage | Would need the session to come from a shared context instead. |
| `src/app/platform/modules/page.js`, `src/app/platform/settings/page.js` | The registered-modules registry, read synchronously | Not a network read at all. |
| `src/app/developer/retro/page.js` | The current week | Computing it during render would mismatch between the server's clock and the browser's. |
| `src/app/investor/profile/page.js` | Server data used to **initialise an editable form** | The effect is the standard way; removing it means restructuring the form (e.g. a keyed child component). |
| `src/app/activate/page.js` | The token and mode, read from the browser's address bar | Same shape as the registration link that was converted; converting needs the navigation-parameter route plus a derived token state. Doable, do it deliberately: this is a sign-in screen. |

### 3.5 The screen would show a message that is not true

| Screen | Why it is deferred | Next step |
|---|---|---|
| `src/app/facilitator/page.js` | It shows "no programs assigned yet" when its program list is empty. The hook paints an empty list for a failed read, so a transient failure would tell the person they have no role. | **Solved on paper**: give the read a transformation that returns `null` (not an empty list) on failure, and only show the notice when the list is present and empty. Convert with that in place. |
| `src/app/admin/announcements/page.js` | Its loader deliberately does **not** raise the loading flag when the "include archived" filter changes, so the list stays on screen instead of flashing a spinner. | Convert with a check on whether the data is already present, or accept the spinner and say so in the commit. |

### 3.6 Structural or large

| Screen | Why it is deferred |
|---|---|
| `src/app/admin/system/page.js` | Nine reads in one loader, one of which the health-check action also writes. |
| `src/app/admin/security/page.js` | Seven reads: four are combined into one summary object, three feed their own lists; one list is also updated optimistically when a session is revoked. |
| `src/app/admin/metrics/page.js` | The list is written through a helper shared by the cache path and the network path; it needs the same treatment as `facilitator/page.js` (§3.5) plus care around the helper. |
| `src/app/invite/[token]/page.js` | The load failure and the form's own submission failure share one error value; splitting them is required first. |
| Screens over ~800 lines (`admin/programs`, `admin/projects`, `admin/tasks`, `admin/work`, `admin/access`, `admin/knowledge`, `admin/op-reports`, `pm/programs/[id]`, `pm/programs`, `pm/submissions`, `staff/op-report`, `staff/projects/[id]`, `team/[id]`, `platform/runs`, `platform/forms`, `admin/communications/contacts`, `admin/programs/[id]`, `admin/projects/[id]`) | Not examined individually yet. Several load more than one endpoint and some mix loads with mutations, so each needs a read before conversion. |

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

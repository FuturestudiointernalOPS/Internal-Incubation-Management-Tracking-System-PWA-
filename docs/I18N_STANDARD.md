# I18N Standardization — ImpactOS

> Status: living document · Branch: `Abel` · Scope: full source analysis + key schema + dictionary convention + replacement procedure
> The engine is **custom** (`src/lib/i18n.js`), **not** i18next. Dictionaries are hand-written JSON — no machine translation, no external calls.

## 1. Goal

Every user-visible string in the app must go through `t("namespace.key", { params })` so the UI can render in EN or FR (and future languages) with **zero logic change**. This document defines:

1. The current audit state (what is wired, what is not).
2. The standardized key schema all future keys must follow.
3. The dictionary file convention (EN + FR JSON per namespace).
4. A clean, logic-safe procedure to replace literals with `t()` calls.
5. The API-layer translation strategy.

## 2. Current architecture (verified)

| Piece | Location | Behavior |
|---|---|---|
| Engine | `src/lib/i18n.js` | `t("ns.key", {param})`; deep-dot resolution; EN fallback; missing key → returns the key string as a visible signal |
| Loader | `src/lib/locales.js` | Deep-merges all per-language JSON namespace files into one registry |
| Parity gate | `scripts/i18n-parity.mjs` | Reports MISSING (EN key absent in FR), IDENTICAL (FR == EN), OBSOLETE (FR key not in EN); exits 1 on any MISSING; `--fix` prunes obsolete keys |
| Locale files | `src/locales/en/*.json` (24) + `src/locales/fr/*.json` (24) | One file per namespace |

Engine facts (do not change):

- Placeholder syntax is **single braces**: `{param}`. Regex used: `/\{(\w+)\}/`. Never use `{{param}}`.
- `t("ns.missing.key")` returns the raw key string — this is how untranslated spots surface in the UI.
- Language is persisted to `localStorage["impactos_lang"]` and synced to the account via `PUT /api/auth/language`.
- EN is the **source of truth**. FR may be a subset; missing FR keys fall back to EN.

Parity state (verified by hand-reproduction of the script over all 48 files):

```
❌ Missing:   0
⚠️  Identical: ~215   ← reviewed; remaining identicals are loanwords (Email, Type, Description, Backlog, ...) or brand terms kept as-is by design
🗑  Obsolete:  0
```

A review pass over the IDENTICAL keys is complete — 14 genuine French translations were applied (notably the `Venture` → `Entreprise` convention); the rest are loanwords/proper nouns that are legitimately identical in French. Densest files: `vadmin.json` (62), `adminMisc.json` (40), `venture.json` (27), `investorAdmin.json` (23), `crm.json` (22), `investor.json` (12), `engineering.json` (9), `messaging.json` (6). Examples: `venture.permissions` ("Permissions" in both), `vadmin.sessions.coaching` ("Coaching"), `crm.campaigns.minutes` ("Minutes"), `status.action` ("ACTION" in both), `messaging.title` ("Messages"), plus many `N/A`, `Type`, `Description`, `Email`, `Backlog` labels.

## 3. Audit summary

Three exhaustive audits were run (admin pages, non-admin pages + components, API routes). Methodology: grep-based extraction of literal JSX text, `placeholder=`/`title=` attributes, `<option>` labels, toast strings, `setError` strings, `alert/confirm/prompt` strings, and success messages returned by API handlers.

### 3.1 Admin pages (`src/app/admin`, excluding `api`) — ~382 findings

| Category | Count |
|---|---|
| JSX_TEXT (inline literal text) | 222 |
| OPTION (`<option>` labels without `value`) | 48 |
| PLACEHOLDER | 34 |
| TITLE (`title=`, `aria-label=`) | 21 |
| TOAST (success/error toasts) | 33 |
| ERROR_STATE (`setError` / rendered error) | 19 |
| ALERT (`alert/confirm/prompt`) | 5 |

Worst offenders: `pm/programs/[id]/page.js` (~180), `platform/runs` (~90), `platform/forms` (~90), `team/[id]` (~70), `components/tasks/TaskManager.js` (~60).

### 3.2 Non-admin pages + components — ~725 findings

Same categories across `staff`, `pm`, `teacher`, `participant`, `developer`, `investor`, `platform` root, root pages and `src/components`. Recently-wired components still have leftovers: `UnifiedDashboard`, `UnifiedOperationsView`, `StandupRetroView`, `ParticipantDashboardHome`, `ProgramDetail`, `ProgressView`, `RitualsView`, `AssignmentsView`, `SubmissionVersionHistory`, `MessagingChat` (3), `TaskDetailModal`, `TaskManager`.

### 3.3 API routes (`src/app/api/**/route.js`, 304 files, 148 with findings) — ~330 error strings

Two levers dominate:

1. `src/lib/auth.js` — `requireAuth` / `requireCapability` return 4 shared literals: `"Authentication required."` (401), `"Insufficient permissions."` (403), `"Authentication system failure."` (500), `"Authorization system failure."` (500).
2. `src/lib/api/createHandler.js` (wraps ~120 routes) — its catch-all forwards `e.message` verbatim:

```js
} catch (e) {
  console.error("API Error:", e.message);
  return NextResponse.json({ success: false, error: e.message }, { status: 500 });
}
```

Raw server messages leak to the client here. See §7 for the API strategy — this layer must NOT be key-wired string-by-string as a first pass.

## 4. Standardized key structure

### 4.1 Schema

```
area.page.section.element
```

- `area` — the feature namespace (see table below). Always a file name.
- `page` — the page or workflow (camelCase, e.g. `platformScores`).
- `section` — optional grouping (e.g. `table`, `filter`, `tabs`).
- `element` — the leaf key (camelCase, e.g. `csvName`, `noRespondents`).

Examples already in the codebase:

```
adminMisc.platformScores.csvName
adminMisc.system.tabs.overview      ← 3 levels (the only 3-level path today)
reports.table.task
status.inProgress
time.months.january
```

### 4.2 Namespace table (24 registered)

| Namespace | File | Purpose |
|---|---|---|
| `common` | `common.json` | Generic UI: save, cancel, close, search, loading, noResults, upload, language, continue |
| `auth` | `auth.json` | Login, password, authentication |
| `navigation` | `navigation.json` | Sidebar labels, section headers (`mainOperations`, `userProtocol`), breadcrumb crumbs |
| `admin` | `admin.json` | Admin dashboard labels, section titles |
| `adminMisc` | `adminMisc.json` | Admin workflows: platformScores, system, standardization, integrations, bulkUpload, ... |
| `reports` | `reports.json` | Report labels, table headers, filter options, tasks, blockers |
| `status` | `status.json` | Status labels: active, pending, inProgress, completed, archived, blocked, carriedOver, ... |
| `time` | `time.json` | Time labels + `months.*` (12), `days.*` (7), `calendar.*` |
| `errors` | `errors.json` | Error messages |
| `staff` | `staff.json` | Staff dashboard, op-report labels, categories |
| `teacher` | `teacher.json` | Teacher dashboard labels |
| `pm` | `pm.json` | Program manager labels |
| `participant` | `participant.json` | Participant labels |
| `team` | `team.json` | Team workspace: overview, deliverables, files, calendar |
| `finance` | `finance.json` | Finance labels |
| `developer` | `developer.json` | Developer labels |
| `messaging` | `messaging.json` | Messages, communication |
| `venture` | `venture.json` | Ventures (FR: `Entreprise`) |
| `investor` | `investor.json` | Investor dashboard labels |
| `investorAdmin` | `investorAdmin.json` | Investor admin workflows |
| `forms` | `forms.json` | Forms |
| `crm` | `crm.json` | CRM: pipelines, timelines, duplicates, campaigns |
| `vadmin` | `vadmin.json` | Venture admin |
| `engineering` | `engineering.json` | Engineering ops: error levels, message types |

### 4.3 Namespace selection rules

1. Use an existing namespace when the string belongs to it (`status.*` for statuses, `time.*` for time words, `common.*` for generic buttons).
2. Prefer the `*Misc` file of the area when the page already lives there (`adminMisc.*` for admin workflows, `staffMisc`-style files for new staff workflows). **Do not** dump new keys into `developer.json`/`admin.json` if a workflow file exists.
3. New workflow namespaces get their own file **and** must be registered in `src/lib/locales.js` in **four** places: EN import, FR import, EN array, FR array (a missing registration silently drops the whole namespace).
4. Every JSON file MUST wrap its keys: `{ "namespace": { ... } }`. Never write keys at the file root.
5. Legacy exception (documented, do not extend): `investor.json` is unwrapped (root keys) because investor pages call `t("pipeline")` / `t("discover")` without the prefix. Conforming it requires updating all investor call sites — see §8.

### 4.4 Value conventions

- Brand/proper nouns stay literal in both languages: `Venture OS`, `Venture Ready`, `ImpactOS`, `CRM`, `PDF`, `Min`/`Max` when they are input decorations.
- `Venture` → `Entreprise` in FR (grammar-aware), except inside brand terms.
- Language selector labels (`English`, `Français`) stay literal.
- Placeholders inside values use `{param}`; the key must be documented with its params, e.g. `"selectAllPending": "Select all pending ({count})"`.

## 5. Dictionary files

### 5.1 Layout

```
src/locales/
├── en/        ← source of truth (every key must exist here)
│   ├── common.json
│   ├── navigation.json
│   └── ... (24 files)
└── fr/        ← mirror (subset allowed; missing falls back to EN)
    ├── common.json
    └── ...
```

### 5.2 Schema (example, abridged)

```json
// src/locales/en/common.json
{
  "common": {
    "save": "Save Changes",
    "cancel": "Cancel",
    "search": "Search",
    "noResults": "No results found",
    "upload": "Upload"
  }
}
```

```json
// src/locales/fr/common.json
{
  "common": {
    "save": "Enregistrer les modifications",
    "cancel": "Annuler",
    "search": "Rechercher",
    "noResults": "Aucun résultat trouvé",
    "upload": "Importer"
  }
}
```

### 5.3 Registration checklist (when adding a new namespace file)

- [ ] Create `src/locales/en/<ns>.json` with `{ "<ns>": { ... } }`
- [ ] Create `src/locales/fr/<ns>.json` with the same structure (FR subset OK)
- [ ] Add `import en<Ns> from "@/locales/en/<ns>.json"` in `src/lib/locales.js`
- [ ] Add `import fr<Ns> from "@/locales/fr/<ns>.json"` in `src/lib/locales.js`
- [ ] Add `en<Ns>` to the EN array and `fr<Ns>` to the FR array
- [ ] Run `node scripts/i18n-parity.mjs` → must report `Missing: 0`

### 5.4 Current key inventory

~3,900 leaf keys across the 24 EN files (manual count — re-verify with a script before quoting in reports). Largest: `vadmin.json` (945), `adminMisc.json` (769), `crm.json` (392), `engineering.json` (248), `venture.json` (244), `investorAdmin.json` (263).

## 6. Clean replacement procedure (no logic change)

Work one file at a time. For each visible string, classify it, then apply the matching pattern.

### Step 1 — Classify the string

| Class | Example | How to treat |
|---|---|---|
| Static JSX text | `<h2>Task</h2>` | Wrap: `{t("reports.table.task")}` |
| Placeholder / title / aria | `placeholder="Search..."` | Wrap: `placeholder={t("common.search")}` |
| Option label (value is the label) | `<option>All Programs</option>` | Add `value="All Programs"`, then wrap label (see 6.3) |
| Option label with value already | `<option value="archived">Archived</option>` | Wrap label only: `{t("status.archived")}` |
| Toast / alert / prompt | `toast("Saved!")` | Wrap: `toast(t("common.save"))` |
| Error state | `setError("Failed to load")` | Wrap: `setError(t("errors.loadFailed"))` |
| State-comparison literal | `filter === "All Programs"` | NEVER translate the compared value (see 6.3) |
| API-driven raw value | `c.status`, `r.severity`, `env` | Lookup map at render time (see 6.4) |

### Step 2 — Decide the key

- Choose namespace per §4.3. Reuse existing keys (check the EN file first) before creating new ones.
- Key name = `page.section.element` in camelCase, readable without the value (e.g. `noRespondents`, not `theresNothingHere`).

### Step 3 — Comparison-safe options (critical)

When a label is ALSO used in a `===` comparison (`selectedGroup === "All Contacts"`, `filterStatus === "Archived"`, `selectedProgram === "All Programs"`, `filterUser === "All Users"`):

1. Add an explicit `value="<raw>"` attribute to the `<option>` (or keep the compared constant).
2. Translate only the visible label.

```jsx
// Before — translating this breaks the comparison
<option>All Programs</option>

// After — value stays raw, label translates
<option value="All Programs">{t("navigation.allPrograms")}</option>
```

If the compared value lives in a variable or object, translate at render time only:

```jsx
// Never: if (filter === t("status.archived"))
// Always: if (filter === "archived")
```

### Step 4 — API-driven raw values (lookup maps)

For DB/API values displayed as-is (statuses, severities, environments, provider names, report types, channels, components), keep comparisons on the raw value and translate at render time with a map + fallback:

```jsx
const STATUS_LABELS = {
  healthy: "adminMisc.system.healthy",
  degraded: "adminMisc.system.degraded",
  unhealthy: "adminMisc.system.unhealthy",
};

// Render:
{t(STATUS_LABELS[c.status] || "") || c.status}
```

- Unknown/DB-only values fall back to the raw string via `|| c.status`.
- Comparisons stay intact because they always use the raw value.
- This pattern is already implemented in `admin/system`, `admin/blockers`, `admin/engineering`, `ErrorLogsView`, `admin/integrations`.

### Step 5 — Add the keys

Add EN (source of truth) then FR to the chosen namespace file. Run the parity script — the page's keys must not create MISSING entries.

### Step 6 — Register new namespaces

Only if you created a new file — follow §5.3.

### Step 7 — Verify

```sh
node scripts/i18n-parity.mjs   # must print  Missing: 0  (exits 0)
npm run build                  # zero errors
```

Manual UI spot-check in both languages, especially pages where you touched options/comparisons.

### Pre/post checklist

- [ ] `t` imported from `@/lib/i18n`; `useI18n` destructured in client components
- [ ] No zombie imports: file imports `useI18n` but has 0 `t()` calls → remove the import or wire the strings
- [ ] No `{{param}}` double braces
- [ ] No translated comparison values
- [ ] FR file updated (or key absent → falls back to EN, but that shows EN in FR UI)
- [ ] `navigation.*` used for sidebar/breadcrumb via `tnav()`/`NAV_KEY_MAP` in `DashboardLayout.js`
- [ ] Don't translate: brand terms, language names, data values that flow into `===` or API payloads

## 7. API-layer translation strategy

The API surface (~330 error strings, 304 route files) must not be key-wired string-by-string first. Recommended order:

1. **Shared guards first** (highest leverage):
   - `src/lib/auth.js` — replace the 4 literals with keys (`errors.authRequired`, `errors.insufficientPermissions`, `errors.authSystemFailure`, `errors.authzSystemFailure`) and have the client render `t(key)`.
   - `src/lib/api/createHandler.js` — stop forwarding raw `e.message` to clients. Return a stable generic key (`errors.internal`) and log `e.message` server-side only.
2. **Frontend mapping table** (option b) for success messages: server keeps raw English success strings; the client maps known messages → `t(...)` at toast time, falling back to the raw string for unknown ones.
3. Only after 1–2, key-ify high-traffic per-route errors that users actually see (validation, not-found, forbidden).

Never translate inside `alert()` flows that compare the string afterward; treat API strings as data, translated at the edge (client).

**Status on branch `Abel` (implemented):** shared guards (`requireAuth`, `requireCapability`, `requireProjectAccess`, `requireCapabilityV2`) now return keys — `errors.authRequired`, `errors.insufficientPermissions`, `errors.authSystemFailure`, `errors.authzSystemFailure`; `createHandler`'s catch-all returns `errors.somethingWrong` (real message logged server-side only); `errors.notFound` added for future venture-404 wiring. Five new keys in `errors.json` (EN + FR). Client edge: the global `impactos:notify` toast listener (`src/components/ui/GlobalToast.js`) and the auth/profile error displays (login, register-*, forgot-password, setup-password, activate, invite, `ProfileView`, investor profile) wrap API errors with `t(X || "") || X` — safe for both keys and raw strings. Completed after the initial pass: the app-wide client sweep wrapped ~275 user-visible API-error display sites across `src/app` + `src/components` with `t(X || "") || X` (including the `t`-shadow fix in `admin/programs/new/page.js`), and 67 bare `"Not found"` 404 literals across 30 `src/app/api/**/route.js` files were converted to `errors.notFound` (including all venture access-404 callers). Remaining long tail (documented, low priority): compound not-found messages (e.g. `"Venture not found"`), per-route validation/forbidden prose, and per-route success-message keying (option b).

## 8. Known gaps & follow-up work

1. **223 IDENTICAL FR keys** (§2) — translate them; densest in `vadmin.json`, `adminMisc.json`, `venture.json`, `investorAdmin.json`.
2. **`src/lib/locales.js` missing `team` namespace** — `team.json` exists in EN+FR (fully translated, 60 keys) but was never imported; `team.*` keys silently never load. Add the 4 registration lines (§5.3). *(FIXED on branch `Abel` — verified.)*
3. **`DashboardLayout.js` literals** — `Main Operations` (L134) and `User Protocol` (L241) headers render raw; keys `navigation.mainOperations` / `navigation.userProtocol` exist in both languages, so only the JSX needs `{t(...)}`. *(FIXED on branch `Abel` — verified.)*
4. **`platform/scores/page.js` merge conflicts** — 5 unresolved `<<<<<<<` blocks (exportCSV, dual-range slider, statThreshold label, selectAllPending count, noRespondents). Must be resolved toward the `t()` side before wiring continues. *(FIXED on branch `Abel` — verified.)*
5. **Breadcrumb literals** — `DashboardLayout.js` renders `ImpactOS` and `Dashboard` literally (path-derived label, `teacher`→`Instructor` replacement) with no `navigation.*` keys. *(FIXED on branch `Abel` — breadcrumb literals wired via `navigation.impactOs`, `navigation.instructor`, `navigation.dashboard`; unknown path segments pass through unchanged.)*
6. **Staging/impersonation banner** — hardcoded English (`STAGING ENVIRONMENT — Impersonating: ...`). *(FIXED on branch `Abel` — banner wired via `navigation.stagingBannerTitle`/`navigation.stagingBannerDesc` with {name}/{role} params.)*
7. **`admin/system/page.js` raw values** — `environment`, `component`, `status` render verbatim (icons/colors are mapped, labels are not). Apply the §6.4 lookup-map pattern. *(FIXED on branch `Abel` — COMPONENT_LABELS / STATUS_LABELS / ENV_LABELS / SEVERITY_LABELS / JOB_STATUS_LABELS / REPORT_TYPE_LABELS lookup maps added; `adminMisc.system.{components,statuses,environments,severities,jobStatuses,reportTypes}.*` keys in EN+FR; unknown DB values still fall back to raw.)*
8. **`investor.json` unwrapped** — legacy root-level keys used by `t("pipeline")`-style calls; conformance to the §4.2 convention requires updating investor call sites.
9. **Inverted lookup pattern** — was `STAGE_LABELS[t(p.stage)] || p.stage` in `investor/dashboard/page.js`. *(FIXED on branch `Abel` in two steps: (1) removed the bogus `t()` wrapper (`STAGE_LABELS[p.stage] || p.stage`), then (2) converted `STAGE_LABELS` to map raw → root i18n keys and wrapped all 6 usage sites as `t(STAGE_LABELS[x] || "")` with a `|| raw` fallback on the pipeline badge; `<option>` values and `===` comparisons stay raw; investor root keys reused, FR values present.)*
10. **Zombie `useI18n` imports** — scan complete: 10 files had `useI18n` with 0 `t()` calls. *(FIXED on branch `Abel` — dead `t` bindings/imports removed from 8 files: `admin/work`, `investor/history`, `participant/[id]`, `participant`, `pm/submissions`, `staff/dashboard`, `finance/SummaryCard`, `ParticipantDashboardHome`.)* *(WIRED on branch `Abel` — `platform/runs/review/[submissionId]`, `ProgramListing`, and `ParticipantDashboardHome` now all call `t()`.)*
11. **`toLocaleString("fr-FR", ...)` hardcode** — *(VERIFIED NON-ISSUE — no `"fr-FR"` string exists anywhere in `src/`; `admin/ventures/[id]/analytics/page.js` uses locale-less `toLocaleString()`, which follows the runtime default locale.)*
12. **Mass-wiring backlog** — *(CLEARED on branch `Abel` — `staff/dashboard`, `pm/submissions`, `investor/history`, `admin/work`, `ParticipantDashboardHome`, `ProgramListing`, and `platform/runs/review/[submissionId]` are fully wired (~220 `t()` call sites, all new keys in EN+FR, parity `Missing: 0`); `SummaryCard`, `participant/[id]`, and `participant` were pure wrappers with no literals.)* New pages must follow §6 going forward. Also: the `adminMisc.work.column.*` keys that rendered as raw key strings in the kanban board were added (nested object, EN+FR), fixing that display bug.

---

*Audit data captured on branch `Abel`. Percentages/derived numbers are approximations from the three audit passes; exact string counts should be re-derived with a script before external reporting.*

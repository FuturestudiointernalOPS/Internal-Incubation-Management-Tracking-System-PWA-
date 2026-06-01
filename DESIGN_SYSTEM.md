# ImpactOS Design System — Developer Guide

## 1. Theme Architecture

ImpactOS uses a **CSS custom property (variable) system** with a `data-theme` attribute on `<html>`.

- **Light mode**: `:root` (default)
- **Dark mode**: `:root[data-theme='dark']`

Theme is:
1. Set **before React hydrates** via an inline `<script>` in `src/app/layout.js`
2. Managed at runtime by `<ThemeProvider>` from `src/lib/ThemeProvider.js`
3. Persisted in `localStorage` under key `impactos_theme`

### Theme Hook

```jsx
import { useTheme } from "@/lib/ThemeProvider";

function MyComponent() {
  const { theme, toggleTheme, setTheme, mounted } = useTheme();
  // theme: "dark" | "light"
  // toggleTheme: () => void
  // setTheme: (theme: "dark" | "light") => void
}
```

---

## 2. Available Design Tokens

### Backgrounds & Surfaces

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--bg-primary` | `#F8FAFC` | `#020617` | Page background |
| `--surface-1` | `#FFFFFF` | `#0F172A` | Cards, modals, tables |
| `--surface-2` | `#F8FAFC` | `#1E293B` | Hover states, table headers |
| `--surface-3` | `#F1F5F9` | `#334155` | Subtle backgrounds, disabled |

**Tailwind classes**: `bg-surface-1`, `bg-surface-2`, `bg-surface-3`

### Text

| Token | Light | Dark | WCAG | Usage |
|-------|-------|------|------|-------|
| `--text-primary` | `#0F172A` | `#F8FAFC` | ✅ | Headings, body text |
| `--text-secondary` | `#475569` | `#94A3B8` | ✅ AA | Labels, metadata, captions |
| `--text-tertiary` | `#94A3B8` | `#64748B` | — | Placeholders, disabled text |

**Tailwind utility classes**: `text-muted` (secondary), `.text-tertiary`

### Borders

| Token | Light | Dark |
|-------|-------|------|
| `--border-primary` | `#E2E8F0` | `#334155` |
| `--border-secondary` | `#F1F5F9` | `#1E293B` |

**Tailwind utility class**: `.border-soft`

### Brand & Accent

| Token | Value |
|-------|-------|
| `--brand-orange` | `#FF6600` |
| `--brand-blue` | `#0066FF` |
| `--accent` | `var(--brand-orange)` |

### Chart Colors

| Token | Light | Dark |
|-------|-------|------|
| `--chart-primary` | `#FF6600` | `#FF6600` |
| `--chart-success` | `#10B981` | `#34D399` |
| `--chart-danger` | `#EF4444` | `#F87171` |
| `--chart-warning` | `#F59E0B` | `#FBBF24` |
| `--chart-info` | `#6366F1` | `#818CF8` |

### Semantic Status Colors (Keep as-is — not themed)

These are status indicators and should remain the same color in both themes:

- **Success**: `text-emerald-500`, `bg-emerald-500/10`
- **Danger**: `text-rose-500`, `bg-rose-500/10`
- **Warning**: `text-amber-500`, `bg-amber-500/10`
- **Info**: `text-indigo-500`, `bg-indigo-500/10`

### Radii & Transitions

| Token | Value |
|-------|-------|
| `--radius-sm` | `0.375rem` |
| `--radius-md` | `0.75rem` |
| `--radius-lg` | `1rem` |
| `--transition-fast` | `150ms` |

**Tailwind class**: `rounded-[var(--radius-md)]`

---

## 3. Reusable Components

All located in `src/components/ui/`. Import them directly:

```jsx
import AppCard from "@/components/ui/AppCard";
import AppInput from "@/components/ui/AppInput";
import AppSelect from "@/components/ui/AppSelect";
import AppButton from "@/components/ui/AppButton";
import AppBadge from "@/components/ui/AppBadge";
import AppModal from "@/components/ui/AppModal";
import AppTable from "@/components/ui/AppTable";
```

### Usage Examples

```jsx
// Card
<AppCard padding="lg" hover>
  <h2>Content</h2>
</AppCard>

// Input with icon
<AppInput
  label="Email"
  icon={Mail}
  placeholder="user@example.com"
  error={validationError}
/>

// Button
<AppButton variant="primary" size="lg" icon={Plus} onClick={handleCreate}>
  Create Program
</AppButton>

// Table
<AppTable
  columns={[
    { key: "name", label: "Name" },
    { key: "status", label: "Status", render: (val) => <AppBadge variant={val}>{val}</AppBadge> },
  ]}
  data={items}
  onRowClick={(row) => router.push(`/item/${row.id}`)}
/>

// Modal
<AppModal isOpen={showModal} onClose={() => setShowModal(false)} title="Confirm Action" size="md">
  <p>Are you sure?</p>
</AppModal>

// Badge
<AppBadge variant="success" dot>Active</AppBadge>
```

---

## 4. Rules — Do This, Not That

### 🟢 DO

| Rule | Example |
|------|---------|
| Use CSS variables for all colors | `color: "var(--text-primary)"` or `text-[var(--text-primary)]` |
| Use background/surface tokens | `var(--surface-1)`, `bg-surface-1` |
| Use text tokens for hierarchy | `--text-primary` (body), `--text-secondary` (labels), `--text-tertiary` (placeholders) |
| Use chart tokens for data viz | `var(--chart-success)`, `var(--chart-danger)` |
| Use `useTheme()` hook for theme toggling | `const { toggleTheme } = useTheme()` |
| Use reusable components | `AppCard`, `AppInput`, `AppButton`, `AppTable`, etc. |
| Use semantic colors for status only | `text-emerald-500` on success badges, `text-rose-500` on errors |

### 🔴 DON'T

| Rule | Example of what to avoid |
|------|--------------------------|
| Don't use hardcoded hex colors in JSX | ❌ `#fff`, `#0a0a1a`, `#f1f5f9`, `#94a3b8` |
| Don't use Tailwind slate colors for text | ❌ `text-slate-500`, `text-slate-400`, `text-slate-600` |
| Don't use Tailwind white/black for theme | ❌ `text-white`, `bg-white/5`, `text-black` (except brand buttons) |
| Don't hardcode `data-theme` directly | ❌ `document.documentElement.setAttribute('data-theme', ...)` — use `useTheme()` |
| Don't add new hex color constants in pages | ❌ `const BG = '#0a0a1a'` |
| Don't use Tailwind `dark:` variant | ❌ `dark:hidden`, `dark:block` — these respond to OS preference, not our theme |

---

## 5. Global CSS Classes Available

```css
.card              /* Standard card container */
.btn               /* Base button */
.btn-primary       /* Orange brand button */
.btn-secondary     /* Outlined button */
.table-container   /* Wrapper for data tables */
.data-table        /* Table styling */
.nav-item          /* Sidebar navigation item */
.status-badge      /* Status pill */
.text-muted        /* Secondary text color */
.text-tertiary     /* Tertiary text color */
.border-soft       /* Border color */
.surface-1         /* Surface-1 background */
.surface-2         /* Surface-2 background */
.surface-3         /* Surface-3 background */
```

---

## 6. File Organization

```
src/
├── app/
│   ├── globals.css          ← All CSS variables & global styles
│   ├── layout.js            ← Pre-hydration script + ThemeProvider
│   └── ...
├── components/
│   ├── layout/
│   │   └── DashboardLayout.js  ← Uses useTheme() for toggle
│   └── ui/
│       ├── AppCard.js
│       ├── AppInput.js
│       ├── AppSelect.js
│       ├── AppButton.js
│       ├── AppBadge.js
│       ├── AppModal.js
│       └── AppTable.js
├── lib/
│   ├── ThemeProvider.js     ← Central theme context
│   └── ...
└── tailwind.config.js       ← Maps bg-surface-1/2/3 utilities
```

---

## 7. Adding a New Page (Checklist)

- [ ] Page background uses `var(--bg-primary)` or Tailwind class
- [ ] Cards use `AppCard` or `var(--surface-1)`
- [ ] All text uses `var(--text-primary)` / `var(--text-secondary)` / `var(--text-tertiary)`
- [ ] No hex colors, no `text-slate-*`, no `text-white`/`text-black`
- [ ] Inputs use `AppInput` or `var(--bg-primary)` + `var(--border-primary)`
- [ ] Buttons use `AppButton`
- [ ] Tables use `AppTable`
- [ ] Modals use `AppModal`
- [ ] Theme toggle uses `useTheme()` hook
- [ ] Status colors (emerald/rose/amber/indigo) used only for semantic meaning
- [ ] Chart colors use `var(--chart-*)` tokens

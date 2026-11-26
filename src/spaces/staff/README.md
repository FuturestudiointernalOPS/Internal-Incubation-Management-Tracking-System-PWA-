# Staff space

Where an **internal function** works. It is reached through one shell, at
`/staff`, and every context below is a section inside that shell.

| Context | What makes it true | Current address |
| --- | --- | --- |
| Core operations | every staff identity | `/staff` |
| Programme manager | the programme-manager profile | `/staff/program-manager` |
| Lead manager | at least one venture assignment | `/staff/ventures` |
| Finance | the finance responsibility or role | `/staff/finance` |
| CRM | the CRM responsibility or role | `/staff/crm` |
| Creation | a creation capability | `/staff/create` |

Where the code lives:

```text
src/spaces/staff/
├── core/
│   └── components/        ← the staff dashboard, tasks, projects, op-report
└── program-manager/
    └── components/        ← the programme workspace, unified dashboard, panels
```

A context's folder receives its screens and components as it migrates. Its
route folder (`src/app/staff/<context>/`) stays a thin entry point.

`contexts.js` declares what makes each context true (lead manager, programme
manager). Finance and CRM open from the capability projection, not from this
file.

Rules:

- The shell (and the guard) is rendered **once**, by the space layout. A
  context that moves under `/staff` must not re-wrap itself in another shell.
- Screens and components for a context live in `src/spaces/staff/<context>/`.
- Nothing here imports from `src/spaces/member`.
- Old addresses redirect here (see `next.config.mjs`); links inside the app must
  use the new ones.

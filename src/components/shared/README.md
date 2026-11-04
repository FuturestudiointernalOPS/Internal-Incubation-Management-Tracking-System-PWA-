# Shared components

Components that **two or more spaces** genuinely use. They are the alternative to
copying the same screen into two space folders.

| Folder | Used by |
| --- | --- |
| `calendar/` | staff dashboard and the admin dashboard (`StaffCalendar`, models, modals) |
| `dashboard/` | member, staff and admin (profile, assignments, progress, dashboards) |
| `ventures/console/` | admin, staff and member (the operating venture console) |
| `ventures/workspace/` | member and staff (the venture workspace screen and its model) |
| `lms/` | member, staff and admin (courses, player, authoring) |
| `messaging/` | member, staff and admin (chat, threads) |
| `tasks/` | staff and admin (task manager, detail) |
| `create/` | member, staff and admin (the delegated creation actions) |
| `contacts/` | staff CRM screens (and the shared CRM domain) |
| `crm/` | admin CRM and staff CRM |
| `kit/staff.css` | every role (the `stf-*` interface kit, loaded once by the root layout) |
| `notify.js` | staff, admin and any screen that raises a toast |

Rules:

- **A component used by one context lives in that context**
  (`src/spaces/<space>/<context>/components/`), not here.
- **A component used by two spaces lives here**, once. Never copy it into both.
- **The neutral design kit stays in `src/components/ui/`** (cards, tables,
  buttons, badges). This folder is for domain components, not primitives.
- Nothing here imports a space (`@/spaces/**`): shared code must not depend on
  the screen that happens to use it first. Enforced by
  `src/__tests__/spaces-boundaries.test.js`.

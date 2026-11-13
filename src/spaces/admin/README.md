# Admin space

Where the **platform owner** works. One identity (`super_admin`), one shell, one
address family (`/admin`, plus the form runner at `/platform`).

The space is already a single route tree; this folder is where its screens and
components move, grouped by functional domain so a file's home is predictable:

| Domain | What it covers |
| --- | --- |
| Platform owner | access, permissions, security, settings, audit |
| Programmes | programmes, projects, teams, curriculum, reviews |
| Ventures | venture console, journey, documents, reporting |
| Finance | finance console and reporting |
| CRM | contacts, organisations, leads, pipelines |
| Intelligence | reports, metrics, knowledge, LMS |

Rules:

- Nothing here imports from `src/spaces/staff` or `src/spaces/member`.
- A screen that both the admin and another space legitimately need belongs in
  `src/components/shared/`, never copied into two spaces.

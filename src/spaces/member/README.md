# Member space

Where a **person** works in their own programmes, ventures and learning.

It is not a function and not a job: the same account can hold several contexts
at once, and each context contributes its own screens and doors.

| Context | What makes it true | Address | Components |
| --- | --- | --- | --- |
| Investor | an approved investor profile | `/member/investor` | `investor/components/` |
| Founder | an owned venture membership | `/member/founder` | shared venture workspace |
| Programme participant | an active programme membership | `/member/participant` | `participant/components/` |
| Venture member | a venture membership that is not an ownership | `/member/participant/ventures` | `shared/ventures/workspace/` |
| Learner | a live course enrolment | `/member/participant/learning` | `shared/lms/` |
| Facilitator | a facilitation assignment | `/member/facilitator` | `facilitator/components/` |
| Team | a team account | `/member/team` | `team/components/` |

The space hub is `/member` (what used to be the neutral workspaces page).

The contexts themselves are declared in `contexts.js` of this folder: what makes
each one true, which doors it adds, and in which order. The shell only composes
them. Adding a context is one entry there, not a change to the navigation hook.

Rules:

- A context is **cumulative** — a founder who studies is both, never one.
- Screens and components for a context live in `src/spaces/member/<context>/`.
  A piece two contexts (or two spaces) need lives in
  `src/components/shared/`, never in two copies.
- Nothing here imports from `src/spaces/staff` or `src/spaces/admin`.
- Old addresses (`/participant`, `/founder`, `/investor`, `/facilitator`,
  `/team`, `/workspaces`) redirect here; links inside the app use the new ones.

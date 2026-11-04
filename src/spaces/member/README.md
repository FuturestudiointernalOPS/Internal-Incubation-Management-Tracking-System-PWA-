# Member space

Where a **person** works in their own programmes, ventures and learning.

It is not a function and not a job: the same account can hold several contexts
at once, and each context contributes its own screens and doors.

| Context | What makes it true | Owns |
| --- | --- | --- |
| Investor | an approved investor profile | the investor space |
| Founder | an owned venture membership | the founder screens |
| Programme participant | an active programme membership | programmes, certificates |
| Venture member | a venture membership that is not an ownership | the venture workspace |
| Learner | a live course enrolment | my learning |
| Facilitator | a facilitation assignment | facilitator screens |
| Team | a team account | the team workspace |

Rules:

- A context is **cumulative** — a founder who studies is both, never one.
- Screens and components for a context live in `src/spaces/member/<context>/`.
- Nothing here imports from `src/spaces/staff` or `src/spaces/admin`.
- The URLs stay under the personal prefixes (`/participant`, `/founder`,
  `/investor`, `/facilitator`, `/team`, `/workspaces`) until the member phase of
  the migration moves them under `/member`.

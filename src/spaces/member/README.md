# Member space

Where a **person** works in their own programmes, ventures and learning.

It is not a function and not a job: the same account can hold several contexts
at once, and each context contributes its own screens and doors.

## One dashboard, for everyone

Every member opens the same page: **`/dashboard`**. The address is served by a
rewrite (see `src/spaces/redirects.js` for the list and `next.config.mjs` for
the wiring) to the screen at `/member/dashboard`, so the space's sidebar is
mounted once and never remounted when moving between the dashboard and a
context.

The page is not a participant dashboard with extras. It is composed of
**sections**, and a section exists only when the person holds the relationship
behind it — the server builds the block, the screen draws what it received. A
person with no program seat receives no program block at all.

| Section | Opened by |
| --- | --- |
| Program | a program seat (active, pending or completed) |
| Facilitation | an actual facilitator assignment |
| Ventures | a venture membership (founders also get the founder door) |
| Learning | a live course enrolment |
| Investor | an approved investor profile |

Always shown, whatever the profile: the personal agenda, the announcements and
any allowed creation action. The retired per-profile dashboards
(`/member/participant`, `/member/founder`, `/member/facilitator`,
`/member/investor/dashboard`) now redirect to `/dashboard`; their detail screens
are untouched.

The **investor** keeps the full browser it used to have: the investor section's
main door opens `/member/investor/deal-flow`, which carries discovery with
filters, the pipeline, the watchlist, campaigns, upcoming meetings, comparison
and introduction requests. The dashboard only summarises those figures and
links there.

| Context | What makes it true | Address | Components |
| --- | --- | --- | --- |
| Investor | an approved investor profile | `/member/investor` | `investor/components/` |
| Founder | an owned venture membership | `/member/founder` (meetings) | shared venture workspace |
| Programme participant | an active programme membership | `/member/participant` | `participant/components/` |
| Venture member | a venture membership that is not an ownership | `/member/participant/ventures` | `shared/ventures/workspace/` |
| Learner | a live course enrolment | `/member/participant/learning` | `shared/lms/` |
| Facilitator | a facilitation assignment | `/member/facilitator` | `facilitator/components/` |
| Team | a team account | `/member/team` | `team/components/` |

The space hub is `/member` (the list of the person's contexts). It is no longer
a landing destination: every member lands on `/dashboard`, and the hub is one
link away.

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

# White-Label OS — Management demonstration

Open **ImpactOS_White_Label_Demo.html** directly in a browser by double-clicking
the file. You can also send this single HTML file to a reviewer. No installation,
application server, account or database connection is required.

## Suggested presentation (3 minutes)

1. Start with Horizon Innovation Lab, a fictional enterprise. Show its programme
   list, use search and open a programme detail.
2. Select Nova University. Its fictional programme list is different. This is a
   visual simulation, not proof of backend security.
3. Select the suspended scenario: programme content is hidden, while the example
   explains that records are retained.
4. Select Future Studio supervision. Without the simulated read mandate, access
   is denied. Enable it, open a programme and show the simulated consultation log.
   Switching organisations clears the simulated mandate.
5. Show LMS and Venture as future increments, then explain the three delivery
   statements at the bottom: locally implemented, visually illustrated, remaining.

The interface is available in French and English and adapts to smaller screens.
Reset restores the fictional initial state. Reloading clears the simulated log.

## Scope and limitations

This is an autonomous presentation artifact, not an authenticated client portal.
All records, counts, programme dates and access decisions are fictional and held
in browser memory. The HTML source contains both fictional organisations.
Its network policy prohibits connections; it contains no external scripts,
analytics, fonts, API calls, cookies or database credentials.

The UI does not create supervision mandates, authenticate users, suspend accounts
or write real audit events. The real backend and its tests are described in
[the solo progress report](../../white-label-phase0/PLAN_SOLO.md).
A separate authenticated client portal is implemented locally at `/o/select`;
this offline demonstration remains independent of it. Client activation and
end-to-end browser validation are still pending. Consult the progress report
for the latest compilation result.

Translation source: `common.whiteLabelDemo` in the English and French locale
files; this subset is embedded in the HTML so it can open offline.

## Verification

JavaScript syntax and English/French key parity passed (73 keys per language).
Offline smoke checks exercised client switching, suspension, mandate reset,
simulated audit, future modules, search, reset and English rendering using Node
with a minimal document stub. These checks do not replace visual browser review.
No application build or database was needed for this autonomous HTML artifact.

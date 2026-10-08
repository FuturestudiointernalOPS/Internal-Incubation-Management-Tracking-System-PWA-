/**
 * ProgramMembership model — data access for program-staff assignments
 * (v2_program_staff + the generalized contact_roles mirror) and participant
 * program enrollment / program rosters.
 *
 * This file is a thin BARREL over cohesive modules in the sibling
 * `models/programMembership/` folder (the split convention: `x.js` + `x/`):
 *
 *   programStaff.js            — /api/program-staff assignment CRUD + mirror
 *   v2ProgramStaff.js          — /api/v2/program-staff (PM-scoped) management
 *   participantPrograms.js     — /api/participant/programs dashboard reads
 *   participantProgramDetail.js— /api/participant/programs/[id] detail reads
 *   contactPrograms.js         — /api/contacts/[cid]/programs history
 *
 * Sources migrated from route controllers (docs/MVC_REFACTOR.md Wave 2):
 *  - /api/program-staff
 *  - /api/v2/program-staff
 *  - /api/participant/programs
 *  - /api/participant/programs/[id]
 *  - /api/contacts/[cid]/programs
 *
 * Each function wraps exactly one SQL statement. SQL is byte-identical to the
 * queries that used to live inline in the controllers, so behavior is unchanged.
 *
 * Model-layer rules (see docs/MVC_REFACTOR.md §4):
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data/outcome it returns.
 */

export * from "./programMembership/programStaff";
export * from "./programMembership/v2ProgramStaff";
export * from "./programMembership/participantPrograms";
export * from "./programMembership/participantProgramDetail";
export * from "./programMembership/contactPrograms";

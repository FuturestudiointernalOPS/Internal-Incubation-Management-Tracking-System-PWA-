
/**
 * Investor relations model — data access for the investor relationship and
 * account controllers under `src/app/api/investor/`:
 *
 *   src/app/api/investor/relationships/route.js            (12 queries)
 *   src/app/api/investor/relationships/meetings/route.js   (10 queries)
 *   src/app/api/investor/meetings/route.js                 ( 2 queries)
 *   src/app/api/investor/organizations/route.js            ( 8 queries)
 *   src/app/api/investor/profile/route.js                  ( 6 queries)
 *   src/app/api/investor/decisions/route.js                ( 6 queries)
 *   src/app/api/investor/approval/route.js                 ( 5 queries)
 *   src/app/api/investor/watchlist/route.js                ( 4 queries)
 *   src/app/api/investor/preferences/route.js              ( 2 queries)
 *   src/app/api/investor/setup-password/route.js           ( 2 queries)
 *   src/app/api/investor/campaigns/route.js                (10 queries)
 *
 * Each function wraps exactly one SQL statement. SQL is byte-identical to the
 * queries that used to live inline in the controllers, so behavior is unchanged.
 *
 * Model-layer rules (see docs/MVC_REFACTOR.md):
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data it returns.
 *
 * Note: extraction is strictly 1:1 with the original inline call sites, so
 * lookups that repeat the same SQL across routes (e.g. the investor_profiles
 * id-by-user_id resolver) intentionally have one function per call site.
 */

export * from "./investorRelations/relationships";
export * from "./investorRelations/provisioningAndProfile";
export * from "./investorRelations/portalAndCampaigns";

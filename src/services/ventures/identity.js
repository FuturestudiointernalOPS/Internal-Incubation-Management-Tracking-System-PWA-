/**
 * VENTURE IDENTITY — the access key, resolved to the stored identifier.
 *
 * A route carries the decorative code ("VNT-…"); a table stores the internal id
 * (`ventures.id`). This is the service-layer door onto the one resolver that
 * turns the first into the second, so a service or a route never has to know
 * which identifier it is holding. See docs/VENTURE_IDENTITY_PHASE0.md.
 *
 * The statement and the fallback rule live in `@/models/ventureIdentityStore`,
 * so model files can use the same resolver without importing from `@/services`.
 */

export { resolveVentureInternalId } from "@/models/ventureIdentityStore";

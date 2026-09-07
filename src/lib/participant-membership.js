/**
 * Facade — kept during the MVC migration so existing importers of
 * "@/lib/participant-membership" keep resolving unchanged.
 * New code should import from "@/models/participant-membership".
 */
export * from "@/models/participant-membership";

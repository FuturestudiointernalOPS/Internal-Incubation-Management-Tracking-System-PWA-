/**
 * Facade — kept during the MVC migration so existing importers of
 * "@/lib/lms/public" keep resolving unchanged.
 * New code should import from "@/models/lms/public".
 */
export * from "@/models/lms/public";

/**
 * Facade — kept during the MVC migration so existing importers of
 * "@/lib/lms/errors" keep resolving unchanged.
 * New code should import from "@/models/lms/errors".
 */
export * from "@/models/lms/errors";

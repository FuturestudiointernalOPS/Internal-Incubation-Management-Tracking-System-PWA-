/**
 * Facade — kept during the MVC migration so existing importers of
 * "@/lib/lms/validation" keep resolving unchanged.
 * New code should import from "@/models/lms/validation".
 */
export * from "@/models/lms/validation";

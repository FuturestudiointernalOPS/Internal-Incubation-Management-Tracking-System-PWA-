/**
 * Facade — kept during the MVC migration so existing importers of
 * "@/lib/lms/helpers" keep resolving unchanged.
 * New code should import from "@/models/lms/helpers".
 */
export * from "@/models/lms/helpers";

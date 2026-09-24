/**
 * Facade — kept during the MVC migration so existing importers of
 * "@/lib/lms/checkout" keep resolving unchanged.
 * New code should import from "@/models/lms/checkout".
 */
export * from "@/models/lms/checkout";

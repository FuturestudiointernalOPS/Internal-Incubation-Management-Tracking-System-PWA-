/**
 * Facade — kept during the MVC migration so existing importers of
 * "@/lib/lms/registrations" keep resolving unchanged.
 * New code should import from "@/models/lms/registrations".
 */
export * from "@/models/lms/registrations";

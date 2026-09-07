/**
 * Facade — kept during the MVC migration so existing importers of
 * "@/lib/lms/certificates" keep resolving unchanged.
 * New code should import from "@/models/lms/certificates".
 */
export * from "@/models/lms/certificates";

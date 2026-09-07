/**
 * Facade — kept during the MVC migration so existing importers of
 * "@/lib/contact-groups" keep resolving unchanged.
 * New code should import from "@/models/contact-groups".
 */
export * from "@/models/contact-groups";

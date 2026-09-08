/**
 * Facade — kept during the MVC migration so existing importers of
 * "@/lib/contact-group-sync" keep resolving unchanged.
 * New code should import from "@/models/contact-group-sync".
 */
export * from "@/models/contact-group-sync";

/**
 * Facade — kept during the MVC migration so existing importers of
 * "@/lib/invitations" keep resolving unchanged.
 * New code should import from "@/models/invitations".
 */
export * from "@/models/invitations";

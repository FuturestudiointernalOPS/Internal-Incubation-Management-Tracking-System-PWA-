"use client";

export const dynamic = "force-dynamic";

import CreationAccessGuard from "@/components/create/CreationAccessGuard";

/**
 * CREATION — the delegated creation surface, inside the STAFF space.
 *
 * The staff layout (`src/app/staff/layout.js`) already renders the shell, so
 * this layout only adds the gate: it lets in someone who holds at least one
 * creation capability (`programs.create`, `ventures.create`, `investor.create`),
 * wherever that capability was granted.
 */
export default function CreateLayout({ children }) {
  return <CreationAccessGuard>{children}</CreationAccessGuard>;
}

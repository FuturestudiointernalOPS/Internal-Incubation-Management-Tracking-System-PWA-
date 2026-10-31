import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireAuthorization } from "@/models/authorization/index";

export const dynamic = "force-dynamic";

/**
 * A CRM activity is HISTORY, and the history is append-only (product decision,
 * Lot 1): a recorded activity is never edited or deleted after the fact. A
 * correction is a new entry, so the relationship keeps its memory and the
 * timeline can be trusted.
 *
 * The routes stay declared — the catalogue and the capability floor are part of
 * the contract — but the write itself is refused. The screens no longer offer
 * either action; this is the server agreeing with them.
 */

function appendOnlyRefusal() {
  return NextResponse.json(
    { success: false, error: "crm.activities.historyAppendOnly" },
    { status: 409 },
  );
}

export const PATCH = createHandler(
  async () => {
    const authError = await requireAuthorization("crm", "edit");
    if (authError) return authError;

    return appendOnlyRefusal();
  },
);

export const DELETE = createHandler(
  async () => {
    const authError = await requireAuthorization("crm", "delete");
    if (authError) return authError;

    return appendOnlyRefusal();
  },
);

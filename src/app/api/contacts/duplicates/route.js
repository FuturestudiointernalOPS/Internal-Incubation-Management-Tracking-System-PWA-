import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";
import { requireAuthorization } from "@/lib/authorization";
import {
  getPendingDuplicateFlags,
  dismissDuplicateFlag,
} from "@/models/contacts";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;
    const capError = await requireAuthorization("contacts", "view");
    if (capError) return capError;

    // Cap the result set so a large backlog of pending flags can't blow up
    // the response. Defaults to 200, override with ?limit= (max 500).
    const { searchParams } = new URL(req.url);
    const limitRaw = parseInt(searchParams.get("limit") || "", 10);
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0
        ? Math.min(limitRaw, MAX_LIMIT)
        : DEFAULT_LIMIT;

    const flags = await getPendingDuplicateFlags(limit);

    const result = flags.rows.map(
      ({ contact_a_name, contact_a_email, contact_b_name, contact_b_email, ...rest }) => ({
        ...rest,
        contact_a: { name: contact_a_name, email: contact_a_email },
        contact_b: { name: contact_b_name, email: contact_b_email },
      }),
    );

    return NextResponse.json({ success: true, flags: result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error?.message || "errors.somethingWrong" },
      { status: 500 },
    );
  }
}

export async function DELETE(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;
    const capError = await requireAuthorization("contacts", "edit");
    if (capError) return capError;

    const session = await getSession();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id)
      return NextResponse.json(
        { success: false, error: "errors.required" },
        { status: 400 },
      );

    // Only dismiss flags that are still pending; never overwrite a merged flag.
    const result = await dismissDuplicateFlag(id, session?.cid || null);

    if (!result.rowsAffected) {
      return NextResponse.json(
        { success: false, error: "errors.notFound" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error?.message || "errors.somethingWrong" },
      { status: 500 },
    );
  }
}

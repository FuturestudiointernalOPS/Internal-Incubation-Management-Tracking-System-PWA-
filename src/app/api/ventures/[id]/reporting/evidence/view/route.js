import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireAuthorization } from "@/models/authorization/index";
import { requireVentureScopedAccess } from "@/lib/ventureScopedAccess";
import { selectVentureIdentity, countEvidenceReferences } from "@/models/ventureReportingStore";
import { signEvidencePath, evidenceStoragePath } from "@/lib/ventureEvidence";

/**
 * GET /api/ventures/[id]/reporting/evidence/view?path=…
 *
 * Opens ONE private evidence file. The founder who recorded it can read it, and
 * so can a reviewer holding `ventures.validate` — which is the whole point: the
 * studio used to see "evidence attached" and nothing else.
 *
 * Two guards, both necessary:
 *   1. the path must be recorded against THIS Venture (an arbitrary path is
 *      never signed);
 *   2. the file is returned as a short-lived signed URL, never a public one.
 *
 * An external link is not signed here — the caller opens it directly.
 */
export const GET = createHandler(async (req, { params }) => {
  const { id } = await params;

  // A reviewer is not necessarily a member of the Venture, so the capability
  // comes first; otherwise the founder's own scoped right applies.
  const authError = await requireAuthorization("ventures", "validate");
  if (authError) {
    const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "view" });
    if (access.error) return access.error;
  }

  const venture = await selectVentureIdentity(id).catch(() => ({ rows: [] }));
  const resolved = (venture.rows || [])[0] || null;
  if (!resolved) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

  const raw = new URL(req.url).searchParams.get("path") || "";
  const path = evidenceStoragePath(raw);
  if (!path) {
    return NextResponse.json(
      { success: false, error: "venture.reporting.evidence.notAFile" },
      { status: 400 },
    );
  }

  const owned = await countEvidenceReferences(resolved.id, raw.trim());
  if (Number(owned.rows?.[0]?.total || 0) === 0) {
    return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
  }

  const url = await signEvidencePath(path);
  if (!url) {
    return NextResponse.json(
      { success: false, error: "venture.reporting.evidence.unavailable" },
      { status: 502 },
    );
  }

  return NextResponse.json({ success: true, url });
});

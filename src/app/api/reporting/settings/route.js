import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireAuthorization } from "@/models/authorization/index";
import { getAuthorizationContext } from "@/models/authorization/index";
import { authorize } from "@/models/authorization/index";
import { isInternalVentureIdentity } from "@/services/ventures/portfolioAccess";
import { getReportingSettings, updateReportingSettings, updateGlossary } from "@/services/ventures/reporting/settings";
import { dueDateFor } from "@/services/ventures/reporting/schedule";
import { currentPeriod } from "@/services/ventures/reporting/rules";
import { currentQuarter } from "@/services/ventures/reporting/quarterlyRules";

/**
 * GET/PUT /api/reporting/settings
 *
 * The studio's reporting configuration: stage thresholds, the traffic-light
 * bands of spec §11, and WHEN a report is due. Gated on `ventures.setup`
 * (level 3) — the existing configuration right, so it can be delegated without
 * granting `ventures.edit` on any Venture. The glossary is the shared
 * vocabulary, so it additionally requires the portfolio-write right
 * (`ventures.edit_all`), which the owner holds by default and can have revoked.
 *
 * These are GLOBAL settings, which is why the path is not under /ventures/[id].
 */
export const GET = createHandler(async (req) => {
  // The studio's reporting configuration is a staff surface.
  if (!isInternalVentureIdentity(req.session?.role)) {
    return NextResponse.json(
      { success: false, error: "errors.insufficientPermissions" },
      { status: 403 },
    );
  }

  const authError = await requireAuthorization("ventures", "setup", 3);
  if (authError) return authError;

  const { settings, defaults, overrides, businessModels, bands, glossary, definitions, groups } =
    await getReportingSettings({});

  // The glossary is READABLE by the studio; changing it needs the portfolio
  // write right (the owner's default, revocable). The flag lets the screen
  // render it read-only rather than offering a form that would be refused.
  const authContext = await getAuthorizationContext(req.session).catch(() => null);
  const canEditGlossary = Boolean(
    authContext && authorize(authContext, "ventures", "edit_all"),
  );

  // The next due dates, computed from the same numbers the screen edits — so
  // changing the day visibly moves the deadline before saving.
  const nextMonthlyDue = dueDateFor(currentPeriod(), "monthly", defaults);
  const nextQuarterlyDue = dueDateFor(currentQuarter(), "quarterly", defaults);

  return NextResponse.json({
    success: true,
    settings,
    defaults,
    overrides,
    businessModels,
    bands,
    glossary,
    definitions,
    groups,
    canEditGlossary,
    nextMonthlyDue,
    nextQuarterlyDue,
  });
});

export const PUT = createHandler(async (req) => {
  // The studio's reporting configuration is a staff surface.
  if (!isInternalVentureIdentity(req.session?.role)) {
    return NextResponse.json(
      { success: false, error: "errors.insufficientPermissions" },
      { status: 403 },
    );
  }

  const authError = await requireAuthorization("ventures", "setup", 3);
  if (authError) return authError;

  const body = await req.json().catch(() => ({}));
  const businessModel = body.businessModel || "default";
  const actorCid = req.session?.cid || null;

  // THE GLOSSARY IS THE SHARED VOCABULARY. Thresholds are delegable
  // (`ventures.setup`), but the vocabulary changes what every number MEANS, so
  // it needs the portfolio-write right (`ventures.edit_all`) — held by the
  // platform owner's profile and revocable like any other right.
  let glossaryUpdated = [];
  if (Array.isArray(body.glossary) && body.glossary.length) {
    const authContext = await getAuthorizationContext(req.session).catch(() => null);
    if (!authContext || !authorize(authContext, "ventures", "edit_all")) {
      return NextResponse.json(
        { success: false, error: "errors.insufficientPermissions" },
        { status: 403 },
      );
    }
    const glossary = await updateGlossary({ entries: body.glossary, actorCid });
    if (glossary.errors) {
      return NextResponse.json({ success: false, errors: glossary.errors }, { status: 400 });
    }
    glossaryUpdated = glossary.updated;
  }

  const result = await updateReportingSettings({
    values: body.settings || {},
    clear: body.clear || [],
    businessModel,
    actorCid,
  });

  if (result.errors) {
    return NextResponse.json({ success: false, errors: result.errors }, { status: 400 });
  }

  const refreshed = await getReportingSettings({});
  return NextResponse.json({
    success: true,
    updated: result.updated,
    cleared: result.cleared,
    glossaryUpdated,
    settings: refreshed.settings,
    defaults: refreshed.defaults,
    overrides: refreshed.overrides,
    glossary: refreshed.glossary,
    nextMonthlyDue: dueDateFor(currentPeriod(), "monthly", refreshed.defaults),
    nextQuarterlyDue: dueDateFor(currentQuarter(), "quarterly", refreshed.defaults),
  });
});

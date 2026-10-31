import { hashToken } from "@/lib/token-hashing";
import { getRequestId, newRequestId } from "@/lib/request-context";
import { withOrganizationBranding } from "@/models/organizations/branding";
import { evaluateProgramReadAccess } from "./programAccess";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX_COLOR = /^#[\da-f]{6}$/i;
const fail = (reason, errorKey = "errors.insufficientPermissions") => ({ success: false, reason, errorKey });

function hasReadableContrast(hex) {
  const channels = hex.slice(1).match(/.{2}/g).map((part) => {
    const value = Number.parseInt(part, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  return 1.05 / (luminance + 0.05) >= 4.5;
}

function normalizeLogoUrl(value) {
  if (value === null || value === "") return null;
  if (typeof value !== "string" || value.length > 2048) return undefined;
  const candidate = value.trim();
  if (candidate.startsWith("/") && !candidate.startsWith("//") && !/[\s<>"']/.test(candidate)) return candidate;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function validate(body) {
  const fields = ["display_name", "logo_url", "primary_color"];
  if (!body || typeof body !== "object" || Array.isArray(body)
    || !Object.keys(body).length || Object.keys(body).some((key) => !fields.includes(key))) return null;

  const values = {};
  if (Object.hasOwn(body, "display_name")) {
    if (body.display_name !== null && (typeof body.display_name !== "string"
      || (body.display_name.trim().length > 0 && body.display_name.trim().length > 80))) return null;
    values.displayName = body.display_name?.trim() || null;
  }
  if (Object.hasOwn(body, "logo_url")) {
    values.logoUrl = normalizeLogoUrl(body.logo_url);
    if (values.logoUrl === undefined) return null;
  }
  if (Object.hasOwn(body, "primary_color")) {
    if (body.primary_color !== null && (typeof body.primary_color !== "string"
      || !HEX_COLOR.test(body.primary_color) || !hasReadableContrast(body.primary_color))) return null;
    values.primaryColor = body.primary_color?.toUpperCase() || null;
  }
  return values;
}

export async function updateOrganizationBranding({ session, expectedOrganizationId, body }) {
  if (!session?.cid || !session?.token) return fail("no-session", "errors.authRequired");
  if (typeof expectedOrganizationId !== "string" || !UUID.test(expectedOrganizationId)) {
    return fail("invalid-query", "errors.invalidRequest");
  }
  const values = validate(body);
  if (!values) return fail("invalid-query", "errors.invalidRequest");

  const credentials = {
    cid: session.cid,
    token: session.token,
    tokenHash: hashToken(session.token),
    requestId: String(getRequestId() || newRequestId()).slice(0, 128),
  };
  return withOrganizationBranding(credentials, async (reader) => {
    if (!reader) return fail("no-session", "errors.authRequired");
    const decision = evaluateProgramReadAccess(reader.snapshot);
    if (!decision.allowed) return fail(decision.reason);
    if (reader.snapshot.organization_id.toLowerCase() !== expectedOrganizationId.toLowerCase()) {
      return fail("context-changed", "errors.organizationContextChanged");
    }
    if (!(await reader.hasEditPermission())) return fail("capability-missing");

    const current = await reader.getBranding(reader.snapshot.organization_id) || {};
    const merged = {
      displayName: Object.hasOwn(values, "displayName") ? values.displayName : current.display_name || null,
      logoUrl: Object.hasOwn(values, "logoUrl") ? values.logoUrl : current.logo_url || null,
      primaryColor: Object.hasOwn(values, "primaryColor") ? values.primaryColor : current.primary_color || null,
    };
    const branding = await reader.updateBranding(reader.snapshot.organization_id, session.cid, merged);
    return {
      success: true,
      organizationId: reader.snapshot.organization_id,
      branding: {
        displayName: branding.display_name || reader.snapshot.name,
        logoUrl: branding.logo_url || null,
        primaryColor: branding.primary_color || null,
      },
    };
  });
}

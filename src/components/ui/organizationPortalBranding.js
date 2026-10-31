const FALLBACK_COLOR = null;
const HEX_COLOR = /^#[\da-f]{6}$/i;

function contrastWithWhite(hex) {
  const channels = hex.slice(1).match(/.{2}/g).map((channel) => {
    const value = Number.parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  return 1.05 / (luminance + 0.05);
}

function safeLogoUrl(value) {
  if (typeof value !== "string") return null;
  const candidate = value.trim();
  if (candidate.startsWith("/") && !candidate.startsWith("//")) return candidate;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
}

export function resolveOrganizationPortalBranding(organization) {
  const branding = organization?.branding && typeof organization.branding === "object"
    ? organization.branding
    : {};
  const displayName = typeof branding.displayName === "string" && branding.displayName.trim()
    ? branding.displayName.trim().slice(0, 80)
    : organization?.name || "";
  const color = typeof branding.primaryColor === "string" && HEX_COLOR.test(branding.primaryColor)
    && contrastWithWhite(branding.primaryColor) >= 4.5
    ? branding.primaryColor
    : FALLBACK_COLOR;

  return {
    displayName,
    logoUrl: safeLogoUrl(branding.logoUrl),
    primaryColor: color,
  };
}

/**
 * A social-media link must point at the platform of the field it is typed in:
 * a Facebook address in the LinkedIn box is a mistake, not a profile.
 */
export const SOCIAL_HOSTS = {
  linkedin: ["linkedin.com", "lnkd.in"],
  instagram: ["instagram.com", "instagr.am"],
  twitter: ["x.com", "twitter.com"],
  facebook: ["facebook.com", "fb.com", "fb.me"],
};

/** True when `value` is empty, or an http(s) URL on one of the platform's own domains. */
export function isValidSocialLink(platform, value) {
  const text = String(value || "").trim();
  if (!text) return true;
  let url;
  try {
    url = new URL(text);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  const host = url.hostname.toLowerCase();
  return (SOCIAL_HOSTS[platform] || []).some((domain) => host === domain || host.endsWith(`.${domain}`));
}

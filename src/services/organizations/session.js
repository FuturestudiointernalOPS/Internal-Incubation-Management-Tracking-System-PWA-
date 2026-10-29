import { hashToken } from "@/lib/token-hashing";
import { findOrganizationSession } from "@/models/organizations/session";

export async function getOrganizationSession(token) {
  if (typeof token !== "string" || !token || token.length > 4096) return null;
  const identity = await findOrganizationSession(token, hashToken(token));
  return identity ? { cid: identity.cid, role: identity.role, token } : null;
}

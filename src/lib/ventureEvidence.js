/**
 * Deliverable evidence — private storage access.
 *
 * Evidence files live in a PRIVATE Supabase bucket; the database stores the
 * storage path, never a public URL. A short-lived signed URL is minted on
 * each read for viewers who already passed a Venture access gate (the journey
 * read / the panel), so the file is never world-readable.
 *
 * Values stored on a deliverable's attachment_url are therefore one of:
 *   • an external link the author pasted (http/https) — returned untouched;
 *   • a storage path (no scheme) — signed on read.
 */

import { createClient } from "@supabase/supabase-js";

export const EVIDENCE_BUCKET = "deliverable-evidence";
export const EVIDENCE_URL_TTL_SECONDS = 60 * 60; // 1 hour

/** True when the stored value is an external link rather than a storage path. */
export function isExternalEvidenceLink(value) {
  return /^https?:\/\//i.test(String(value || "").trim());
}

/**
 * The storage path for a value, or null when it is an external link / empty.
 * Tolerates a marked form (`supabase://bucket/path`) and a leading slash.
 */
export function evidenceStoragePath(value) {
  const raw = String(value || "").trim();
  if (!raw || isExternalEvidenceLink(raw)) return null;
  const withoutMarker = raw.replace(/^supabase:\/\/[^/]+\//i, "").replace(/^\/+/, "");
  return withoutMarker || null;
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/** Sign one storage path. Returns null when it cannot be signed. */
export async function signEvidencePath(path, expiresIn = EVIDENCE_URL_TTL_SECONDS) {
  const clean = evidenceStoragePath(path);
  if (!clean) return null;
  try {
    const client = serviceClient();
    if (!client) return null;
    const { data, error } = await client.storage.from(EVIDENCE_BUCKET).createSignedUrl(clean, expiresIn);
    if (error) return null;
    return data?.signedUrl || null;
  } catch (_) {
    return null;
  }
}

/**
 * What the UI should link to: external links pass through, storage paths are
 * signed. Returns null when there is nothing usable (UI falls back to the raw
 * stored value only if it is an external link).
 */
export async function evidenceDownloadUrl(value, expiresIn = EVIDENCE_URL_TTL_SECONDS) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (isExternalEvidenceLink(raw)) return raw;
  return signEvidencePath(raw, expiresIn);
}

export default { EVIDENCE_BUCKET, EVIDENCE_URL_TTL_SECONDS, isExternalEvidenceLink, evidenceStoragePath, signEvidencePath, evidenceDownloadUrl };

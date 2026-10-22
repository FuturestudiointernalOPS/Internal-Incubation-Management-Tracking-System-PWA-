/**
 * Data Room service — the small pieces every part of the module shares.
 *
 * Pure shaping and text hygiene only: no SQL, no HTTP, no decisions. Kept here
 * so the access, document and grant modules cannot spell a refusal or a signed
 * URL differently.
 */

import { signEvidencePath } from "@/lib/ventureEvidence";
import { isDataRoomExternalLink } from "@/lib/dataRoom";
import { insertDataRoomActivity } from "@/models/ventureDataRoomStore";

export const MAX_TITLE = 200;
export const MAX_DESCRIPTION = 4000;
export const MAX_NOTES = 4000;

/** A refusal the HTTP boundary turns into a response. */
export const refusal = (status, error) => ({ ok: false, status, error });

/**
 * A stored document's file reference, signed for the viewer.
 *
 * The stored value is a PRIVATE storage path (or an external http link). We
 * never return the raw path to a browser that could then guess at it; a signed
 * URL is minted per read, for a viewer who already passed the access gate. The
 * path columns are removed from the answer for the same reason — the UI has no
 * use for them, and a private reference is not something to hand around.
 */
export async function withSignedUrl(documentEntry) {
  if (!documentEntry) return null;
  const { storage_path: _storagePath, file_url: _fileUrl, ...rest } = documentEntry;
  return {
    ...rest,
    status: documentEntry.review_status_effective || documentEntry.review_status || "uploaded",
    file_url_signed: await signedFileUrl(documentEntry),
  };
}

/** One historical version, with the same path redaction as the live document. */
export async function withSignedVersion(versionEntry) {
  if (!versionEntry) return null;
  const { storage_path: _storagePath, file_url: _fileUrl, ...rest } = versionEntry;
  return { ...rest, file_url_signed: await signedFileUrl(versionEntry) };
}

async function signedFileUrl(entry) {
  const stored = String(entry?.file_url || entry?.storage_path || "").trim();
  const signed = await signEvidencePath(stored).catch(() => null);
  return signed || (isDataRoomExternalLink(stored) ? stored : null);
}

export function parseDetails(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch (_) {
    return {};
  }
}

export function cleanText(value, max) {
  return String(value ?? "").trim().slice(0, max);
}

export function parseExpiry(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error("dataRoom.errors.invalidExpiry");
  return parsed.toISOString();
}

/**
 * Record one audit row. Never allowed to break the action it describes: the
 * Data Room is usable even when the activity log cannot be written, and the
 * log never carries document contents — only ids, categories and decisions.
 */
export async function audit(ventureId, action, session, details, database) {
  try {
    await insertDataRoomActivity(
      {
        ventureRef: ventureId,
        action,
        actorCid: session?.cid || "system",
        actorName: session?.name || "",
        detailsJson: JSON.stringify(details || {}),
      },
      database,
    );
  } catch (_) {
    /* audit is best-effort, exactly like the rest of the Venture log */
  }
}

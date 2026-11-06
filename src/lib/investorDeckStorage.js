import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { safeStorageName, safeStoragePath } from "@/lib/storageNames";

export const INVESTOR_DECK_BUCKET = "investor-decks";
export const INVESTOR_DECK_MAX_FILE_BYTES = 10 * 1024 * 1024;

function storageClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey);
}

async function ensurePrivateBucket(client, { createIfMissing = false } = {}) {
  const existing = await client.storage.getBucket(INVESTOR_DECK_BUCKET);
  if (!existing.error) {
    const isPrivate = existing.data?.public === false;
    if (!isPrivate) console.error("[Investor deck] configured storage bucket must be private");
    return isPrivate;
  }
  if (!/bucket.*not found|does not exist/i.test(existing.error.message)) {
    console.error("[Investor deck] bucket lookup failed:", existing.error.message);
    return false;
  }
  if (!createIfMissing) return false;

  const created = await client.storage.createBucket(INVESTOR_DECK_BUCKET, { public: false });
  if (!created.error) return true;
  const afterCreate = await client.storage.getBucket(INVESTOR_DECK_BUCKET);
  if (!afterCreate.error) {
    const isPrivate = afterCreate.data?.public === false;
    if (!isPrivate) console.error("[Investor deck] configured storage bucket must be private");
    return isPrivate;
  }
  console.error("[Investor deck] private bucket setup failed:", created.error.message);
  return false;
}

export function validateInvestorDeckFile(file) {
  if (!file || typeof file === "string" || typeof file.arrayBuffer !== "function") {
    return { success: false, error: "investorAdmin.dealFlow.errDeckRequired" };
  }
  if (!/\.pdf$/i.test(file.name || "")
    || (file.type && file.type !== "application/pdf")) {
    return { success: false, error: "investorAdmin.dealFlow.errDeckType" };
  }
  if (file.size > INVESTOR_DECK_MAX_FILE_BYTES) {
    return { success: false, error: "investorAdmin.dealFlow.errDeckSize" };
  }
  return { success: true };
}

export async function uploadInvestorDeckFile({ file, dealFlowEntryId }) {
  const validation = validateInvestorDeckFile(file);
  if (!validation.success) return validation;
  if (!/^[1-9]\d*$/.test(String(dealFlowEntryId || ""))) {
    return { success: false, error: "investorAdmin.dealFlow.errEntryId" };
  }
  const client = storageClient();
  if (!client) return { success: false, error: "investorAdmin.dealFlow.storageUnavailable" };

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!buffer.subarray(0, 1024).includes(Buffer.from("%PDF-"))) {
    return { success: false, error: "investorAdmin.dealFlow.errDeckType" };
  }
  if (!(await ensurePrivateBucket(client, { createIfMissing: true }))) {
    return { success: false, error: "investorAdmin.dealFlow.storageUnavailable" };
  }
  const path = safeStoragePath(
    `deal-flow/${dealFlowEntryId}/${randomUUID()}-${safeStorageName(file.name, "pitch-deck.pdf")}`,
  );
  const upload = await client.storage.from(INVESTOR_DECK_BUCKET).upload(path, buffer, {
    contentType: "application/pdf",
    cacheControl: "300",
    upsert: false,
  });
  if (upload.error) {
    console.error("[Investor deck] upload failed:", upload.error.message);
    return { success: false, error: "investorAdmin.dealFlow.uploadFailed" };
  }
  return { success: true, storagePath: path, fileName: file.name, size: file.size };
}

export async function removeInvestorDeckFile(storagePath) {
  const path = String(storagePath || "");
  if (!path.startsWith("deal-flow/") || path.includes("..")) return false;
  const client = storageClient();
  if (!client) {
    console.error("[Investor deck] cleanup skipped: storage client unavailable");
    return false;
  }
  const { error } = await client.storage.from(INVESTOR_DECK_BUCKET).remove([path]);
  if (error) console.error("[Investor deck] cleanup failed:", error.message);
  return !error;
}

export async function signInvestorDeckFile(storagePath) {
  const path = String(storagePath || "");
  if (!path.startsWith("deal-flow/") || path.includes("..")) return null;
  const client = storageClient();
  if (!client) return null;
  if (!(await ensurePrivateBucket(client))) {
    console.error("[Investor deck] signing unavailable: private storage bucket is not configured");
    return null;
  }
  const { data, error } = await client.storage
    .from(INVESTOR_DECK_BUCKET)
    .createSignedUrl(path, 300, { download: false });
  if (error) {
    console.error("[Investor deck] signing failed:", error.message);
    return null;
  }
  return data?.signedUrl || null;
}

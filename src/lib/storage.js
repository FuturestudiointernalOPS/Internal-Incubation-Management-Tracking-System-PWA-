import { supabase } from './supabase'
import { createClient } from '@supabase/supabase-js'
import { isAllowedEvidenceDocument, EVIDENCE_DOCUMENT_ERROR, isAllowedEvidenceImage, EVIDENCE_IMAGE_ERROR } from './ventureEvidence'
import { safeStorageName, safeStoragePath } from './storageNames'

/**
 * IMPACTOS OPERATIONAL STORAGE — SUPABASE INTEGRATION
 * High-security asset management for PDFs and Course Materials.
 */

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'
]

const ALLOWED_EXTENSIONS = /\.(pdf|png|jpg|jpeg|doc|docx|xls|xlsx|ppt|pptx)$/i

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

export const uploadFile = async (bucket, path, file) => {
  try {
    // Validate file existence
    if (!file) {
      return { success: false, error: 'No file provided.' }
    }

    // Validate file type: a valid EXTENSION is required, and a declared MIME
    // type must be one we accept (an absent/generic type is tolerated). The old
    // OR let a file with a safe extension but a hostile content type through.
    const isMimeValid = ALLOWED_MIME_TYPES.includes(file.type)
    const isMimeUnknown = !file.type || file.type === 'application/octet-stream'
    const isExtensionValid = ALLOWED_EXTENSIONS.test(file.name)
    if (!isExtensionValid || (!isMimeValid && !isMimeUnknown)) {
      return {
        success: false,
        error: `File type "${file.type || 'unknown'}" is not supported. Supported file types: PDF, PNG, JPG, DOC, DOCX, XLS, XLSX, PPT, PPTX. Or upload a file link/URL instead.`
      }
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return {
        success: false,
        error: `File size exceeds the maximum of 5MB. This file is ${(file.size / (1024 * 1024)).toFixed(1)}MB. Please compress it or upload a file link/URL instead.`
      }
    }

    // The stored key is written here, not by the caller: a segment carrying a
    // character storage refuses (accent, en dash, "#"…) would fail the whole
    // upload. See lib/storageNames.js.
    const objectPath = safeStoragePath(path)

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(objectPath, file, {
        cacheControl: '3600',
        upsert: true
      })

    if (error) {
      // Auto-create bucket if it doesn't exist
      if (/bucket.*not found|does not exist/i.test(error.message)) {
        await supabase.storage.createBucket(bucket, { public: true });
        const retry = await supabase.storage
          .from(bucket)
          .upload(objectPath, file, {
            cacheControl: '3600',
            upsert: true,
          });
        if (retry.error) throw retry.error;
        const { data: retryUrl } = supabase.storage
          .from(bucket)
          .getPublicUrl(objectPath);
        return { success: true, url: retryUrl.publicUrl, data: retry.data };
      }
      throw error;
    }

    // Get Public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(objectPath)

    return { success: true, url: publicUrl, data }
  } catch (error) {
    console.error('Storage Error:', error.message)

    if (/bucket/i.test(error.message)) {
      return {
        success: false,
        error: `Storage bucket "${bucket}" is not configured. Please contact your administrator.`
      }
    }

    return { success: false, error: `Upload failed: ${error.message}` }
  }
}

/**
 * Task attachments use a dedicated bucket and accept any file type (unlike
 * knowledge-bank files, which are restricted to documents/images). Size is
 * still capped to avoid unbounded storage.
 */
export const uploadTaskAttachment = async (file, taskId) => {
  try {
    if (!file) {
      return { success: false, error: 'No file provided.' }
    }

    if (file.size > MAX_FILE_SIZE) {
      return {
        success: false,
        error: `File size exceeds the maximum of 5MB. This file is ${(file.size / (1024 * 1024)).toFixed(1)}MB. Please compress it or upload a file link/URL instead.`
      }
    }

    const bucket = 'task-attachments'
    const path = safeStoragePath(`${taskId}/${Date.now()}_${safeStorageName(file.name, 'attachment')}`)

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: true,
      })

    if (error) {
      if (/bucket.*not found|does not exist/i.test(error.message)) {
        await supabase.storage.createBucket(bucket, { public: true });
        const retry = await supabase.storage
          .from(bucket)
          .upload(path, file, {
            cacheControl: '3600',
            upsert: true,
          });
        if (retry.error) throw retry.error;
        const { data: retryUrl } = supabase.storage
          .from(bucket)
          .getPublicUrl(path);
        return { success: true, url: retryUrl.publicUrl, data: retry.data };
      }
      throw error;
    }

    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(path)

    return { success: true, url: publicUrl, data }
  } catch (error) {
    console.error('Storage Error:', error.message)

    if (/bucket/i.test(error.message)) {
      return {
        success: false,
        error: `Storage bucket "task-attachments" is not configured. Please contact your administrator.`
      }
    }

    return { success: false, error: `Upload failed: ${error.message}` }
  }
}

/**
 * Deliverable evidence uploads — the Venture (founders/team) and staff attach
 * the proof for a deliverable. Shares the task-attachments bucket (already
 * provisioned, accepts any file type) under a `deliverables/` prefix so the
 * evidence stays grouped and traceable. Size is capped like every other
 * upload; authorization happens in the route (Venture access).
 *
 * `allowImages` widens the allow-list to PNG/JPG — used by verification
 * documents (founder ID photos, scanned cards). Deliverable evidence keeps the
 * documents-only default.
 */
export const uploadDeliverableEvidence = async (file, { ventureId, deliverableId, allowImages = false }) => {
  try {
    if (!file) {
      return { success: false, error: 'No file provided.' }
    }

    if (file.size > MAX_FILE_SIZE) {
      return {
        success: false,
        error: `File size exceeds the maximum of 5MB. This file is ${(file.size / (1024 * 1024)).toFixed(1)}MB. Please compress it or paste a link instead.`
      }
    }

    // Evidence is a document — or, where the caller allows it (verification),
    // a document or an image.
    if (allowImages ? !isAllowedEvidenceImage(file) : !isAllowedEvidenceDocument(file)) {
      return { success: false, error: allowImages ? EVIDENCE_IMAGE_ERROR : EVIDENCE_DOCUMENT_ERROR }
    }
    // PRIVATE bucket: evidence is never world-readable. Authorized viewers get
    // a short-lived signed URL (lib/ventureEvidence.js); the database stores
    // the storage path, not a public URL. Service-role client so the private
    // bucket can be written/created regardless of storage policies.
    const bucket = 'deliverable-evidence'
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const client = url && serviceKey ? createClient(url, serviceKey) : supabase

    const scope = String(ventureId || 'unknown').replace(/[^A-Za-z0-9_-]/g, '_')
    const item = String(deliverableId || 'new').replace(/[^A-Za-z0-9_-]/g, '_')
    const path = safeStoragePath(
      `deliverables/${scope}/${item}/${Date.now()}_${safeStorageName(file.name, 'evidence')}`,
    )

    let { error } = await client.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: true,
      })

    if (error && /bucket.*not found|does not exist/i.test(error.message)) {
      await client.storage.createBucket(bucket, { public: false });
      const retry = await client.storage
        .from(bucket)
        .upload(path, file, {
          cacheControl: '3600',
          upsert: true,
        });
      error = retry.error;
    }

    if (error) throw error;

    return { success: true, path, name: file.name }
  } catch (error) {
    console.error('Storage Error:', error.message)

    if (/bucket/i.test(error.message)) {
      return {
        success: false,
        error: `Storage bucket "deliverable-evidence" is not configured. Please contact your administrator.`
      }
    }

    return { success: false, error: `Upload failed: ${error.message}` }
  }
}

/**
 * Session materials — the documents a session carries (a deck to review, a
 * brief to read before the call). Same PRIVATE bucket and the same
 * documents-only rule as deliverable evidence, under a `sessions/` prefix so the
 * two kinds of file never blur. The database stores the storage path; the read
 * layer signs a short-lived URL for viewers who already passed a Venture access
 * gate. Authorization happens in the route — founders book sessions too.
 */
export const uploadSessionMaterial = async (file, { ventureId, milestoneId } = {}) => {
  try {
    if (!file) {
      return { success: false, error: 'No file provided.' }
    }

    if (file.size > MAX_FILE_SIZE) {
      return {
        success: false,
        error: `File size exceeds the maximum of 5MB. This file is ${(file.size / (1024 * 1024)).toFixed(1)}MB. Please compress it or paste a link instead.`
      }
    }

    if (!isAllowedEvidenceDocument(file)) {
      return { success: false, error: EVIDENCE_DOCUMENT_ERROR }
    }

    const bucket = 'deliverable-evidence'
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const client = url && serviceKey ? createClient(url, serviceKey) : supabase

    const scope = String(ventureId || 'unknown').replace(/[^A-Za-z0-9_-]/g, '_')
    const milestone = String(milestoneId || 'general').replace(/[^A-Za-z0-9_-]/g, '_')
    const path = safeStoragePath(
      `sessions/${scope}/${milestone}/${Date.now()}_${safeStorageName(file.name, 'material')}`,
    )

    let { error } = await client.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: true,
      })

    if (error && /bucket.*not found|does not exist/i.test(error.message)) {
      await client.storage.createBucket(bucket, { public: false });
      const retry = await client.storage
        .from(bucket)
        .upload(path, file, {
          cacheControl: '3600',
          upsert: true,
        });
      error = retry.error;
    }

    if (error) throw error;

    return { success: true, path, name: file.name, size: file.size || null }
  } catch (error) {
    console.error('Storage Error:', error.message)

    if (/bucket/i.test(error.message)) {
      return {
        success: false,
        error: `Storage bucket "deliverable-evidence" is not configured. Please contact your administrator.`
      }
    }

    return { success: false, error: `Upload failed: ${error.message}` }
  }
}

export const deleteFile = async (bucket, path) => {
  try {
    const { error } = await supabase.storage.from(bucket).remove([path])
    if (error) throw error
    return { success: true }
  } catch (error) {
    console.error('Storage Error:', error.message)
    return { success: false, error: error.message }
  }
}

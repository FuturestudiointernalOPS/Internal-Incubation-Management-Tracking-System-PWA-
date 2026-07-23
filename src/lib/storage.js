import { supabase } from './supabase'

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

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

export const uploadFile = async (bucket, path, file) => {
  try {
    // Validate file existence
    if (!file) {
      return { success: false, error: 'No file provided.' }
    }

    // Validate file type (check MIME type first, fall back to extension)
    const isMimeValid = ALLOWED_MIME_TYPES.includes(file.type)
    const isExtensionValid = ALLOWED_EXTENSIONS.test(file.name)
    if (!isMimeValid && !isExtensionValid) {
      return {
        success: false,
        error: `File type "${file.type || 'unknown'}" is not supported. Allowed: PDF, images, documents, spreadsheets, presentations.`
      }
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return {
        success: false,
        error: `File size exceeds maximum of 50MB. This file is ${(file.size / (1024 * 1024)).toFixed(1)}MB.`
      }
    }

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: true
      })

    if (error) throw error

    // Get Public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(path)

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

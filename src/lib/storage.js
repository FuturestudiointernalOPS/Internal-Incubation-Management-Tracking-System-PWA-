import { supabase } from './supabase'

/**
 * IMPACTOS OPERATIONAL STORAGE — SUPABASE INTEGRATION
 * High-security asset management for PDFs and Course Materials.
 */

export const uploadFile = async (bucket, path, file) => {
  try {
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
    console.error("Storage Error:", error.message)
    return { success: false, error: error.message }
  }
}

export const deleteFile = async (bucket, path) => {
  try {
    const { error } = await supabase.storage.from(bucket).remove([path])
    if (error) throw error
    return { success: true }
  } catch (error) {
    console.error("Storage Error:", error.message)
    return { success: false, error: error.message }
  }
}

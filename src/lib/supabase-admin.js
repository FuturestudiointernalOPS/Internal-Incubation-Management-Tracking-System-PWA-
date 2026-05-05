import { createClient } from '@supabase/supabase-js'

/**
 * IMPACTOS SECURE ADMIN CLIENT
 * This client uses the Service Role Key and bypasses Row Level Security.
 * ONLY use this in server-side files (API routes, Server Actions).
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('CRITICAL: Supabase Admin credentials missing.')
}

export const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

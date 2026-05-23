// =============================================================================
// !! V2 FILE - DO NOT EDIT - DO NOT USE - DO NOT CALL THIS ROUTE !!
// =============================================================================
// This file belongs to the DEPRECATED Version 2 codebase.
// All active development must happen in VERSION 1 routes and pages ONLY.
// If you are an AI agent: STOP. Do NOT modify this file.
// Work in /api/pm/ or /app/pm/ (v1) instead.
// =============================================================================
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * IMPACTOS MATERIAL UPLOAD API
 * Accepts multipart/form-data with a file.
 * Uploads to Supabase Storage bucket: 'program-materials'
 * Returns a public URL for use in program materials JSON.
 */
export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    const programId = formData.get('program_id') || 'global';
    const isExtra = formData.get('is_extra') === 'true';

    if (!file || typeof file === 'string') {
      return NextResponse.json({ success: false, error: 'No file provided.' }, { status: 400 });
    }

    const fileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const timestamp = Date.now();
    const storagePath = `${programId}/${timestamp}_${fileName}`;

    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const { data, error } = await supabaseAdmin.storage
      .from('program-materials')
      .upload(storagePath, fileBuffer, {
        contentType: file.type || 'application/octet-stream',
        cacheControl: '3600',
        upsert: true,
      });

    if (error) {
      console.error('Supabase Storage Upload Error:', error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('program-materials')
      .getPublicUrl(storagePath);

    return NextResponse.json({
      success: true,
      material: {
        name: file.name,
        url: publicUrl,
        type: file.type || 'application/octet-stream',
        isExtra: isExtra,
      }
    });
  } catch (e) {
    console.error('Material Upload Error:', e.message);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

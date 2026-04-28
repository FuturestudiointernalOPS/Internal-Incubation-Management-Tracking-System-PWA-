import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

/**
 * UNIFIED AUTH TERMINAL
 * Hierarchical enforcement: One unique Super Admin, all others are Operational PMs.
 */
export async function POST(req) {
  try {
    await initDb();
    const { useID, accessCode } = await req.json();

    if (!useID || !accessCode) {
      return NextResponse.json({ success: false, error: "Missing identity credentials." }, { status: 400 });
    }

    const cleanID = useID.trim().toLowerCase();
    const cleanCode = accessCode.trim();

    // 1. HARDCODED SYSTEM MASTER (The ONLY Super Admin bypass)
    if (cleanID === 'superadmin' && accessCode === '147369') {
      return NextResponse.json({
        success: true,
        role: 'super_admin',
        session: 'prime-2026-active',
        user: {
          id: 'sa-root-001',
          name: 'System Root',
          roleLabel: 'Super Admin'
        }
      });
    }

    // 2. DATABASE REGISTRY CHECK (Fetch User First)
    const result = await db.execute({
      sql: "SELECT * FROM contacts WHERE (LOWER(name) = ? OR LOWER(email) = ? OR cid = ?) AND deleted = 0 LIMIT 1",
      args: [cleanID, cleanID, cleanID.toUpperCase()]
    });

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Authentication Failed: Identity or Access Code Mismatch." }, { status: 401 });
    }

    const user = result.rows[0];

    // --- CRYPTOGRAPHIC VERIFICATION ---
    const isHashed = user.password && user.password.startsWith('$2');
    let isMatch = false;

    if (isHashed) {
      isMatch = await bcrypt.compare(cleanCode, user.password);
    } else {
      isMatch = (cleanCode === user.password);
    }

    if (!isMatch) {
      return NextResponse.json({ success: false, error: "Authentication Failed: Identity or Access Code Mismatch." }, { status: 401 });
    }

    // --- DYNAMIC ROLE RESOLUTION ---
    let finalRole = 'participant';
    let label = 'Member';
    let sessionPrefix = 'part';

    // Staff / PM Differentiation
    // We treat all STAFF and designated PROJECT_MANAGERS as PMs unless they are the system root.
    const isAssignedPM = user.role === 'project_manager' || user.role === 'pm';
    const isInternalStaff = user.group_name?.toUpperCase() === 'STAFF' || user.group_name?.toUpperCase() === 'FUTURE STUDIO';

    // Secondary check: assigned as PM in the programs registry
    const pmCheck = await db.execute({
       sql: "SELECT id FROM v2_programs WHERE assigned_pm_id = ? LIMIT 1",
       args: [user.id || user.cid]
    });
    const hasAssignments = pmCheck.rows.length > 0;

    if (isAssignedPM || isInternalStaff || hasAssignments) {
       finalRole = 'program_manager';
       sessionPrefix = 'pm';
       label = (isAssignedPM || hasAssignments) ? 'Project Manager' : 'Future Studio';
    } else {
       // All others are participants and must use /login
       return NextResponse.json({ 
         success: false, 
         error: "Participant credentials detected. Please use the /login portal." 
       }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      role: finalRole,
      session: `${sessionPrefix}-session-${user.cid}`,
      user: {
        id: user.cid,
        name: user.name,
        roleLabel: label,
        email: user.email,
        isLeadPM: isAssignedPM || hasAssignments
      }
    });

  } catch (error) {
    console.error("Auth Error:", error);
    return NextResponse.json({ success: false, error: "System Security Exception" }, { status: 500 });
  }
}

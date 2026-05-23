import { NextResponse } from 'next/server';
import db, { initDb } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(req) {
  try {
    await initDb();
    const { email, currentPassword, newPassword, adminToken } = await req.json();

    if (!email || !newPassword) {
      return NextResponse.json({ success: false, error: 'Email and new password required.' }, { status: 400 });
    }

    if (newPassword.length < 4) {
      return NextResponse.json({ success: false, error: 'Password must be at least 4 characters.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Admin/PM reset (no current password check)
    if (adminToken) {
      // Try contacts table first
      const contactRes = await db.execute({
        sql: 'UPDATE contacts SET password = ? WHERE email = ? RETURNING name, email, role',
        args: [hashedNewPassword, cleanEmail]
      });

      if (contactRes.rows && contactRes.rows.length > 0) {
        return NextResponse.json({
          success: true,
          message: 'Password has been reset successfully.',
          user: contactRes.rows[0]
        });
      }

      // Try v2_teams table (team login)
      const teamRes = await db.execute({
        sql: 'UPDATE v2_teams SET password = ? WHERE team_username = ? RETURNING name, team_username',
        args: [newPassword, cleanEmail]  // Teams use plain text passwords
      });

      if (teamRes.rows && teamRes.rows.length > 0) {
        return NextResponse.json({
          success: true,
          message: 'Team password has been reset successfully.',
          user: teamRes.rows[0]
        });
      }

      return NextResponse.json({ success: false, error: 'User not found.' }, { status: 404 });
    }

    // Self-reset: verify current password
    if (!currentPassword) {
      return NextResponse.json({ success: false, error: 'Current password required for self-reset.' }, { status: 400 });
    }

    const userRes = await db.execute({
      sql: 'SELECT * FROM contacts WHERE email = ? LIMIT 1',
      args: [cleanEmail]
    });

    if (!userRes.rows || userRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'User not found.' }, { status: 404 });
    }

    const user = userRes.rows[0];
    const isHashed = user.password && user.password.startsWith('$2');
    let isMatch = false;

    if (isHashed) {
      isMatch = await bcrypt.compare(currentPassword, user.password);
    } else {
      isMatch = (currentPassword === user.password);
    }

    if (!isMatch) {
      return NextResponse.json({ success: false, error: 'Current password is incorrect.' }, { status: 401 });
    }

    await db.execute({
      sql: 'UPDATE contacts SET password = ? WHERE email = ?',
      args: [hashedNewPassword, cleanEmail]
    });

    return NextResponse.json({
      success: true,
      message: 'Password updated successfully.'
    });

  } catch (error) {
    console.error('Password Reset Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

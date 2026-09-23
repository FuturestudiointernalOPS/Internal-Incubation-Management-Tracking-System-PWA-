import { NextResponse } from 'next/server';
import { initDb } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { enforceRateLimit, getClientIp } from '@/lib/rate-limit';
import {
  getContactByEmailForPasswordReset,
  updateContactPasswordByEmail,
  deleteUserSessions,
} from '@/models/authFlows';

export async function POST(req) {
  try {
    await initDb();

    // Rate limit: this endpoint compares a CURRENT password, so it must not be a
    // rate-free credential oracle.
    const limited = enforceRateLimit(req, `reset:ip:${getClientIp(req)}`, {
      limit: 10,
      windowMs: 15 * 60 * 1000,
    });
    if (limited) return limited;

    const { email, currentPassword, newPassword } = await req.json();

    if (!email || !newPassword) {
      return NextResponse.json({ success: false, error: 'Email and new password required.' }, { status: 400 });
    }

    if (newPassword.length < 4) {
      return NextResponse.json({ success: false, error: 'Password must be at least 4 characters.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Self-reset: verify current password (users manage their own passwords;
    // there is no administrator password-reset path by design).
    if (!currentPassword) {
      return NextResponse.json({ success: false, error: 'Current password required for self-reset.' }, { status: 400 });
    }

    const userResult = await getContactByEmailForPasswordReset(cleanEmail);

    if (!userResult.rows || userResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'User not found.' }, { status: 404 });
    }

    const user = userResult.rows[0];
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

    await updateContactPasswordByEmail(hashedNewPassword, cleanEmail);

    // Invalidate every session that predates this credential change: a stolen
    // session must die with the old password.
    if (user.cid) await deleteUserSessions(user.cid).catch(() => {});

    return NextResponse.json({
      success: true,
      message: 'Password updated successfully.'
    });

  } catch (error) {
    console.error('Password Reset Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

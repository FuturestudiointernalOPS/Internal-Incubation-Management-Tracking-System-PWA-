import { NextResponse } from 'next/server';
import { initDb } from '@/lib/db';
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { enforceRateLimit, getClientIp } from '@/lib/rate-limit';
import {
  getContactByEmailForPasswordReset,
  updateContactPasswordByEmail,
  deleteUserSessions,
} from '@/models/authFlows';

// A valid bcrypt hash of a throwaway string, compared when the account does not
// exist so the "unknown account" and "wrong password" responses take comparable
// time (AUTH-4). Never matches a caller-supplied password.
const TIMING_EQUALIZER_HASH =
  '$2b$10$fn1mJNjkFvAK/0ZRjg3mI.ESbkl87xtv22wPOzYPxjK6yAg0gcv3.';

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
    const hashedNewPassword = await hashPassword(newPassword);

    // Self-reset: verify current password (users manage their own passwords;
    // there is no administrator password-reset path by design).
    if (!currentPassword) {
      return NextResponse.json({ success: false, error: 'Current password required for self-reset.' }, { status: 400 });
    }

    const userResult = await getContactByEmailForPasswordReset(cleanEmail);
    const user = userResult.rows?.[0] || null;

    // AUTH-4 — no account-existence oracle. "No such account" and "wrong current
    // password" return the SAME status and message, and the missing-account path
    // still pays a bcrypt comparison so the response time does not distinguish
    // them either. Previously this was a 404 "User not found." versus a 401
    // "Current password is incorrect.", which let anyone enumerate accounts.
    let isMatch = false;
    if (user) {
      const isHashed = user.password && user.password.startsWith('$2');
      isMatch = isHashed
        ? await verifyPassword(currentPassword, user.password)
        : (currentPassword === user.password);
    } else {
      await verifyPassword(currentPassword, TIMING_EQUALIZER_HASH);
    }

    if (!user || !isMatch) {
      return NextResponse.json({ success: false, error: 'Invalid credentials.' }, { status: 401 });
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

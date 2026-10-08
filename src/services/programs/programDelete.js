/**
 * Programs — deleting a program (SERVICE layer).
 *
 * The domain work behind `DELETE /api/pm/programs`: the protected-data guard
 * that refuses to erase history. The CONTROLLER keeps the `programs.delete`
 * capability, the record-scope wave and the response envelope.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions, no SQL, no HTTP. It writes through
 * `@/models/**` and returns a plain `{ status, body }`.
 */

import { countProtectedProgramData, deleteProgramById } from "@/models/programs";

/**
 * Delete a program, refusing when it carries protected historical data.
 *
 * @returns {Promise<{status: number, body: Object}>}
 */
export async function deleteProgramRecord({ id }) {
  // Phase 3C-7: refuse permanent deletion when the program carries protected
  // historical data (participants, sessions, submissions, deliverables).
  // Server-side enforcement — instruct to archive instead.
  const protectedRes = await countProtectedProgramData(id);
  if (Number(protectedRes.rows[0]?.protected_count || 0) > 0) {
    return {
      status: 409,
      body: {
        success: false,
        error:
          "Program contains protected data (participants, sessions, submissions, or deliverables). Archive it instead of deleting.",
      },
    };
  }

  await deleteProgramById(id);

  return { status: 200, body: { success: true } };
}

/**
 * Participant service — the weekly rituals (check-in, stand-up, retro,
 * reflection).
 *
 * Layer (see docs/LAYER_SPLIT.md): the DECISIONS live here — the default status
 * and notes, the default week, the calendar year, and the reflection content
 * assembly. Every statement lives in `@/models/participantPortal`. No SQL, no
 * HTTP.
 */

import {
  createCheckin,
  createStandup,
  createRetro,
  createReflection,
} from "@/models/participantPortal";

/** The current calendar year (kept as a seam so tests do not depend on today). */
export function currentYear(date = new Date()) {
  return date.getFullYear();
}

/**
 * The stored reflection text, assembled from the three optional fields. Empty
 * fields are dropped, so an empty submission stores an empty string.
 */
export function buildReflectionContent({ learnings, challenges, suggestions }) {
  return [
    learnings ? `Learnings: ${learnings}` : null,
    challenges ? `Challenges: ${challenges}` : null,
    suggestions ? `Suggestions: ${suggestions}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function recordCheckin({ cid, programId, status, notes }) {
  await createCheckin(cid, programId, status || "checked_in", notes || "");
}

export async function recordStandup({ cid, userName, weekNumber }) {
  await createStandup(cid, userName, weekNumber || 1, currentYear());
}

export async function recordRetro({ cid, userName, weekNumber }) {
  await createRetro(cid, userName, weekNumber || 1, currentYear());
}

export async function recordReflection({
  cid,
  userName,
  weekNumber,
  learnings,
  challenges,
  suggestions,
}) {
  const content = buildReflectionContent({ learnings, challenges, suggestions });
  await createReflection(cid, userName, content || "", weekNumber || 1, currentYear());
}

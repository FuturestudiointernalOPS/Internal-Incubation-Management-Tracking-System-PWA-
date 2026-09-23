/**
 * Shared team credentials (the team username and password every member of a team
 * uses to log in) are MANAGEMENT data. A read that is visible to a delegated,
 * non-management caller — an assignment holder, or a team reading its own row —
 * must not carry them.
 *
 * This returns a shallow copy with those fields removed, so the caller can map a
 * whole result set without leaking them.
 */
const TEAM_CREDENTIAL_FIELDS = ["password", "team_username"];

export function stripTeamCredentials(team) {
  if (!team) return team;
  const safe = { ...team };
  for (const field of TEAM_CREDENTIAL_FIELDS) delete safe[field];
  return safe;
}

export default { stripTeamCredentials };

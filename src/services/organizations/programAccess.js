// Initial, deliberately bounded programs.view policy. No global role bypass.
// The repository reads current membership, contract, module, grants and scopes
// in the same database snapshot as the programme data. No authorization cache.
export function evaluateProgramReadAccess(snapshot) {
  const deny = (reason) => ({ allowed: false, reason });
  if (!snapshot) return deny("no-session");
  if (!snapshot.organization_id) return deny("no-organization");
  if (snapshot.is_platform !== false) return deny("platform-not-client");
  if (snapshot.organization_status !== "active") return deny("organization-inactive");
  if (!snapshot.membership_id) return deny("no-membership");
  if (snapshot.contract_active !== true) return deny("contract-inactive");
  if (snapshot.module_enabled !== true) return deny("module-disabled");
  if (!isClientOrganizationActor(snapshot.actor_role)) return deny("supervision-required");

  const assignments = (snapshot.assignments || []).filter((a) =>
    Number.isInteger(a.viewLevel) && a.viewLevel >= 1
    && (a.scopeType === "organization" || (a.scopeType === "program" && a.scopeId))
    // An assignment must not expand its template's allowed scope.
    && a.scopeType === a.templateScope,
  );
  if (!assignments.length) return deny("capability-missing");
  const grants = (snapshot.grants || []).filter((g) =>
    (g.subjectType === "membership" && g.subjectId === snapshot.membership_id)
    // The repository includes only grants for this member's active assignments,
    // including roles without view. Their denies must still win over other roles.
    || g.subjectType === "role_assignment",
  );
  // An allow cannot extend the assigned programme or the role ceiling. This
  // increment's role base already grants view; positive grants add no new scope.
  const denies = grants.filter((g) => g.effect === "deny");
  if (denies.some((g) => g.scopeType === "organization")) return deny("explicit-deny");
  const scope = {
    organizationId: snapshot.organization_id,
    allPrograms: assignments.some((a) => a.scopeType === "organization"),
    programIds: [...new Set(assignments.filter((a) => a.scopeType === "program").map((a) => a.scopeId))],
    deniedProgramIds: [...new Set(denies.filter((g) => g.scopeType === "program").map((g) => g.scopeId))],
  };
  return { allowed: true, reason: "allowed", scope };
}

// Internal identities use explicit supervision, even if they also hold a client
// membership. Unknown identity types cannot silently become client accounts.
export function isClientOrganizationActor(role) {
  return ["member", "participant", "investor", "founder", "venture_owner", "entrepreneur"].includes(role);
}

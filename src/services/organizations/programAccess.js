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

export function evaluateLmsReadAccess(snapshot) {
  const deny = (reason) => ({ allowed: false, reason });
  if (!snapshot) return deny("no-session");
  if (!snapshot.organization_id) return deny("no-organization");
  if (snapshot.is_platform !== false) return deny("platform-not-client");
  if (snapshot.organization_status !== "active") return deny("organization-inactive");
  if (!snapshot.membership_id) return deny("no-membership");
  if (snapshot.contract_active !== true) return deny("contract-inactive");
  if (snapshot.lms_module_enabled !== true) return deny("module-disabled");
  if (!isClientOrganizationActor(snapshot.actor_role)) return deny("supervision-required");

  const assignments = (snapshot.lms_assignments || []).filter((assignment) =>
    assignment.scopeType === "organization"
    && assignment.scopeId == null
    && assignment.templateScope === "organization",
  );
  const grants = (snapshot.lms_grants || []).filter((grant) =>
    (grant.subjectType === "membership" && grant.subjectId === snapshot.membership_id)
    || grant.subjectType === "role_assignment",
  );
  const hasCapability = (capability) =>
    assignments.some((assignment) =>
      Number.isInteger(assignment.capabilities?.[capability])
      && assignment.capabilities[capability] >= 1,
    )
    && !grants.some((grant) =>
      grant.capability === capability && grant.effect === "deny",
    );
  const scope = {
    organizationId: snapshot.organization_id,
    catalog: hasCapability("catalog.read"),
    learning: hasCapability("learning.read"),
  };
  if (!scope.catalog && !scope.learning) return deny("capability-missing");
  return { allowed: true, reason: "allowed", scope };
}

export function evaluateVentureReadAccess(snapshot) {
  const deny = (reason) => ({ allowed: false, reason });
  if (!snapshot) return deny("no-session");
  if (!snapshot.organization_id) return deny("no-organization");
  if (snapshot.is_platform !== false) return deny("platform-not-client");
  if (snapshot.organization_status !== "active") return deny("organization-inactive");
  if (!snapshot.membership_id) return deny("no-membership");
  if (snapshot.contract_active !== true) return deny("contract-inactive");
  if (snapshot.venture_module_enabled !== true) return deny("module-disabled");
  if (!isClientOrganizationActor(snapshot.actor_role)) return deny("supervision-required");

  const assignments = (snapshot.venture_assignments || []).filter((assignment) =>
    assignment.scopeType === "organization"
    && assignment.scopeId == null
    && assignment.templateScope === "organization",
  );
  const grants = (snapshot.venture_grants || []).filter((grant) =>
    (grant.subjectType === "membership" && grant.subjectId === snapshot.membership_id)
    || grant.subjectType === "role_assignment",
  );
  const allowed = assignments.some((assignment) =>
    Number.isInteger(assignment.capabilities?.["assigned.read"])
    && assignment.capabilities["assigned.read"] >= 1,
  ) && !grants.some((grant) =>
    grant.capability === "assigned.read" && grant.effect === "deny",
  );
  return allowed
    ? { allowed: true, reason: "allowed", scope: { organizationId: snapshot.organization_id } }
    : deny("capability-missing");
}

// Internal identities use explicit supervision, even if they also hold a client
// membership. Unknown identity types cannot silently become client accounts.
export function isClientOrganizationActor(role) {
  return ["member", "participant", "investor", "founder", "venture_owner", "entrepreneur"].includes(role);
}

// Management is opt-in through NEW templates. Existing read-only roles retain
// their ceiling; grants cannot introduce an operation absent from the role.
export function evaluateProgramOperationAccess(snapshot, operation) {
  const read = evaluateProgramReadAccess(snapshot);
  if (!read.allowed) return read;
  if (!["create", "edit", "cohorts.manage", "enrollments.manage", "sessions.manage"].includes(operation)) {
    return { allowed: false, reason: "capability-missing" };
  }
  const assignments = (snapshot.assignments || []).filter((a) =>
    Number.isInteger(a.capabilities?.[operation]) && a.capabilities[operation] >= 1);
  const decision = evaluateProgramReadAccess({ ...snapshot, assignments });
  if (!decision.allowed || (operation === "create" && !decision.scope.allPrograms)) {
    return { allowed: false, reason: "capability-missing" };
  }
  return decision;
}

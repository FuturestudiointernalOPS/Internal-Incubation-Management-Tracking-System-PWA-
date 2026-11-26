/**
 * Fetch helpers for the programme edit modal.
 *
 * Each returns plain data; the calling component keeps its own state wiring,
 * notifications and clipboard side effects.
 */

export async function fetchActiveGroupRegistrationRun(groupId) {
  const res = await fetch(
    `/api/platform/form-runs?group_id=${encodeURIComponent(groupId)}`,
  );
  const payload = await res.json();
  return (
    (payload.success ? payload.runs || [] : []).find(
      (r) => r.status === "active" && r.public_slug,
    ) || null
  );
}

export async function updateFamilyDefaultRole(familyId, newRole) {
  const res = await fetch("/api/families", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: familyId,
      default_role: newRole,
    }),
  });
  return res.json();
}

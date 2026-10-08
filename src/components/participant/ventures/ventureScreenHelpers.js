// Pure helpers for the Venture detail screen.
//
// These are the pieces the screen used to declare inline: the whole-form payload
// the profile editor sends, the role merge the permissions panel needs, the
// document query string built from the two filters, the two shared styles and
// the notifier. None of them holds state or reads anything, so they live here
// and the screen imports them, keeping its own body about state and
// orchestration only.

// The profile form → the `PUT /api/ventures` body. A pure shaping of the form
// the person is editing; every optional field falls back exactly as the screen
// used to write it inline.
export function ventureToPayload(id, form) {
  return {
    id,
    name: form.name, description: form.description || null,
    mission: form.mission || null, vision: form.vision || null,
    industry: form.industry || null, sector: form.sector || null,
    business_stage: form.business_stage, website: form.website || null,
    country: form.country || null, country_code: form.country_code || null, registration_status: form.registration_status || null,
    north_star: form.north_star || null,
    social_media: { twitter: form.twitter || "", linkedin: form.linkedin || "", instagram: form.instagram || "", facebook: form.facebook || "" },
    status: form.status, visibility: form.visibility, language: form.language,
    branding: { color: form.brandColor || "#f60" },
  };
}

// The permissions panel always shows all five roles: a role the answer omitted
// is offered at the least access ('view') rather than left out.
export function mergePermissionRoles(existing = []) {
  const roles = ['founder', 'team', 'advisor', 'administrator', 'investor'];
  return roles.map(role => {
    const found = existing.find(permission => permission.role_scope === role);
    return found || { role_scope: role, access_level: 'view' };
  });
}

// The document list is ADDRESSED on the two filters, so the query string is a
// pure function of them.
export function buildDocumentQuery(search, category) {
  const documentParams = new URLSearchParams();
  if (search) documentParams.set("search", search);
  if (category) documentParams.set("category", category);
  return documentParams.toString();
}

export const inputStyle = { backgroundColor: "rgb(15 23 42)", borderColor: "rgb(255 255 255 / 0.15)", color: "var(--text-primary)" };
export const cardStyle = { backgroundColor: "rgb(255 255 255 / 0.05)", borderColor: "rgb(255 255 255 / 0.1)" };

export const notifyMsg = (message, type = "info") => window.dispatchEvent(new CustomEvent("impactos:notify", { detail: { type, message: String(message || ""), duration: 4000 } }));

// Pure helpers for the Venture detail screen.
//
// These are the pieces the screen used to declare inline: the whole-form payload
// the profile editor sends, the two shared styles and the notifier. None of them
// holds state or reads anything, so they live here and the screen imports them,
// keeping its own body about state and orchestration only.

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


// Form fields and cards follow the ACTIVE THEME. They used to carry
// dark-mode literals (a slate-900 background with `var(--text-primary)`), which
// in light mode painted the dark navy text on a dark navy field — the typed
// value was unreadable. Theme tokens keep both modes legible.
export const inputStyle = { backgroundColor: "var(--surface-1)", borderColor: "var(--border-primary)", color: "var(--text-primary)" };
export const cardStyle = { backgroundColor: "var(--surface-1)", borderColor: "var(--border-primary)" };

export const notifyMsg = (message, type = "info") => window.dispatchEvent(new CustomEvent("impactos:notify", { detail: { type, message: String(message || ""), duration: 4000 } }));

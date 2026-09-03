"use client";

// Shared constants + tiny helpers for Venture workspace tab components
// (Phase 2 extraction). Values are identical to the ones previously
// declared inside src/app/participant/ventures/[id]/page.js.

export const STAGES = ["idea", "validation", "mvp", "growth", "scale"];
export const INDUSTRY_FALLBACK = ["Fintech", "Healthtech", "Edtech", "Cleantech", "SaaS", "E-commerce", "Agritech", "Logistics", "AI / ML", "Blockchain", "Media & Entertainment", "Real Estate", "Other"];
export const STATUSES = ["active", "paused", "graduated", "archived"];
export const VISIBILITIES = ["private", "public", "inviteOnly"];

export const FOUNDER_ROLES = ["Founder", "Lead Founder", "Co-Founder", "Technical Founder", "Business Founder"];
export const TEAM_ROLES = ["Team Member", "Developer", "Designer", "Product Manager", "Marketing", "Operations", "Advisor"];

export function getFounderMembers(members) {
  return members.filter(m => m.member_type === "founder");
}

export function getTeamMembers(members) {
  return members.filter(m => m.member_type === "team_member");
}

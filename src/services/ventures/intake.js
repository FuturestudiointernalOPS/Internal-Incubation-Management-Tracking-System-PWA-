/**
 * VENTURE INTAKE (ids, validation, creation).
 *
 * Direct Startup Registration (Workflow B): the Venture id scheme, the promotion
 * member resolution, the company-info validation, the duplicate check and the
 * Venture / founder creation (with the `company_name` schema fallback).
 *
 * The decisions — the id format, the validation rules, the duplicate conflicts
 * and the company_name fallback — live here; every statement is in
 * `@/models/ventureIntakeStore`. Nothing here runs SQL.
 *
 * This module used to be re-exported through `@/lib/ventures`; that barrel is
 * gone (CH-4) and importers read this module directly. See docs/LAYER_SPLIT.md.
 */

import { v4 as uuidv4 } from "uuid";
import {
  selectTeamMembersForPromotion,
  selectVentureIdByCompanyName,
  selectVentureIdByName,
  selectVentureIdByRegistrationNumber,
  selectFounderIdByAnyEmail,
  insertVentureWithCompanyName,
  insertVentureLegacy,
  insertFounderRecord,
} from "@/models/ventureIntakeStore";

const VENTURE_ID_PREFIX = "VNT";

/**
 * Generate a unique Venture ID in format: VNT-XXXXXXXX
 */
export function generateVentureId() {
  const suffix = uuidv4().replace(/-/g, "").substring(0, 8).toUpperCase();
  return `${VENTURE_ID_PREFIX}-${suffix}`;
}

/**
 * Resolve the members of a program team for Venture promotion.
 *
 * The canonical membership link is contacts.v2_team_id (written by /api/pm/teams);
 * v2_participants.v2_team_id holds the same link for UUID-keyed participants.
 * The old promote path queried v2_group_members (a v2_groups table — wrong) and
 * fell back to ALL program participants — this helper fixes that.
 */
export async function resolveTeamMembersForPromotion(teamId) {
  const res = await selectTeamMembersForPromotion(teamId);
  return (res.rows || []).filter((member) => member && member.contact_id);
}

/**
 * Validate company information for registration.
 * Returns { valid: boolean, errors: string[] }
 */
export function validateCompanyInfo({
  company_name,
  industry,
  business_stage,
  founder_email,
  founder_name,
}) {
  const errors = [];

  if (!company_name || !company_name.trim()) {
    errors.push("Company name is required");
  }

  if (!industry || !industry.trim()) {
    errors.push("Industry is required");
  }

  if (!business_stage || !business_stage.trim()) {
    errors.push("Business stage is required");
  }

  if (!founder_email || !founder_email.trim()) {
    errors.push("Founder email is required");
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(founder_email)) {
    errors.push("Invalid founder email format");
  }

  if (!founder_name || !founder_name.trim()) {
    errors.push("Founder name is required");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Check for duplicate company, registration number, or founder email.
 * Returns { hasDuplicates: boolean, conflicts: string[] }
 */
export async function checkDuplicates({ company_name, registration_number, founder_email }) {
  const conflicts = [];

  // Check duplicate company name
  // Try company_name first, fall back to name for backward compat
  try {
    const nameCheck = await selectVentureIdByCompanyName(company_name.trim());
    if (nameCheck.rows.length > 0) {
      conflicts.push("A company with this name already exists");
    }
  } catch (_) {
    // company_name column may not exist yet; try "name" as fallback
    try {
      const fallbackCheck = await selectVentureIdByName(company_name.trim());
      if (fallbackCheck.rows.length > 0) {
        conflicts.push("A company with this name already exists");
      }
    } catch (_) {}
  }

  // Check duplicate registration number
  if (registration_number && registration_number.trim()) {
    const regCheck = await selectVentureIdByRegistrationNumber(registration_number.trim());
    if (regCheck.rows.length > 0) {
      conflicts.push("A company with this registration number already exists");
    }
  }

  // Check duplicate founder email
  const emailCheck = await selectFounderIdByAnyEmail(founder_email.trim());
  if (emailCheck.rows.length > 0) {
    conflicts.push("A founder with this email already exists");
  }

  return { hasDuplicates: conflicts.length > 0, conflicts };
}

/**
 * Create a venture record.
 */
export async function createVenture({
  venture_id,
  company_name,
  registration_number,
  industry,
  business_stage,
  description,
  website,
  logo_url,
  created_by,
}) {
  // Always use "name" (legacy column exists in the table).
  // Also try setting "company_name" for new schema compatibility.
  const name = company_name.trim();

  try {
    // Try with both name and company_name
    await insertVentureWithCompanyName({
      ventureId: venture_id,
      name,
      registrationNumber: registration_number?.trim() || null,
      industry: industry.trim(),
      businessStage: business_stage.trim(),
      description: description?.trim() || null,
      website: website?.trim() || null,
      logoUrl: logo_url?.trim() || null,
      createdBy: created_by,
    });
  } catch (err) {
    // company_name column may not exist yet — fall back to just "name"
    if (err.message?.includes("company_name")) {
      await insertVentureLegacy({
        ventureId: venture_id,
        name,
        registrationNumber: registration_number?.trim() || null,
        industry: industry.trim(),
        businessStage: business_stage.trim(),
        description: description?.trim() || null,
        website: website?.trim() || null,
        logoUrl: logo_url?.trim() || null,
        createdBy: created_by,
      });
    } else {
      throw err;
    }
  }

  return { venture_id };
}

/**
 * Create a founder record for a venture.
 */
export async function createFounder({
  venture_id,
  email,
  name,
  phone,
  title,
  invitation_token,
}) {
  await insertFounderRecord(
    venture_id,
    email.trim().toLowerCase(),
    name.trim(),
    phone?.trim() || null,
    title?.trim() || null,
    invitation_token,
  );

  return { email };
}

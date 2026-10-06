/**
 * CAMPAIGNS — the audience / step use-cases (retired surface, kept re-enableable).
 *
 * A campaign's steps carry a wait expressed in days / hours / minutes; the stored
 * column is a single `delay_hours`, so the conversion is a decision. The target
 * audience is synced additively: new identities are inserted as pending and
 * dropped ones are removed only while they are still pending (sent records are
 * kept). Creating, updating and loading a campaign are composed here too
 * (createCampaign, updateCampaignDefinition, loadCampaignDetail).
 *
 * Reads and writes go through `@/models/communications`; nothing here runs SQL.
 *
 * See docs/LAYER_SPLIT.md.
 */

import {
  insertCampaign,
  updateCampaign,
  deleteCampaignSteps,
  getCampaignWithCounts,
  getCampaignSteps,
  getCampaignContacts,
  insertCampaignSteps,
  insertCampaignContacts,
  getCampaignContactCids,
  deleteCampaignContacts,
} from "@/models/communications";

/** Map raw step payloads to insert rows, collapsing the wait into `delay_hours`. */
export function campaignStepRows(steps) {
  return steps.map((step) => ({
    subject: step.subject,
    body: step.body,
    delayHours:
      (step.wait_type === "days" ? (step.delay_days || 0) * 24 : 0) +
      (step.wait_type === "hours" ? step.delay_hours || 0 : 0) +
      Math.round((step.wait_type === "minutes" ? step.delay_minutes || 0 : 0) / 60),
  }));
}

/** Insert a campaign's step sequence (no-op for an empty list). */
export async function addCampaignSteps(campaignId, steps) {
  if (!steps || steps.length === 0) return;
  await insertCampaignSteps(campaignId, campaignStepRows(steps));
}

/** Insert new target contacts as pending (no-op for an empty list). */
export async function addCampaignContacts(campaignId, cids) {
  if (!cids || cids.length === 0) return;
  await insertCampaignContacts(campaignId, cids);
}

/**
 * Sync the target audience: keep the existing sent records, insert the new
 * identities as pending, and drop the ones no longer listed (pending only).
 */
export async function syncCampaignAudience(campaignId, cids) {
  const existingCidsResult = await getCampaignContactCids(campaignId);
  const existingCids = existingCidsResult.rows.map((row) => row.contact_cid);

  const toAdd = cids.filter((contactCid) => !existingCids.includes(contactCid));
  await addCampaignContacts(campaignId, toAdd);

  const toRemove = existingCids.filter((contactCid) => !cids.includes(contactCid));
  if (toRemove.length > 0) {
    await deleteCampaignContacts(campaignId, toRemove);
  }
}

/** Create a campaign with its step sequence and target contacts; returns its id. */
export async function createCampaign({ name, formId, steps, cids }) {
  const result = await insertCampaign(name, formId);
  const campaignId = result.rows[0].id;

  await addCampaignSteps(campaignId, steps);
  await addCampaignContacts(campaignId, cids);

  return campaignId;
}

/**
 * Update a campaign. Steps are replaced when `steps` is present (even an empty
 * list clears them); the audience is synced when `cids` is present.
 */
export async function updateCampaignDefinition(id, data) {
  await updateCampaign({ id, name: data.name, formId: data.form_id });

  if (data.steps) {
    await deleteCampaignSteps(id);
    await addCampaignSteps(id, data.steps);
  }

  if (data.cids) {
    await syncCampaignAudience(id, data.cids);
  }
}

/**
 * Stamp every step with the number of contacts already past "pending". The count
 * is campaign-wide, so every step carries the same value.
 */
export function withDeliveredCounts(steps, contacts) {
  const nonPendingCount = contacts.filter((contact) => contact.status !== "pending").length;
  return steps.map((step) => ({ ...step, delivered_count: nonPendingCount }));
}

/** A campaign with its steps and contacts, or null when it does not exist. */
export async function loadCampaignDetail(id) {
  const campaignResult = await getCampaignWithCounts(id);
  const campaign = campaignResult.rows[0];
  if (!campaign) return null;

  const stepsResult = await getCampaignSteps(id);
  const contactsResult = await getCampaignContacts(id);

  return {
    ...campaign,
    steps: withDeliveredCounts(stepsResult.rows, contactsResult.rows),
    contacts: contactsResult.rows,
  };
}

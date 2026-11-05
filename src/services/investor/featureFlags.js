import { selectInvestorFeatureFlags } from "@/models/investor/featureFlags";

export const INVESTOR_FLAGS = Object.freeze({
  profilePrivacy: "investor_profile_privacy_v1",
  visibility: "investor_visibility_v1",
  activity: "investor_activity_v1",
  dashboard: "investor_dashboard_v2",
  introductions: "investor_introductions_v1",
  messaging: "investor_messaging_v1",
  meetings: "investor_meetings_v1",
  investmentConfirmation: "investor_investment_confirmation_v1",
  onboarding: "investor_onboarding_v1",
  nda: "investor_nda_v1",
});

/**
 * Missing keys are OFF. Only a database boolean true enables a switch.
 * No process cache: a successful DB toggle takes effect on the next request.
 * Read errors propagate rather than silently disabling privacy on an outage.
 */
export async function readInvestorFlags() {
  const keys = Object.values(INVESTOR_FLAGS);
  const { rows } = await selectInvestorFeatureFlags(keys);
  const enabled = new Set(rows.filter(row => row.is_enabled === true).map(row => row.flag_key));
  return Object.fromEntries(Object.entries(INVESTOR_FLAGS).map(([name, key]) => [name, enabled.has(key)]));
}

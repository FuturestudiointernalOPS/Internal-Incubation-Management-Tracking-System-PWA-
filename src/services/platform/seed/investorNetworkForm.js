/**
 * Platform — one-click seed: "Join our investors network" (SERVICE layer).
 *
 * A public lead form for the investors page, built INSIDE the existing platform
 * forms engine (no new form system): three sections ("steps"), the questions the
 * studio asked for, a public run and a confirmation message.
 *
 * It is NOT the Investor Application: it carries no `investor_application` flag,
 * so it never competes with the single-form guard and approving one of its
 * submissions creates no account. It is a way to collect interest.
 *
 * Idempotent: re-running reuses the existing form/run and returns the same link.
 * Layer: decisions and orchestration, no SQL, no HTTP.
 */

import { resolveAppUrl } from "@/lib/appUrl";
import { countryName } from "@/lib/countries";
import {
  INVESTOR_COUNTRIES,
  INVESTOR_INDUSTRIES,
  INVESTOR_STAGES,
  INVESTOR_TYPES,
  investorOptionSlug,
} from "@/lib/investorOptions";
import enInvestor from "@/locales/en/investor.json";
import {
  createPlatformForm,
  createPlatformFormField,
  createPlatformFormRun,
  createPlatformFormSection,
  createPlatformFormVersion,
  findActivePlatformFormRun,
  findPlatformFormByName,
} from "@/models/forms/platform";

export const INVESTOR_NETWORK_FORM_NAME = "Join our investors network";

const FORM_DESCRIPTION =
  "Tell us about yourself and what you're looking to back. Our team will get in touch.";

export const SUCCESS_MESSAGE =
  "Thank you. Our team will review your details and be in touch.";

// The stored labels are English; the public form translates its content at read
// time, so French respondents still read the form in French. The label DATA
// comes from the same i18n file every investor surface uses — one source.
const optionLabel = (kind, value) =>
  enInvestor?.investorOptions?.[kind]?.[investorOptionSlug(value)] || String(value);

const typeOptions = INVESTOR_TYPES.map((value) => ({
  value,
  label: optionLabel("types", value),
}));

const sectorOptions = [
  { value: "any", label: "Any sector" },
  ...INVESTOR_INDUSTRIES.map((value) => ({ value, label: optionLabel("industries", value) })),
  { value: "other", label: "Other" },
];

const stageOptions = [
  { value: "any", label: "Any stage" },
  ...INVESTOR_STAGES.map((value) => ({ value, label: optionLabel("stages", value) })),
];

const REGION_OPTIONS = [
  { value: "africa", label: "Anywhere in Africa" },
  { value: "west", label: "West Africa" },
  { value: "central", label: "Central Africa" },
  { value: "east", label: "East Africa" },
  { value: "southern", label: "Southern Africa" },
  { value: "north", label: "North Africa" },
];

const TICKET_OPTIONS = [
  { value: "under_25k", label: "Under $25,000" },
  { value: "25k_100k", label: "$25,000 – $100,000" },
  { value: "100k_500k", label: "$100,000 – $500,000" },
  { value: "500k_1m", label: "$500,000 – $1 million" },
  { value: "over_1m", label: "Over $1 million" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

/** The country dropdown offers the investor list, with readable names. */
const countryOptions = INVESTOR_COUNTRIES.map((code) => ({
  value: code,
  label: countryName(code) || code,
}));

/**
 * The form definition. `field_type` values are the engine's own
 * (text / email / textarea / select / multiselect / checkbox).
 */
export const INVESTOR_NETWORK_SECTIONS = [
  {
    title: "About you",
    fields: [
      { field_type: "text", label: "Full name", required: true },
      { field_type: "email", label: "Email", required: true },
      { field_type: "text", label: "Organization or firm, and your role", required: false },
      { field_type: "select", label: "Country", required: false, options: countryOptions },
      { field_type: "text", label: "LinkedIn or website", required: false },
    ],
  },
  {
    title: "Your investment focus",
    fields: [
      { field_type: "select", label: "Type of investor", required: true, options: typeOptions },
      {
        field_type: "text",
        label: "If Other, please specify your investor type",
        required: false,
      },
      {
        field_type: "multiselect",
        label: "Sectors you invest in",
        required: false,
        options: sectorOptions,
      },
      {
        field_type: "multiselect",
        label: "Stages you invest at",
        required: false,
        options: stageOptions,
      },
      {
        field_type: "multiselect",
        label: "Regions you invest in",
        required: false,
        options: REGION_OPTIONS,
      },
      {
        field_type: "select",
        label: "Typical investment size (USD)",
        required: false,
        options: TICKET_OPTIONS,
      },
    ],
  },
  {
    title: "Anything else",
    fields: [
      { field_type: "textarea", label: "Message", required: false },
      { field_type: "text", label: "How did you hear about us?", required: false },
      {
        field_type: "checkbox",
        label: "I agree to be contacted by Future Studio about investment opportunities.",
        help_text: "Read our privacy policy before agreeing.",
        required: true,
      },
    ],
  },
];

const FORM_SETTINGS = {
  automation: {
    on_submit: { send_acknowledgement: false },
    on_approve: { send_approval_email: false },
    on_reject: { send_rejection_email: false },
    auto_approve: false,
    redirect_after_submit: "",
    success_message: SUCCESS_MESSAGE,
  },
};

function randomSlug() {
  return (
    "r" +
    Array.from({ length: 10 }, () => Math.floor(Math.random() * 16).toString(16)).join("")
  );
}

/**
 * Create (or reuse) the network form, its questions and its public run.
 *
 * @returns {Promise<{status:number, body:object}>}
 */
export async function seedInvestorNetworkForm() {
  const existing = await findPlatformFormByName(INVESTOR_NETWORK_FORM_NAME);
  let form = existing.rows[0];
  const alreadyExisted = Boolean(form);

  if (!form) {
    const created = await createPlatformForm({
      name: INVESTOR_NETWORK_FORM_NAME,
      description: FORM_DESCRIPTION,
      visibility: "public",
      settings: FORM_SETTINGS,
      owner_id: "system",
      owner_name: "Future Studio",
      created_by: "system",
    });
    form = created.rows[0];

    for (let sectionIndex = 0; sectionIndex < INVESTOR_NETWORK_SECTIONS.length; sectionIndex++) {
      const section = INVESTOR_NETWORK_SECTIONS[sectionIndex];
      const sort = sectionIndex + 1;
      const sectionRow = await createPlatformFormSection({
        formId: form.id,
        section: { ...section, sort_order: sort },
      });
      const sectionId = sectionRow.rows[0].id;

      for (let fieldIndex = 0; fieldIndex < section.fields.length; fieldIndex++) {
        await createPlatformFormField({
          formId: form.id,
          sectionId,
          field: { ...section.fields[fieldIndex], sort_order: fieldIndex + 1 },
        });
      }
    }

    await createPlatformFormVersion(
      form.id,
      form.version || 1,
      { name: INVESTOR_NETWORK_FORM_NAME, version: form.version || 1 },
      "system",
    );
  }

  const runResult = await findActivePlatformFormRun(form.id);
  let run = runResult.rows[0];

  if (!run) {
    const createdRun = await createPlatformFormRun({
      formId: form.id,
      formVersion: form.version || 1,
      name: INVESTOR_NETWORK_FORM_NAME,
      description: FORM_DESCRIPTION,
      settings: { confirmation_message: SUCCESS_MESSAGE },
      slug: randomSlug(),
    });
    run = createdRun.rows[0];
  }

  const appUrl = resolveAppUrl();

  return {
    status: 200,
    body: {
      success: true,
      form_id: form.id,
      run_id: run.id,
      slug: run.public_slug,
      url: `${appUrl}/s/${run.public_slug}`,
      already_existed: alreadyExisted,
    },
  };
}

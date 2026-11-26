export const emptyCompany = {name:"",code:"",kind:"company",default_locale:"fr",timezone:"Africa/Porto-Novo",profile:{contact_name:"",contact_email:"",contact_phone:"",website:""},modules:["programs"]};
export const kinds = ["company","university","incubator","ngo","public_body","other"];
export const statuses = ["draft","active","suspended","archived","closed"];
export const modules = ["programs","lms","venture"];
export const roleKeys = ["org_admin","organization_program_editor","lms_content_manager","lms_learner","venture_member"];
export const roleModule = {organization_program_editor:"programs",lms_content_manager:"lms",lms_learner:"lms",venture_member:"venture"};
export const PORTAL_CODE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
export const dateInput = (value) => value ? String(value).slice(0,10) : "";
export const formatDate = (value,lang) => value ? new Date(value).toLocaleString(lang === "fr" ? "fr-FR" : "en-GB") : "—";

/** Match server normalizeWebsite — empty stays empty; bare host gets https:// */
export function normalizeWebsite(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function assertHttpsWebsite(value) {
  if (!value) return "";
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || !url.hostname) {
      throw new Error("admin.whiteLabel.errors.invalidWebsite");
    }
    return url.toString();
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("admin.whiteLabel.")) throw error;
    throw new Error("admin.whiteLabel.errors.invalidWebsite");
  }
}

function todayUtcDate() {
  return new Date().toISOString().slice(0, 10);
}

function assertContractDates(contract) {
  if (!contract || typeof contract !== "object") return;
  const starts = dateInput(contract.starts_at);
  const ends = dateInput(contract.ends_at);
  const signed = dateInput(contract.signed_at);
  if (starts && ends && starts > ends) {
    throw new Error("admin.whiteLabel.errors.invalidContractRange");
  }
  if (signed && signed > todayUtcDate()) {
    throw new Error("admin.whiteLabel.errors.invalidSignedAt");
  }
}

/** Client-side checks aligned with the create/configuration API. Throws Error with i18n key. */
export function prepareCompanyPayload(body, { creating = false } = {}) {
  const payload = {
    ...body,
    name: String(body.name || "").trim(),
    code: String(body.code || "").trim().toLowerCase(),
    profile: {
      contact_name: body.profile?.contact_name || "",
      contact_email: body.profile?.contact_email || "",
      contact_phone: body.profile?.contact_phone || "",
      website: assertHttpsWebsite(normalizeWebsite(body.profile?.website || "")),
    },
    modules: Array.isArray(body.modules) ? body.modules : [],
  };
  if (body.contract) {
    payload.contract = {
      ...body.contract,
      starts_at: dateInput(body.contract.starts_at),
      ends_at: dateInput(body.contract.ends_at),
      signed_at: dateInput(body.contract.signed_at),
    };
    assertContractDates(payload.contract);
  }
  if (!payload.name) throw new Error("errors.invalidRequest");
  if (!PORTAL_CODE.test(payload.code)) throw new Error("admin.whiteLabel.errors.invalidCode");
  if (!payload.modules.length) throw new Error("errors.invalidRequest");
  return payload;
}

export async function saveClient(url,body,method="PATCH") {
  const response = await fetch(url,{method,cache:"no-store",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error(result.error || "errors.somethingWrong");
  return result;
}

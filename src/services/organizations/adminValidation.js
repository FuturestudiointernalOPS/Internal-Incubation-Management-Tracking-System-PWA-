export class WhiteLabelAdminError extends Error {
  constructor(key, status = 400) { super(key); this.key = key; this.status = status; }
}
export const MODULES = ["programs","lms","venture"];
export const CLIENT_ROLES = ["org_admin","organization_program_editor","lms_content_manager","lms_learner","venture_member"];
export const UUID = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
export const invalid = () => { throw new WhiteLabelAdminError("errors.invalidRequest"); };
export const requireId = (value) => { if (typeof value !== "string" || !UUID.test(value)) invalid(); return value; };
export function string(value, max, required = false) {
  if (typeof value !== "string" || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) invalid();
  const result = value.trim();
  if (required && !result) invalid();
  return result;
}
export function selection(value, allowed) {
  if (!Array.isArray(value) || !value.length || value.length > allowed.length || value.some((v) => !allowed.includes(v)) || new Set(value).size !== value.length) invalid();
  return value;
}
export function email(value, required = false) {
  const result = string(value,254,required).toLowerCase();
  if (result && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(result)) invalid();
  return result;
}
export function date(value) {
  if (value === "" || value === null) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) invalid();
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10) !== value) invalid();
  return value;
}
export function company(body) {
  const result = { name:string(body.name,160,true),kind:body.kind,default_locale:body.default_locale,timezone:string(body.timezone,80,true) };
  if (!["company","university","incubator","ngo","public_body","other"].includes(result.kind) || !["fr","en"].includes(result.default_locale)) invalid();
  try { new Intl.DateTimeFormat("en",{timeZone:result.timezone}).format(); } catch { invalid(); }
  return result;
}
export function profile(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) invalid();
  const result = {contact_name:string(body.contact_name,160),contact_email:email(body.contact_email),contact_phone:string(body.contact_phone,60),website:string(body.website,2048)};
  if (result.website) {
    try { const url = new URL(result.website); if (url.protocol !== "https:" || url.username || url.password) invalid(); }
    catch { invalid(); }
  }
  return result;
}
export function contract(body) {
  if (!body || typeof body !== "object") invalid();
  const result = {id:body.id ? requireId(body.id) : null,plan_key:string(body.plan_key,100,true),status:body.status,
    starts_at:date(body.starts_at),ends_at:date(body.ends_at),signed_at:date(body.signed_at)};
  if (!["draft","active","suspended","ended"].includes(result.status)
    || (result.starts_at && result.ends_at && result.starts_at > result.ends_at)
    || (result.signed_at && result.signed_at > new Date().toISOString().slice(0,10))) invalid();
  if (result.status === "active" && !result.signed_at) throw new WhiteLabelAdminError("admin.whiteLabel.errors.contractRequired");
  return result;
}

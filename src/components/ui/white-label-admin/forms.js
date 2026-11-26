export const emptyCompany = {name:"",code:"",kind:"company",default_locale:"fr",timezone:"Africa/Porto-Novo",profile:{contact_name:"",contact_email:"",contact_phone:"",website:""},modules:["programs"]};
export const kinds = ["company","university","incubator","ngo","public_body","other"];
export const statuses = ["draft","active","suspended","archived","closed"];
export const modules = ["programs","lms","venture"];
export const roleKeys = ["org_admin","organization_program_editor","lms_content_manager","lms_learner","venture_member"];
export const roleModule = {organization_program_editor:"programs",lms_content_manager:"lms",lms_learner:"lms",venture_member:"venture"};
export const dateInput = (value) => value ? String(value).slice(0,10) : "";
export const formatDate = (value,lang) => value ? new Date(value).toLocaleString(lang === "fr" ? "fr-FR" : "en-GB") : "—";
export async function saveClient(url,body,method="PATCH") {
  const response = await fetch(url,{method,cache:"no-store",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error(result.error || "errors.somethingWrong");
  return result;
}

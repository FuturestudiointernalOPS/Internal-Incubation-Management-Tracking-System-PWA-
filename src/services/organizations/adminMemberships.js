import { randomUUID } from "node:crypto";
import { hashToken } from "@/lib/token-hashing";
import { WhiteLabelAdminError, CLIENT_ROLES, invalid, requireId, string, email, selection } from "./adminValidation";

function rolesForOffer(roles,current) {
  roles = selection(roles,CLIENT_ROLES);
  const selected = new Set(current.modules.filter((row) => ["enabled","trial"].includes(row.status)).map((row) => row.module_key));
  const required = {organization_program_editor:"programs",lms_content_manager:"lms",lms_learner:"lms",venture_member:"venture"};
  if (roles.some((role) => required[role] && !selected.has(required[role]))) throw new WhiteLabelAdminError("admin.whiteLabel.errors.roleModule");
  return roles;
}
export async function inviteWhiteLabelMember(repository,id,body,current) {
  const values = {name:string(body.name,160,true),email:email(body.email,true),language:current.organization.default_locale};
  const roles = rolesForOffer(body.roles,current);
  const contacts = await repository.contact(values.email);
  if (contacts.length>1) throw new WhiteLabelAdminError("admin.whiteLabel.errors.accountConflict",409);
  const contact = contacts[0];
  if (contact && (contact.deleted !== 0 || contact.deleted_at || !["active","approved","pending"].includes(contact.status)
    || !["member","participant","founder","venture_owner","entrepreneur","investor"].includes(contact.role))) throw new WhiteLabelAdminError("admin.whiteLabel.errors.accountConflict",409);
  const cid = contact?.cid || `USR_${randomUUID().replaceAll("-","").slice(0,12).toUpperCase()}`;
  if (!contact) await repository.insertContact(cid,values);
  const membership = await repository.membership(id,cid);
  if (membership?.status === "suspended") throw new WhiteLabelAdminError("admin.whiteLabel.errors.memberSuspended",409);
  const membershipId = membership?.id || await repository.insertMembership(id,cid);
  await repository.assignRoles(id,membershipId,roles);
  let setupPath = "/login?next=%2Fo%2Fselect";
  if (!contact?.activated) {
    const token = randomUUID();
    await repository.setupToken(cid,hashToken(token),token);
    setupPath = `/setup-password/${token}?next=%2Fo%2Fselect`;
  }
  // Private response only. No passwords changed and no automatic email send.
  return {membershipId,setupPath};
}
export async function updateWhiteLabelMembership(repository,id,body) {
  const membershipId = requireId(body.membership_id);
  if (!["active","suspended","ended"].includes(body.status)) invalid();
  if (!(await repository.changeMembership(id,membershipId,body.status))) throw new WhiteLabelAdminError("admin.whiteLabel.errors.memberEnded",409);
  if (body.status !== "ended" && body.roles) {
    const current = await repository.detail(id);
    await repository.assignRoles(id,membershipId,rolesForOffer(body.roles,current));
  }
}
export async function createWhiteLabelSupervision(repository,id,body) {
  const values = {staff_person_id:string(body.staff_person_id,100,true),reason:string(body.reason,1000,true),hours:body.hours};
  if (!Number.isInteger(values.hours) || values.hours<1 || values.hours>168) invalid();
  if (!(await repository.staff()).some((row) => row.cid === values.staff_person_id)) throw new WhiteLabelAdminError("errors.insufficientPermissions",403);
  await repository.insertSupervision(id,values);
}

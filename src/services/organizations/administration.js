import { createHash } from "node:crypto";
import { hashToken } from "@/lib/token-hashing";
import { getRequestId, newRequestId } from "@/lib/request-context";
import { withWhiteLabelAdministration } from "@/models/organizations/administration";
import { validateOrganizationBranding } from "./branding";
import { WhiteLabelAdminError, MODULES, CLIENT_ROLES, PORTAL_CODE, invalid, requireId, string, selection, company, profile, contract } from "./adminValidation";
import { inviteWhiteLabelMember, updateWhiteLabelMembership, createWhiteLabelSupervision } from "./adminMemberships";

const version = (detail) => createHash("sha256").update(JSON.stringify(detail)).digest("hex");
export function asWhiteLabelOwner(session, callback, write = false) {
  if (!session?.cid || !session?.token) throw new WhiteLabelAdminError("errors.authRequired",401);
  return withWhiteLabelAdministration({cid:session.cid,token:session.token,tokenHash:hashToken(session.token),
    requestId:String(getRequestId() || newRequestId()).slice(0,128)}, async (repository) => {
    if (repository.actor?.role !== "super_admin") throw new WhiteLabelAdminError("errors.insufficientPermissions",403);
    return callback(repository);
  }, {write});
}
export async function listWhiteLabelClients({session,search="",status="",page=1}) {
  search = string(search,100);
  if (!["","draft","active","suspended","archived","closed"].includes(status) || !Number.isInteger(page) || page<1 || page>10000) invalid();
  return asWhiteLabelOwner(session, async (repository) => ({success:true,...await repository.list({search,status,offset:(page-1)*20}),page,pageSize:20}));
}
export async function getWhiteLabelClient({session,id}) {
  requireId(id);
  return asWhiteLabelOwner(session, async (repository) => {
    const detail = await repository.detail(id);
    if (!detail) throw new WhiteLabelAdminError("errors.notFound",404);
    return {success:true,...detail,version:version(detail),members:await repository.people(id),
      history:await repository.history(id),supervision:await repository.supervision(id),staff:await repository.staff(),roleTemplates:CLIENT_ROLES};
  });
}
export async function createWhiteLabelClient({session,body}) {
  if (!body || typeof body !== "object") invalid();
  const values = company(body);
  values.code = string(body.code,40,true).toLowerCase();
  if (!PORTAL_CODE.test(values.code)) throw new WhiteLabelAdminError("admin.whiteLabel.errors.invalidCode");
  const contact = profile(body.profile);
  const modules = selection(body.modules,MODULES);
  return asWhiteLabelOwner(session, async (repository) => {
    const id = await repository.insertOrganization(values);
    await repository.setProfile(id,contact);
    await repository.setModules(id,modules);
    await repository.insertContract(id,{plan_key:"standard",status:"draft",starts_at:null,ends_at:null,signed_at:null});
    await repository.audit(id,"client.created",{modules});
    return {success:true,id};
  },true);
}
export async function mutateWhiteLabelClient({session,id,body}) {
  requireId(id);
  if (!body || typeof body !== "object" || typeof body.version !== "string") invalid();
  return asWhiteLabelOwner(session, async (repository) => {
    const current = await repository.detail(id);
    if (!current) throw new WhiteLabelAdminError("errors.notFound",404);
    if (version(current) !== body.version) throw new WhiteLabelAdminError("admin.whiteLabel.errors.conflict",409);
    if (["closed","archived"].includes(current.organization.status) && !["endSupervision"].includes(body.action)) throw new WhiteLabelAdminError("admin.whiteLabel.errors.closed",409);
    let extra = {};
    if (body.action === "configuration") {
      const values = {...company(body),status:body.status};
      values.code = string(body.code,40,true).toLowerCase();
      if (!PORTAL_CODE.test(values.code)) throw new WhiteLabelAdminError("admin.whiteLabel.errors.invalidCode");
      if (!["draft","active","suspended","archived","closed"].includes(values.status)) invalid();
      const contact = profile(body.profile);
      const modules = selection(body.modules,MODULES);
      const agreement = contract(body.contract);
      const oldContract = current.contracts.find((row) => row.id === agreement.id);
      if (!oldContract) invalid();
      if (oldContract.signed_at && agreement.signed_at === oldContract.signed_at.slice(0,10)) agreement.signed_at = oldContract.signed_at;
      if (oldContract.status === "ended" && ["plan_key","status","starts_at","ends_at","signed_at"].some((key) => agreement[key] !== oldContract[key])) {
        throw new WhiteLabelAdminError("admin.whiteLabel.errors.contractEnded",409);
      }
      const today = new Date().toISOString().slice(0,10);
      if (values.status === "active" && (agreement.status !== "active" || !agreement.signed_at
        || (agreement.starts_at && agreement.starts_at>today) || (agreement.ends_at && agreement.ends_at<today))) throw new WhiteLabelAdminError("admin.whiteLabel.errors.contractRequired");
      if (oldContract.status !== "ended") await repository.updateContract(id,agreement);
      await repository.setModules(id,modules,agreement);
      await repository.setProfile(id,contact);
      await repository.updateOrganization(id,values);
      extra = {modules,status:values.status};
    } else if (body.action === "newContract") {
      if (current.contracts.some((row) => row.status === "active")) throw new WhiteLabelAdminError("admin.whiteLabel.errors.endContract",409);
      await repository.insertContract(id,{plan_key:string(body.plan_key,100,true),status:"draft",starts_at:null,ends_at:null,signed_at:null});
    } else if (body.action === "branding") {
      const branding = validateOrganizationBranding(body.branding);
      if (!branding || !Object.hasOwn(branding,"displayName") || !Object.hasOwn(branding,"logoUrl") || !Object.hasOwn(branding,"primaryColor")) invalid();
      await repository.setBranding(id,branding);
    } else if (body.action === "invite") extra = await inviteWhiteLabelMember(repository,id,body,current);
    else if (body.action === "membership") await updateWhiteLabelMembership(repository,id,body);
    else if (body.action === "supervision") await createWhiteLabelSupervision(repository,id,body);
    else if (body.action === "endSupervision") {
      if (!(await repository.endSupervision(id,requireId(body.grant_id)))) throw new WhiteLabelAdminError("errors.notFound",404);
    } else invalid();
    await repository.touch(id);
    const recordsChanges = ["configuration","branding","newContract"].includes(body.action);
    await repository.audit(id,`client.${body.action}`,{membershipId:extra.membershipId || null,...(body.action === "configuration" ? extra : {})},
      recordsChanges ? current : null,recordsChanges ? await repository.detail(id) : null);
    return {success:true,...extra};
  },true);
}

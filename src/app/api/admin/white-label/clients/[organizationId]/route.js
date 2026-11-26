import { whiteLabelAdminHandler } from "@/server/http/whiteLabelAdministration";
import { getWhiteLabelClient, mutateWhiteLabelClient } from "@/services/organizations/administration";
export const dynamic = "force-dynamic";
export const GET = whiteLabelAdminHandler(async (req,{params}) => getWhiteLabelClient({session:req.session,id:(await params).organizationId}));
export const PATCH = whiteLabelAdminHandler(async (req,{params}) => mutateWhiteLabelClient({session:req.session,id:(await params).organizationId,body:req.bodyData}));

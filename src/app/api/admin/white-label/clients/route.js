import { whiteLabelAdminHandler } from "@/server/http/whiteLabelAdministration";
import { listWhiteLabelClients, createWhiteLabelClient } from "@/services/organizations/administration";
export const dynamic = "force-dynamic";
export const GET = whiteLabelAdminHandler(async (req) => {
  const params = new URL(req.url).searchParams;
  return listWhiteLabelClients({session:req.session,search:params.get("search") || "",status:params.get("status") || "",page:Number(params.get("page") || 1)});
});
export const POST = whiteLabelAdminHandler((req) => createWhiteLabelClient({session:req.session,body:req.bodyData}));

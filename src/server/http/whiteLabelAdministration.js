import { NextResponse } from "next/server";
import { organizationHandler, privateOrganizationHandler } from "./organizationPrograms";
import { WhiteLabelAdminError } from "@/services/organizations/adminValidation";
import { enforceRateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export function whiteLabelAdminHandler(handler) {
  return privateOrganizationHandler(organizationHandler(async (req, context) => {
    try {
      if (req.session.role !== "super_admin") throw new WhiteLabelAdminError("errors.insufficientPermissions",403);
      if (req.method !== "GET") {
        if (req.headers.get("origin") !== new URL(req.url).origin
          || ![null,"same-origin","none"].includes(req.headers.get("sec-fetch-site"))) throw new WhiteLabelAdminError("errors.crossSiteRequestBlocked",403);
        if (!req.headers.get("content-type")?.startsWith("application/json")) throw new WhiteLabelAdminError("errors.invalidRequest");
        const limited = enforceRateLimit(req,`white-label-admin:${req.session.cid}`,{limit:100,windowMs:600000});
        if (limited) return limited;
        const raw = await req.text();
        if (raw.length>32768) throw new WhiteLabelAdminError("errors.invalidRequest",413);
        try { req.bodyData = JSON.parse(raw); } catch { throw new WhiteLabelAdminError("errors.invalidRequest"); }
      }
      return NextResponse.json(await handler(req,context));
    } catch (error) {
      if (error instanceof WhiteLabelAdminError) return NextResponse.json({success:false,error:error.key},{status:error.status});
      if (error.code === "23505") return NextResponse.json({success:false,error:"admin.whiteLabel.errors.duplicate"},{status:409});
      if (error.code === "42P01" || error.code === "42703") return NextResponse.json({success:false,error:"admin.whiteLabel.errors.schemaMissing"},{status:503});
      logger.error("white_label_admin_failed",{name:error.name,code:error.code});
      return NextResponse.json({success:false,error:"errors.somethingWrong"},{status:500});
    }
  }));
}

import { organizationProgramManagementRoute } from "@/server/http/organizationProgramManagement";
export const dynamic = "force-dynamic";
export const GET = organizationProgramManagementRoute("workspace");
export const POST = organizationProgramManagementRoute("cohort.create");

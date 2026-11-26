import { organizationProgramManagementRoute } from "@/server/http/organizationProgramManagement";
export const dynamic = "force-dynamic";
export const GET = organizationProgramManagementRoute("sessions");
export const POST = organizationProgramManagementRoute("session.create");

import { organizationProgramManagementRoute } from "@/server/http/organizationProgramManagement";
export const dynamic = "force-dynamic";
export const GET = organizationProgramManagementRoute("enrollments");
export const POST = organizationProgramManagementRoute("enroll");

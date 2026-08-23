import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { getJobs, getJobStats, retryJob } from "@/lib/ventures";

export const GET = createHandler(
  { roles: ["super_admin"] },
  async (req) => {
    const s = new URL(req.url).searchParams;
    const type = s.get("type");

    if (type === "stats") {
      const results = await getJobStats();
      return NextResponse.json({ success: true, results });
    }

    const status = s.get("status") || undefined;
    const jobType = s.get("job_type") || undefined;
    const limit = s.get("limit") ? parseInt(s.get("limit"), 10) : undefined;
    const offset = s.get("offset") ? parseInt(s.get("offset"), 10) : undefined;

    const results = await getJobs({ status, jobType, limit, offset });
    return NextResponse.json({ success: true, results });
  }
);

export const POST = createHandler(
  { roles: ["super_admin"] },
  async (req) => {
    const body = await req.json();
    const { action, job_id } = body;

    if (action === "retry") {
      const result = await retryJob(job_id);
      return NextResponse.json({ success: true, result });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action" },
      { status: 400 }
    );
  }
);

import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireAuthorization } from "@/lib/authorization";
import { getJobs, getJobStats, retryJob } from "@/lib/ventures";

export const GET = createHandler(async (req) => {
  const capError = await requireAuthorization("settings", "view");
  if (capError) return capError;

  const searchParams = new URL(req.url).searchParams;
    const type = searchParams.get("type");

    if (type === "stats") {
      const results = await getJobStats();
      return NextResponse.json({ success: true, results });
    }

    const status = searchParams.get("status") || undefined;
    const jobType = searchParams.get("job_type") || undefined;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit"), 10) : undefined;
    const offset = searchParams.get("offset") ? parseInt(searchParams.get("offset"), 10) : undefined;

    const results = await getJobs({ status, jobType, limit, offset });
    return NextResponse.json({ success: true, results });
  }
);

export const POST = createHandler(async (req) => {
  const capError = await requireAuthorization("settings", "edit");
  if (capError) return capError;

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

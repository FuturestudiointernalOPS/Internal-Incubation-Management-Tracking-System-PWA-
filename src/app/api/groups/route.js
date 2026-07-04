import { NextResponse } from "next/server";

/**
 * GROUPS API — feature not yet implemented in this schema.
 * The `groups` and `group_default_responsibilities` tables do not exist.
 */

export async function GET() {
  return NextResponse.json(
    { success: false, error: "Groups feature not yet implemented in this schema" },
    { status: 501 },
  );
}

export async function POST() {
  return NextResponse.json(
    { success: false, error: "Groups feature not yet implemented in this schema" },
    { status: 501 },
  );
}

export async function PUT() {
  return NextResponse.json(
    { success: false, error: "Groups feature not yet implemented in this schema" },
    { status: 501 },
  );
}

export async function DELETE() {
  return NextResponse.json(
    { success: false, error: "Groups feature not yet implemented in this schema" },
    { status: 501 },
  );
}

import { NextResponse } from "next/server";

const NOT_AVAILABLE = {
  success: false,
  error: "Forms feature not available in this schema",
};
const STATUS = 501;

export async function GET() {
  return NextResponse.json(NOT_AVAILABLE, { status: STATUS });
}
export async function POST() {
  return NextResponse.json(NOT_AVAILABLE, { status: STATUS });
}
export async function PUT() {
  return NextResponse.json(NOT_AVAILABLE, { status: STATUS });
}
export async function DELETE() {
  return NextResponse.json(NOT_AVAILABLE, { status: STATUS });
}

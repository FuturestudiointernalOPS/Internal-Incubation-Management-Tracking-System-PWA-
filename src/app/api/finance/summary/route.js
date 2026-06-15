import { NextResponse } from 'next/server';
import { getSummary } from '@/lib/finance';

export async function GET() {
  try {
    const summary = getSummary();
    return NextResponse.json({ success: true, ...summary });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

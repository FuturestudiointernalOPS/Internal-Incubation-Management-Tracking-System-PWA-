import { NextResponse } from 'next/server';
import { getSheetJSON, getSheetData } from '@/lib/finance';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const project = searchParams.get('project') || 'Future Studio';

    const sheetMap = {
      'Future Studio': 'Suivi budgétaire',
      "MTN Innovation Lab": "MTN Innovation Lab_2",
      'Sème City': 'SEME CITY',
    };

    const sheetName = sheetMap[project] || 'Suivi budgétaire';
    const rows = getSheetData(sheetName);

    // Extract budget lines (skip header rows)
    const lines = rows.slice(2).filter(r => r[0] && typeof r[0] === 'string' && r[0] !== 'ELEMENTS').map(r => ({
      name: r[0] || '',
      planned: parseFloat(r[r.length > 30 ? 33 : r.length - 3]) || 0,
      actual: parseFloat(r[r.length > 30 ? 34 : r.length - 2]) || 0,
      variance: parseFloat(r[r.length > 30 ? 35 : r.length - 1]) || 0,
    })).filter(l => l.name);

    return NextResponse.json({ success: true, lines });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getSheetData } from '@/lib/finance';

export async function GET() {
  try {
    const rows = getSheetData('Réalisations mensuelles');
    // Row 2 has years, row 3 has months, data rows from 4+
    const years = rows[1] || [];
    const months = rows[2] || [];
    const dataRows = rows.slice(3).filter(r => r.some(c => c !== ''));

    // Build monthly series
    const monthlyData = {};
    const monthNames = ['sept', 'oct', 'nov', 'déc', 'janv', 'févr', 'mars', 'avr', 'mai'];

    dataRows.forEach(row => {
      const category = row[0] || 'Uncategorized';
      for (let i = 0; i < monthNames.length; i++) {
        const colIdx = i * 2 + 1; // alternating prevu/realise
        const actual = parseFloat(row[colIdx]) || 0;
        const month = monthNames[i];
        if (!monthlyData[month]) monthlyData[month] = 0;
        monthlyData[month] += actual;
      }
    });

    const monthly = monthNames.map(m => ({ month: m, amount: monthlyData[m] || 0 }));

    return NextResponse.json({ success: true, monthly });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

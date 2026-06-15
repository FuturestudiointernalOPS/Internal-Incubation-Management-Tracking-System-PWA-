import { NextResponse } from 'next/server';
import { appendTransaction } from '@/lib/finance';

export async function POST(req) {
  try {
    const body = await req.json();

    if (!body.project || !body.budgetLine || !body.date || !body.amount) {
      return NextResponse.json({ success: false, error: 'All fields required.' }, { status: 400 });
    }

    appendTransaction({
      date: body.date,
      supplier: body.supplier || '',
      description: body.description || '',
      category: body.budgetLine || '',
      amount: parseFloat(body.amount) || 0,
      type: body.type || 'expense',
    });

    return NextResponse.json({ success: true, message: 'Transaction logged successfully.' });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

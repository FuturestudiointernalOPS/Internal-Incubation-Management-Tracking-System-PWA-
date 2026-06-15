import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

const FILE_PATH = path.join(process.cwd(), 'finance', 'Tribu_FUTURE_STUDIO_Budget_2025-2026.xlsx');

export function readWorkbook() {
  const buffer = fs.readFileSync(FILE_PATH);
  return XLSX.read(buffer, { type: 'buffer' });
}

export function writeWorkbook(workbook) {
  const newBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  fs.writeFileSync(FILE_PATH, newBuffer);
}

export function getSheetData(sheetName) {
  const workbook = readWorkbook();
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(sheet, { defval: '', header: 1 });
}

// Get raw sheet to JSON
export function getSheetJSON(sheetName) {
  const workbook = readWorkbook();
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(sheet, { defval: '' });
}

// Get headers and data rows from a sheet (skipping header rows)
export function getSheetRows(sheetName, headerRowCount = 1) {
  const data = getSheetData(sheetName);
  const headers = data[headerRowCount - 1] || [];
  const rows = data.slice(headerRowCount).filter(r => r.some(c => c !== ''));
  return { headers, rows };
}

// Parse Excel serial date to ISO string
export function excelDateToISO(serial) {
  if (!serial || typeof serial !== 'number') return serial;
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  const date = new Date(utcValue * 1000);
  return date.toISOString().split('T')[0];
}

// PROJECT_SHEETS mapping
export const PROJECT_SHEETS = {
  'Future Studio': 'Réalisations globales',
  "MTN Innovation Lab": "MTN Innovation Lab_2",
  'Sème City': 'SEME CITY',
  'Master Overview': 'Suivi budgétaire',
};

// Get all transactions from Réalisations globales
export function getTransactions() {
  const rows = getSheetJSON('Réalisations globales');
  return rows.map(r => ({
    date: excelDateToISO(r['TRIBU FUTURE STUDIO'] || r.__EMPTY),
    supplier: r.__EMPTY || '',
    description: r.__EMPTY_1 || '',
    category: r.__EMPTY_2 || '',
    amountSpent: parseFloat(r.__EMPTY_3) || 0,
    amountReceived: parseFloat(r.__EMPTY_4) || 0,
    code: r.__EMPTY_6 || '',
  })).filter(t => t.date || t.supplier || t.description);
}

// Get summary (total budget, spent, remaining, rate)
export function getSummary() {
  const rows = getSheetJSON('Suivi budgétaire');
  let totalPlanned = 0;
  let totalActual = 0;

  rows.forEach(r => {
    const prevu = parseFloat(r.__EMPTY_33);
    const realise = parseFloat(r.__EMPTY_34);
    if (!isNaN(prevu)) totalPlanned += prevu;
    if (!isNaN(realise)) totalActual += realise;
  });

  const remaining = totalPlanned - totalActual;
  const rate = totalPlanned > 0 ? Math.round((totalActual / totalPlanned) * 100) : 0;

  return { totalPlanned, totalActual, remaining, rate };
}

// Append a new row to Réalisations globales
export function appendTransaction(rowData) {
  const workbook = readWorkbook();
  const sheetName = 'Réalisations globales';
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { defval: '', header: 1 });

  // Add new row
  const newRow = [
    rowData.date || '',
    rowData.supplier || '',
    rowData.description || '',
    rowData.category || '',
    rowData.amount || 0,
    rowData.type === 'income' ? rowData.amount : 0,
    '',
    '',
    '',
    '',
    '',
    '',
    ''
  ];
  data.push(newRow);

  workbook.Sheets[sheetName] = XLSX.utils.aoa_to_sheet(data);
  writeWorkbook(workbook);
}

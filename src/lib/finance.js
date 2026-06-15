import * as XLSX from "xlsx";

const GOOGLE_SHEETS_ID = "1h37lmF2HIqhWVZq4MwTuT72SHYVNeNcQ";
const EXPORT_URL = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEETS_ID}/export?format=xlsx`;

let cachedWorkbook = null;

export async function fetchWorkbook() {
  const res = await fetch(EXPORT_URL);
  const buffer = await res.arrayBuffer();
  cachedWorkbook = XLSX.read(buffer, { type: "array" });
  return cachedWorkbook;
}

function getWorkbook() {
  if (!cachedWorkbook)
    throw new Error("Workbook not loaded. Call fetchWorkbook() first.");
  return cachedWorkbook;
}

export async function getSheetData(sheetName) {
  const workbook = await fetchWorkbook();
  const sheet = workbook.Sheets[sheetName];
  return sheet
    ? XLSX.utils.sheet_to_json(sheet, { defval: "", header: 1 })
    : [];
}

export async function getSheetJSON(sheetName) {
  const workbook = await fetchWorkbook();
  const sheet = workbook.Sheets[sheetName];
  return sheet ? XLSX.utils.sheet_to_json(sheet, { defval: "" }) : [];
}

export function excelDateToISO(serial) {
  if (!serial || typeof serial !== "number") return serial || "";
  const utcDays = Math.floor(serial - 25569);
  const date = new Date(utcDays * 86400 * 1000);
  return isNaN(date.getTime())
    ? String(serial)
    : date.toISOString().split("T")[0];
}

export const PROJECT_SHEETS = {
  "Future Studio": "Réalisations globales",
  "MTN Innovation Lab": "MTN Innovation Lab_2",
  "Sème City": "SEME CITY",
  "Master Overview": "Suivi budgétaire",
};

export async function getTransactions() {
  const rows = await getSheetJSON("Réalisations globales");
  return rows
    .map((r) => ({
      date: excelDateToISO(r["TRIBU FUTURE STUDIO"] || r.__EMPTY),
      supplier: r.__EMPTY || "",
      description: r.__EMPTY_1 || "",
      category: r.__EMPTY_2 || "",
      amountSpent: parseFloat(r.__EMPTY_3) || 0,
      amountReceived: parseFloat(r.__EMPTY_4) || 0,
      code: r.__EMPTY_6 || "",
    }))
    .filter((t) => t.date || t.supplier || t.description);
}

export async function getSummary() {
  const rows = await getSheetJSON("Suivi budgétaire");
  let totalPlanned = 0;
  let totalActual = 0;

  rows.forEach((r) => {
    const prevu = parseFloat(r.__EMPTY_33);
    const realise = parseFloat(r.__EMPTY_34);
    if (!isNaN(prevu)) totalPlanned += prevu;
    if (!isNaN(realise)) totalActual += realise;
  });

  const remaining = totalPlanned - totalActual;
  const rate =
    totalPlanned > 0 ? Math.round((totalActual / totalPlanned) * 100) : 0;

  return { totalPlanned, totalActual, remaining, rate };
}

export async function getMonthlyTrend() {
  const rows = await getSheetData("Réalisations mensuelles");
  const months = rows[2] || [];
  const dataRows = rows.slice(3).filter((r) => r.some((c) => c !== ""));

  const monthNames = [
    "sept",
    "oct",
    "nov",
    "déc",
    "janv",
    "févr",
    "mars",
    "avr",
    "mai",
  ];
  const monthlyData = {};

  dataRows.forEach((row) => {
    for (let i = 0; i < monthNames.length; i++) {
      const colIdx = i * 2 + 1;
      const actual = parseFloat(row[colIdx]) || 0;
      const month = monthNames[i];
      if (!monthlyData[month]) monthlyData[month] = 0;
      monthlyData[month] += actual;
    }
  });

  return monthNames.map((m) => ({ month: m, amount: monthlyData[m] || 0 }));
}

export async function getBudgetLines(project) {
  const sheetMap = {
    "Future Studio": "Suivi budgétaire",
    "MTN Innovation Lab": "MTN Innovation Lab_2",
    "Sème City": "SEME CITY",
  };

  const sheetName = sheetMap[project] || "Suivi budgétaire";
  const rows = await getSheetData(sheetName);

  const lines = rows
    .slice(2)
    .filter((r) => r[0] && typeof r[0] === "string" && r[0] !== "ELEMENTS")
    .map((r) => ({
      name: r[0] || "",
      planned: parseFloat(r[33]) || 0,
      actual: parseFloat(r[34]) || 0,
      variance: parseFloat(r[35]) || 0,
    }))
    .filter((l) => l.name);

  return lines;
}

// Append transaction — writes to the Excel file locally (for demo).
// In production, this would use the Google Sheets API.
export function appendTransaction(rowData) {
  console.log("Transaction logged (demo):", rowData);
  // Actual Google Sheets API write can be added later
  return { success: true };
}

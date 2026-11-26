export const STANDARD_CURRENCIES = [
  { code: "XOF", label: "CFA Franc (BCEAO - XOF)", symbol: "CFA" },
  { code: "USD", label: "US Dollar (USD)", symbol: "$" },
  { code: "EUR", label: "Euro (EUR)", symbol: "€" },
  { code: "NGN", label: "Nigerian Naira (NGN)", symbol: "₦" },
  { code: "GBP", label: "British Pound (GBP)", symbol: "£" },
  { code: "XAF", label: "Central African CFA Franc (XAF)", symbol: "FCFA" },
  { code: "GHS", label: "Ghanaian Cedi (GHS)", symbol: "GH₵" },
  { code: "KES", label: "Kenyan Shilling (KES)", symbol: "KSh" },
  { code: "ZAR", label: "South African Rand (ZAR)", symbol: "R" },
  { code: "CAD", label: "Canadian Dollar (CAD)", symbol: "CA$" },
];

export function getCurrencySymbol(code = "XOF") {
  const match = STANDARD_CURRENCIES.find((c) => c.code === code);
  return match?.symbol || code;
}

export function formatCurrencyAmount(amount, currencyCode = "XOF", locale = "en-US") {
  if (amount === null || amount === undefined || !Number.isFinite(Number(amount))) return "—";
  const num = Number(amount);
  const symbol = getCurrencySymbol(currencyCode);
  const formattedNumber = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(num);
  
  // For prefix symbols like $, €, £, CA$, ₦
  if (["$", "€", "£", "₦", "CA$", "GH₵", "R"].includes(symbol)) {
    return `${symbol}${formattedNumber}`;
  }
  // For suffix units like CFA, FCFA, KSh, etc.
  return `${formattedNumber} ${symbol}`;
}

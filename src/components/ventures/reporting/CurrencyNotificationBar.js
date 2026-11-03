"use client";

import { useCallback, useEffect, useState } from "react";
import { Coins, Check, RefreshCw } from "lucide-react";
import { STANDARD_CURRENCIES } from "@/lib/currencies";

export default function CurrencyNotificationBar({ ventureId }) {
  const [currency, setCurrency] = useState("XOF");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const base = `/api/ventures/${encodeURIComponent(ventureId)}/reporting/profile`;

  const loadCurrency = useCallback(async () => {
    if (!ventureId) return;
    try {
      const res = await fetch(base);
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.profile?.reportingCurrency) {
        setCurrency(data.profile.reportingCurrency);
      }
    } catch {
      // fallback
    }
  }, [base, ventureId]);

  useEffect(() => {
    loadCurrency();
  }, [loadCurrency]);

  const handleCurrencyChange = async (e) => {
    const nextCurrency = e.target.value;
    setCurrency(nextCurrency);
    setSaving(true);
    setSaved(false);

    try {
      const res = await fetch(base, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportingCurrency: nextCurrency }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {
      // silent failure
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 rounded-xl border"
      style={{
        backgroundColor: "var(--surface-2)",
        borderColor: "var(--border-primary)",
      }}
    >
      <div className="flex items-center gap-2.5">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: "rgba(var(--brand-orange-rgb, 255, 102, 0), 0.12)", color: "var(--brand-orange)" }}
        >
          <Coins size={15} />
        </div>
        <div>
          <p className="text-xs font-bold text-[var(--text-primary)]">
            Reporting Currency: <span className="text-[var(--brand-orange)] font-black">{currency}</span>
          </p>
          <p className="text-[11px] text-[var(--text-secondary)]">
            Figures submitted in Monthly & Baseline reports are evaluated in this standard. You can change it anytime.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <select
          value={currency}
          onChange={handleCurrencyChange}
          disabled={saving}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg border outline-none bg-[var(--surface-1)] text-[var(--text-primary)] cursor-pointer"
          style={{ borderColor: "var(--border-primary)" }}
        >
          {STANDARD_CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} — {c.label}
            </option>
          ))}
        </select>
        {saving && <RefreshCw size={14} className="animate-spin text-[var(--brand-orange)]" />}
        {saved && (
          <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-500">
            <Check size={13} /> Saved
          </span>
        )}
      </div>
    </div>
  );
}

"use client";

import { useI18n } from "@/lib/i18n";
import InvestorModal from "./InvestorModal";

/**
 * The side-by-side comparison, drawn in the workspace's one window frame and
 * with the shared table look.
 */
export default function ComparisonModal({ compareList, onClose }) {
  const { t } = useI18n();
  return (
    <InvestorModal
      title={t("member.investor.browser.compare.title")}
      onClose={onClose}
      maxWidth="max-w-5xl"
    >
      <div className="stf-tw">
        <table>
          <thead>
            <tr>
              <th className="w-40">{t("member.investor.browser.compare.metric")}</th>
              {compareList.map((item) => (
                <th key={item.id} style={{ color: "var(--brand-orange)" }}>
                  {item.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { label: t("member.investor.browser.compare.industry"), key: "industry" },
              { label: t("member.investor.browser.compare.country"), key: "country" },
              { label: t("member.investor.browser.compare.status"), key: "status" },
              {
                label: t("member.investor.browser.compare.progress"),
                key: "completion_index",
                fmt: (value) => (value ? `${Number(value).toFixed(0)}%` : "—"),
              },
              {
                label: t("member.investor.browser.compare.interest"),
                key: "investor_interest_count",
                fmt: (value) =>
                  t("member.investor.browser.compare.investors", { count: value || 0 }),
              },
              {
                label: t("member.investor.browser.compare.description"),
                key: "description",
                fmt: (value) =>
                  value ? value.substring(0, 100) + (value.length > 100 ? "..." : "") : "—",
              },
            ].map((row) => (
              <tr key={row.key}>
                <td className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  {row.label}
                </td>
                {compareList.map((item) => (
                  <td key={item.id} className="text-xs font-bold">
                    {row.fmt ? row.fmt(item[row.key]) : item[row.key] || "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </InvestorModal>
  );
}

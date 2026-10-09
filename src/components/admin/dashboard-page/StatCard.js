"use client";

import KpiCard from "@/components/ui/KpiCard";

/** One figure of a dashboard section (the shared KPI card). */
export default function StatCard({ title, value, icon, badge, onClick, loading, subtitle }) {
  return <KpiCard label={title} value={value} icon={icon} badge={badge} hint={subtitle} onClick={onClick} loading={loading} />;
}

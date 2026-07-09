"use client";

import { useState, useEffect } from "react";
import { Search, Briefcase } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useRouter } from "next/navigation";

export default function AdminVentures() {
  const [user, setUser] = useState({});
  const [ventures, setVentures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const { t } = useI18n();
  const router = useRouter();

  useEffect(() => {
    const sessionUser = JSON.parse(localStorage.getItem("user") || "{}");
    setUser(sessionUser);
  }, []);

  useEffect(() => {
    async function loadAll() {
      try {
        const res = await fetch("/api/ventures");
        const data = await res.json();
        if (data.success) setVentures(data.ventures);
      } catch (e) {
        console.error("Failed to load ventures", e);
      } finally {
        setLoading(false);
      }
    }
    loadAll();
  }, []);

  const filtered = ventures.filter((v) =>
    v.name?.toLowerCase().includes(search.toLowerCase()) ||
    v.industry?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout role={user.role || "super_admin"}>
      <div className="p-6 space-y-6" style={{ color: "var(--text-primary)" }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t("venture.allVentures")}</h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{t("venture.manageVentures")}</p>
          </div>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-secondary)" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-3 py-2 rounded-lg text-sm outline-none border w-64"
              style={{
                backgroundColor: "rgb(255 255 255 / 0.05)",
                borderColor: "rgb(255 255 255 / 0.1)",
                color: "var(--text-primary)"
              }}
              placeholder={t("common.search") || "Search..."}
            />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12" style={{ color: "var(--text-secondary)" }}>Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16" style={{ color: "var(--text-secondary)" }}>
            <Briefcase size={48} className="mx-auto mb-4 opacity-40" />
            <p>{t("venture.noVentures")}</p>
          </div>
        ) : (
          <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: "rgb(255 255 255 / 0.03)", borderColor: "rgb(255 255 255 / 0.1)" }}>
            <table className="w-full">
              <thead>
                <tr className="border-b" style={{ borderColor: "rgb(255 255 255 / 0.1)" }}>
                  <th className="text-left px-4 py-3 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>{t("venture.namePlaceholder")}</th>
                  <th className="text-left px-4 py-3 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>{t("venture.businessStage")}</th>
                  <th className="text-left px-4 py-3 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>{t("venture.status")}</th>
                  <th className="text-left px-4 py-3 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>{t("venture.founderCount")}</th>
                  <th className="text-left px-4 py-3 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>{t("venture.memberCount")}</th>
                  <th className="text-right px-4 py-3 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>{t("venture.view")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((v) => (
                  <tr key={v.id} className="border-b transition-colors" style={{ borderColor: "rgb(255 255 255 / 0.05)" }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = "rgb(255 255 255 / 0.05)"}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                  >
                    <td className="px-4 py-3 font-medium">{v.name}</td>
                    <td className="px-4 py-3 text-sm" style={{ color: "var(--text-secondary)" }}>
                      <span className="px-2 py-0.5 rounded-full text-xs" style={{ backgroundColor: "rgb(255 255 255 / 0.1)" }}>
                        {t(`venture.stages.${v.business_stage || "idea"}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{
                          backgroundColor: v.status === "active" ? "rgb(16 185 129 / 0.2)" : v.status === "paused" ? "rgb(245 158 11 / 0.2)" : v.status === "graduated" ? "rgb(168 85 247 / 0.2)" : "rgb(255 255 255 / 0.1)",
                          color: v.status === "active" ? "#10b981" : v.status === "paused" ? "#f59e0b" : v.status === "graduated" ? "#a855f7" : "var(--text-secondary)"
                        }}>
                        {t(`venture.statuses.${v.status || "active"}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: "var(--text-secondary)" }}>{v.founder_count || 0}</td>
                    <td className="px-4 py-3 text-sm" style={{ color: "var(--text-secondary)" }}>{v.member_count || 0}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => router.push(`/participant/ventures/${v.id}`)}
                        className="text-sm font-medium transition-colors"
                        style={{ color: "var(--brand-orange)" }}
                      >
                        {t("venture.view")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

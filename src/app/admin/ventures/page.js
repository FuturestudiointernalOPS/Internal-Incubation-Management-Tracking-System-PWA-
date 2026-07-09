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
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t("venture.allVentures")}</h1>
            <p className="text-slate-400 text-sm">{t("venture.manageVentures")}</p>
          </div>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none w-64"
              placeholder={t("common.search") || "Search..."}
            />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-300">
            <Briefcase size={48} className="mx-auto mb-4 opacity-60" />
            <p>{t("venture.noVentures")}</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">{t("venture.namePlaceholder")}</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">{t("venture.businessStage")}</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">{t("venture.status")}</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">{t("venture.founderCount")}</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">{t("venture.memberCount")}</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">{t("venture.view")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((v) => (
                  <tr key={v.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium">{v.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-xs">
                        {t(`venture.stages.${v.business_stage || "idea"}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        v.status === "active" ? "bg-emerald-100 text-emerald-700" :
                        v.status === "paused" ? "bg-amber-100 text-amber-700" :
                        v.status === "graduated" ? "bg-purple-100 text-purple-700" :
                        "bg-slate-100 text-slate-600"
                      }`}>
                        {t(`venture.statuses.${v.status || "active"}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{v.founder_count || 0}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{v.member_count || 0}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => router.push(`/participant/ventures/${v.id}`)}
                        className="text-sm text-emerald-600 hover:text-emerald-800 font-medium"
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

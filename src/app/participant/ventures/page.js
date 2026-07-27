"use client";

import { useState, useEffect } from "react";
import { Plus, Briefcase, Loader2, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useRouter } from "next/navigation";

export default function ParticipantVentures() {
  const [user, setUser] = useState({});
  const [ventures, setVentures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    industry: "",
    business_stage: "idea",
  });
  const { t } = useI18n();
  const router = useRouter();

  useEffect(() => {
    const sessionUser = JSON.parse(localStorage.getItem("user") || "{}");
    setUser(sessionUser);
  }, []);

  useEffect(() => {
    if (!user.cid) return;
    async function loadVentures() {
      try {
        const res = await fetch(`/api/ventures?contact_id=${user.cid}`);
        const data = await res.json();
        if (data.success) setVentures(data.ventures);
      } catch (e) {
        console.error("Failed to load ventures", e);
      } finally {
        setLoading(false);
      }
    }
    loadVentures();
  }, [user]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/ventures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          industry: form.industry,
          business_stage: form.business_stage,
          created_by: user.cid,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowModal(false);
        setForm({ name: "", description: "", industry: "", business_stage: "idea" });
        const reload = await fetch(`/api/ventures?contact_id=${user.cid}`);
        const reloadData = await reload.json();
        if (reloadData.success) setVentures(reloadData.ventures);
      } else {
        alert(data.error || t("venture.createError"));
      }
    } catch (e) {
      console.error("Create venture error", e);
      alert(t("venture.createError"));
    } finally {
      setCreating(false);
    }
  }

  const stageOptions = ["idea", "validation", "mvp", "growth", "scale"];

  return (
    <DashboardLayout role={user.role || "participant"}>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{t("venture.myVentures")}</h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{t("venture.title")}</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-white"
            style={{ backgroundColor: "var(--brand-orange)" }}
          >
            <Plus size={18} />
            {t("venture.createVenture")}
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin" style={{ color: "var(--text-secondary)" }} size={32} />
          </div>
        ) : ventures.length === 0 ? (
          <div className="text-center py-16" style={{ color: "var(--text-secondary)" }}>
            <Briefcase size={48} className="mx-auto mb-4 opacity-40" />
            <p>{t("venture.noVentures")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ventures.map((v) => (
              <div
                key={v.id}
                onClick={() => router.push(`/participant/ventures/${v.id}`)}
                className="rounded-xl p-5 transition-all cursor-pointer border"
                style={{
                  backgroundColor: "rgb(255 255 255 / 0.05)",
                  borderColor: "rgb(255 255 255 / 0.1)",
                  color: "var(--text-primary)"
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--brand-orange)"; e.currentTarget.style.boxShadow = "0 4px 20px rgb(255 102 0 / 0.15)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "rgb(255 255 255 / 0.1)"; e.currentTarget.style.boxShadow = "none"; }}
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-lg">{v.name}</h3>
                  <span className="text-xs px-2 py-1 rounded-full font-medium"
                    style={{
                      backgroundColor: v.status === "active" ? "rgb(16 185 129 / 0.2)" : v.status === "paused" ? "rgb(245 158 11 / 0.2)" : v.status === "graduated" ? "rgb(168 85 247 / 0.2)" : "rgb(255 255 255 / 0.1)",
                      color: v.status === "active" ? "#10b981" : v.status === "paused" ? "#f59e0b" : v.status === "graduated" ? "#a855f7" : "var(--text-secondary)"
                    }}
                  >
                    {t(`venture.statuses.${v.status || "active"}`)}
                  </span>
                </div>
                {v.description && (
                  <p className="text-sm mb-3 line-clamp-2" style={{ color: "var(--text-secondary)" }}>{v.description}</p>
                )}
                <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                  <span>{t(`venture.stages.${v.business_stage || "idea"}`)}</span>
                  <span>•</span>
                  <span>{v.founder_count || 0} {t("venture.founderCount")}</span>
                  {v.industry && (
                    <>
                      <span>•</span>
                      <span>{v.industry}</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: "rgb(0 0 0 / 0.6)" }} onClick={() => setShowModal(false)}>
          <div className="rounded-2xl p-6 w-full max-w-lg mx-4 shadow-xl border" style={{ backgroundColor: "#0f172a", borderColor: "rgb(255 255 255 / 0.1)", color: "var(--text-primary)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">{t("venture.createVenture")}</h2>
              <button onClick={() => setShowModal(false)} style={{ color: "var(--text-secondary)" }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>
                  {t("venture.namePlaceholder")} *
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg outline-none border"
                  style={{
                    backgroundColor: "rgb(15 23 42)",
                    borderColor: "rgb(255 255 255 / 0.15)",
                    color: "var(--text-primary)"
                  }}
                  placeholder={t("venture.namePlaceholder")}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>
                  {t("venture.description")}
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg outline-none border"
                  style={{
                    backgroundColor: "rgb(15 23 42)",
                    borderColor: "rgb(255 255 255 / 0.15)",
                    color: "var(--text-primary)"
                  }}
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>
                  {t("venture.industry")}
                </label>
                <input
                  value={form.industry}
                  onChange={(e) => setForm({ ...form, industry: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg outline-none border"
                  style={{
                    backgroundColor: "rgb(15 23 42)",
                    borderColor: "rgb(255 255 255 / 0.15)",
                    color: "var(--text-primary)"
                  }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>
                  {t("venture.businessStage")}
                </label>
                <select
                  value={form.business_stage}
                  onChange={(e) => setForm({ ...form, business_stage: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg outline-none border"
                  style={{
                    backgroundColor: "rgb(15 23 42)",
                    borderColor: "rgb(255 255 255 / 0.15)",
                    color: "var(--text-primary)"
                  }}
                >
                  {stageOptions.map((s) => (
                    <option key={s} value={s}>{t(`venture.stages.${s}`)}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {t("venture.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={creating || !form.name.trim()}
                  className="px-6 py-2 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  style={{ backgroundColor: "var(--brand-orange)" }}
                >
                  {creating ? t("venture.creating") : t("venture.createVenture")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

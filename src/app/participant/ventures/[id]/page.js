"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Save, Loader2, ExternalLink } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useRouter, useParams } from "next/navigation";

export default function VentureDetail() {
  const [user, setUser] = useState({});
  const [venture, setVenture] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");
  const [form, setForm] = useState({});
  const { t } = useI18n();
  const router = useRouter();
  const params = useParams();

  useEffect(() => {
    const sessionUser = JSON.parse(localStorage.getItem("user") || "{}");
    setUser(sessionUser);
  }, []);

  useEffect(() => {
    async function loadVenture() {
      try {
        const res = await fetch(`/api/ventures/${params.id}`);
        const data = await res.json();
        if (data.success) {
          setVenture(data.venture);
          // Parse JSON fields
          const v = data.venture;
          setForm({
            name: v.name || "",
            description: v.description || "",
            mission: v.mission || "",
            vision: v.vision || "",
            industry: v.industry || "",
            sector: v.sector || "",
            business_stage: v.business_stage || "idea",
            website: v.website || "",
            twitter: v.social_media?.twitter || "",
            linkedin: v.social_media?.linkedin || "",
            instagram: v.social_media?.instagram || "",
            status: v.status || "active",
            visibility: v.visibility || "private",
            language: v.language || "en",
            brandColor: v.branding?.color || "#10b981",
          });
        }
      } catch (e) {
        console.error("Failed to load venture", e);
      } finally {
        setLoading(false);
      }
    }
    loadVenture();
  }, [params.id]);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        id: params.id,
        name: form.name,
        description: form.description || null,
        mission: form.mission || null,
        vision: form.vision || null,
        industry: form.industry || null,
        sector: form.sector || null,
        business_stage: form.business_stage,
        website: form.website || null,
        social_media: {
          twitter: form.twitter || "",
          linkedin: form.linkedin || "",
          instagram: form.instagram || "",
        },
        status: form.status,
        visibility: form.visibility,
        language: form.language,
        branding: {
          color: form.brandColor || "#10b981",
        },
      };

      const res = await fetch("/api/ventures", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        alert(t("venture.updateSuccess"));
      } else {
        alert(data.error || t("venture.updateError"));
      }
    } catch (e) {
      console.error("Save venture error", e);
      alert(t("venture.updateError"));
    } finally {
      setSaving(false);
    }
  }

  const stageOptions = ["idea", "validation", "mvp", "growth", "scale"];
  const statusOptions = ["active", "paused", "graduated", "archived"];
  const visibilityOptions = ["private", "public", "inviteOnly"];

  if (loading) {
    return (
      <DashboardLayout role={user.role || "participant"}>
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-slate-400" size={32} /></div>
      </DashboardLayout>
    );
  }

  if (!venture) {
    return (
      <DashboardLayout role={user.role || "participant"}>
        <div className="p-6 text-center text-slate-500">{t("venture.loadError")}</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role={user.role || "participant"}>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        {/* Back */}
        <button
        onClick={() => router.push("/participant/ventures")}
        className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors"
      >
        <ArrowLeft size={18} />
        {t("venture.myVentures")}
      </button>

        {/* Header */}
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-xl"
            style={{ backgroundColor: venture.branding?.color || "#10b981" }}
          >
            {venture.name?.charAt(0)?.toUpperCase() || "V"}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{venture.name}</h1>
            <p className="text-slate-400 text-sm">
              {t(`venture.stages.${venture.business_stage || "idea"}`)}
              {venture.industry && <> • {venture.industry}</>}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-200">
          <button
            onClick={() => setActiveTab("profile")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "profile"
                ? "border-emerald-600 text-emerald-600"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            {t("venture.profile")}
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "settings"
                ? "border-emerald-600 text-emerald-600"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            {t("venture.settings")}
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {activeTab === "profile" ? (
            <div className="bg-white rounded-xl p-6 space-y-4 text-slate-900">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t("venture.namePlaceholder")}</label>
                <input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t("venture.description")}</label>
                <textarea value={form.description} onChange={(e) => setForm({...form, description: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" rows={3} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t("venture.mission")}</label>
                  <textarea value={form.mission} onChange={(e) => setForm({...form, mission: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" rows={2} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t("venture.vision")}</label>
                  <textarea value={form.vision} onChange={(e) => setForm({...form, vision: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" rows={2} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t("venture.industry")}</label>
                  <input value={form.industry} onChange={(e) => setForm({...form, industry: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t("venture.sector")}</label>
                  <input value={form.sector} onChange={(e) => setForm({...form, sector: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t("venture.businessStage")}</label>
                <select value={form.business_stage} onChange={(e) => setForm({...form, business_stage: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none">
                  {stageOptions.map((s) => <option key={s} value={s}>{t(`venture.stages.${s}`)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t("venture.website")}</label>
                <input value={form.website} onChange={(e) => setForm({...form, website: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="https://" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t("venture.socialMedia")}</label>
                <div className="space-y-2">
                  <input value={form.twitter} onChange={(e) => setForm({...form, twitter: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" placeholder={t("venture.twitter")} />
                  <input value={form.linkedin} onChange={(e) => setForm({...form, linkedin: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" placeholder={t("venture.linkedin")} />
                  <input value={form.instagram} onChange={(e) => setForm({...form, instagram: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" placeholder={t("venture.instagram")} />
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl p-6 space-y-4 text-slate-900">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t("venture.status")}</label>
                <select value={form.status} onChange={(e) => setForm({...form, status: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none">
                  {statusOptions.map((s) => <option key={s} value={s}>{t(`venture.statuses.${s}`)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t("venture.businessStage")}</label>
                <select value={form.business_stage} onChange={(e) => setForm({...form, business_stage: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none">
                  {stageOptions.map((s) => <option key={s} value={s}>{t(`venture.stages.${s}`)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t("venture.visibility")}</label>
                <select value={form.visibility} onChange={(e) => setForm({...form, visibility: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none">
                  {visibilityOptions.map((v) => <option key={v} value={v}>{t(`venture.visibilityOptions.${v}`)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t("venture.language")}</label>
                <select value={form.language} onChange={(e) => setForm({...form, language: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none">
                  <option value="en">English</option>
                  <option value="fr">Français</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t("venture.branding")}</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={form.brandColor} onChange={(e) => setForm({...form, brandColor: e.target.value})}
                    className="w-12 h-10 rounded border border-slate-300 cursor-pointer" />
                  <input value={form.brandColor} onChange={(e) => setForm({...form, brandColor: e.target.value})}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-mono text-sm" placeholder="#10b981" />
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-4 border-t border-slate-200">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? t("venture.saving") : t("venture.save")}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}

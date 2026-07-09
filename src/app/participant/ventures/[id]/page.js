"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Save, Loader2, UserPlus, X, Users, BarChart3, Clock, History } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useRouter, useParams } from "next/navigation";

const TABS = ["profile", "settings", "founders", "team", "dashboard", "history"];
const STAGES = ["idea", "validation", "mvp", "growth", "scale"];
const STATUSES = ["active", "paused", "graduated", "archived"];
const VISIBILITIES = ["private", "public", "inviteOnly"];

export default function VentureDetail() {
  const [user, setUser] = useState({});
  const [venture, setVenture] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");
  const [form, setForm] = useState({});

  // Members state
  const [members, setMembers] = useState([]);
  const [dashboardData, setDashboardData] = useState(null);
  const [historyData, setHistoryData] = useState(null);

  // Add member modal
  const [showAddMember, setShowAddMember] = useState(false);
  const [addMemberType, setAddMemberType] = useState("founder");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState(null);

  const { t } = useI18n();
  const router = useRouter();
  const params = useParams();

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem("user") || "{}");
    setUser(u);
  }, []);

  // Load venture
  useEffect(() => {
    if (!params.id) return;
    (async () => {
      try {
        const res = await fetch(`/api/ventures/${params.id}`);
        const d = await res.json();
        if (d.success) {
          setVenture(d.venture);
          const v = d.venture;
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
            brandColor: v.branding?.color || "#f60",
          });
        }
      } catch (e) {
        console.error("Failed to load venture", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [params.id]);

  // Load members, dashboard, history for their tabs
  useEffect(() => {
    if (!params.id || !venture) return;
    if (activeTab === "founders" || activeTab === "team") loadMembers();
    if (activeTab === "dashboard") loadDashboard();
    if (activeTab === "history") loadHistory();
  }, [activeTab, venture, params.id]);

  async function loadMembers() {
    try {
      const res = await fetch(`/api/ventures/${params.id}/members`);
      const d = await res.json();
      if (d.success) setMembers(d.members);
    } catch (e) { console.error(e); }
  }

  async function loadDashboard() {
    try {
      const res = await fetch(`/api/ventures/${params.id}/dashboard`);
      const d = await res.json();
      if (d.success) setDashboardData(d);
    } catch (e) { console.error(e); }
  }

  async function loadHistory() {
    try {
      const res = await fetch(`/api/ventures/${params.id}/history`);
      const d = await res.json();
      if (d.success) setHistoryData(d);
    } catch (e) { console.error(e); }
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        id: params.id,
        name: form.name, description: form.description || null,
        mission: form.mission || null, vision: form.vision || null,
        industry: form.industry || null, sector: form.sector || null,
        business_stage: form.business_stage, website: form.website || null,
        social_media: { twitter: form.twitter || "", linkedin: form.linkedin || "", instagram: form.instagram || "" },
        status: form.status, visibility: form.visibility, language: form.language,
        branding: { color: form.brandColor || "#f60" },
      };
      const res = await fetch("/api/ventures", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      alert(d.success ? t("venture.updateSuccess") : (d.error || t("venture.updateError")));
    } catch (e) {
      alert(t("venture.updateError"));
    } finally { setSaving(false); }
  }

  async function handleAddMember(contactId) {
    try {
      const res = await fetch(`/api/ventures/${params.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact_id: contactId, member_type: addMemberType, invited_by: user.cid }),
      });
      const d = await res.json();
      if (d.success) {
        setShowAddMember(false);
        setSearchQuery("");
        setSearchResults([]);
        await loadMembers();
      } else {
        alert(d.error || t("venture.addError"));
      }
    } catch (e) { alert(t("venture.addError")); }
  }

  async function handleRemoveMember(memberId) {
    try {
      const res = await fetch(`/api/ventures/${params.id}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: memberId, action: "remove" }),
      });
      const d = await res.json();
      if (d.success) {
        setRemoveConfirm(null);
        await loadMembers();
      } else {
        alert(d.error || t("venture.removeError"));
      }
    } catch (e) { alert(t("venture.removeError")); }
  }

  async function searchContacts(q) {
    if (!q || q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`/api/contacts/search?q=${encodeURIComponent(q)}`);
      const d = await res.json();
      if (d.success) {
        const existingIds = new Set(members.map(m => m.contact_id));
        setSearchResults((d.contacts || []).filter(c => !existingIds.has(c.cid)));
      }
    } catch (e) { console.error(e); }
    finally { setSearching(false); }
  }

  function getFounders() { return members.filter(m => m.member_type === "founder"); }
  function getTeam() { return members.filter(m => m.member_type === "team_member"); }

  const inputStyle = { backgroundColor: "rgb(15 23 42)", borderColor: "rgb(255 255 255 / 0.15)", color: "var(--text-primary)" };
  const cardStyle = { backgroundColor: "rgb(255 255 255 / 0.05)", borderColor: "rgb(255 255 255 / 0.1)" };

  if (loading) return (
    <DashboardLayout role={user.role || "participant"}>
      <div className="flex justify-center py-20"><Loader2 className="animate-spin" style={{ color: "var(--text-secondary)" }} size={32} /></div>
    </DashboardLayout>
  );

  if (!venture) return (
    <DashboardLayout role={user.role || "participant"}>
      <div className="p-6 text-center" style={{ color: "var(--text-secondary)" }}>{t("venture.loadError")}</div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout role={user.role || "participant"}>
      <div className="p-6 max-w-4xl mx-auto space-y-6" style={{ color: "var(--text-primary)" }}>
        {/* Back */}
        <button onClick={() => router.push("/participant/ventures")} className="flex items-center gap-2 transition-colors" style={{ color: "var(--text-secondary)" }}>
          <ArrowLeft size={18} /> {t("venture.myVentures")}
        </button>

        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-xl" style={{ backgroundColor: form.brandColor || "#f60" }}>
            {venture.name?.charAt(0)?.toUpperCase() || "V"}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{venture.name}</h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {t(`venture.stages.${venture.business_stage || "idea"}`)}{venture.industry && <> • {venture.industry}</>}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b flex-wrap" style={{ borderColor: "rgb(255 255 255 / 0.1)" }}>
          {TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className="px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize"
              style={{
                borderColor: activeTab === tab ? "var(--brand-orange)" : "transparent",
                color: activeTab === tab ? "var(--brand-orange)" : "var(--text-secondary)",
              }}
            >{t(`venture.${tab}`)}</button>
          ))}
        </div>

        {/* Profile Tab */}
        {activeTab === "profile" && (
          <form onSubmit={handleSave} className="space-y-6">
            <div className="rounded-xl p-6 space-y-4 border" style={cardStyle}>
              <div>
                <label className="block text-sm font-medium mb-1">{t("venture.namePlaceholder")}</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                  className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t("venture.description")}</label>
                <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                  className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} rows={3} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">{t("venture.mission")}</label>
                  <textarea value={form.mission} onChange={e => setForm({...form, mission: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} rows={2} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t("venture.vision")}</label>
                  <textarea value={form.vision} onChange={e => setForm({...form, vision: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} rows={2} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">{t("venture.industry")}</label>
                  <input value={form.industry} onChange={e => setForm({...form, industry: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t("venture.sector")}</label>
                  <input value={form.sector} onChange={e => setForm({...form, sector: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t("venture.businessStage")}</label>
                <select value={form.business_stage} onChange={e => setForm({...form, business_stage: e.target.value})}
                  className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle}>
                  {STAGES.map(s => <option key={s} value={s}>{t(`venture.stages.${s}`)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t("venture.website")}</label>
                <input value={form.website} onChange={e => setForm({...form, website: e.target.value})}
                  className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} placeholder="https://" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t("venture.socialMedia")}</label>
                <div className="space-y-2">
                  <input value={form.twitter} onChange={e => setForm({...form, twitter: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} placeholder={t("venture.twitter")} />
                  <input value={form.linkedin} onChange={e => setForm({...form, linkedin: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} placeholder={t("venture.linkedin")} />
                  <input value={form.instagram} onChange={e => setForm({...form, instagram: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} placeholder={t("venture.instagram")} />
                </div>
              </div>
            </div>
            <div className="flex justify-end pt-4 border-t" style={{ borderColor: "rgb(255 255 255 / 0.1)" }}>
              <button type="submit" disabled={saving}
                className="flex items-center gap-2 px-6 py-2 rounded-lg text-white disabled:opacity-50 transition-colors"
                style={{ backgroundColor: "var(--brand-orange)" }}>
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {saving ? t("venture.saving") : t("venture.save")}
              </button>
            </div>
          </form>
        )}

        {/* Settings Tab */}
        {activeTab === "settings" && (
          <form onSubmit={handleSave} className="space-y-6">
            <div className="rounded-xl p-6 space-y-4 border" style={cardStyle}>
              <div>
                <label className="block text-sm font-medium mb-1">{t("venture.status")}</label>
                <select value={form.status} onChange={e => setForm({...form, status: e.target.value})}
                  className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle}>
                  {STATUSES.map(s => <option key={s} value={s}>{t(`venture.statuses.${s}`)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t("venture.businessStage")}</label>
                <select value={form.business_stage} onChange={e => setForm({...form, business_stage: e.target.value})}
                  className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle}>
                  {STAGES.map(s => <option key={s} value={s}>{t(`venture.stages.${s}`)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t("venture.visibility")}</label>
                <select value={form.visibility} onChange={e => setForm({...form, visibility: e.target.value})}
                  className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle}>
                  {VISIBILITIES.map(v => <option key={v} value={v}>{t(`venture.visibilityOptions.${v}`)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t("venture.language")}</label>
                <select value={form.language} onChange={e => setForm({...form, language: e.target.value})}
                  className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle}>
                  <option value="en">English</option><option value="fr">Français</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t("venture.branding")}</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={form.brandColor} onChange={e => setForm({...form, brandColor: e.target.value})}
                    className="w-12 h-10 rounded border cursor-pointer" style={{ borderColor: "rgb(255 255 255 / 0.15)", backgroundColor: "transparent" }} />
                  <input value={form.brandColor} onChange={e => setForm({...form, brandColor: e.target.value})}
                    className="flex-1 px-3 py-2 rounded-lg outline-none border font-mono text-sm" style={inputStyle} />
                </div>
              </div>
            </div>
            <div className="flex justify-end pt-4 border-t" style={{ borderColor: "rgb(255 255 255 / 0.1)" }}>
              <button type="submit" disabled={saving}
                className="flex items-center gap-2 px-6 py-2 rounded-lg text-white disabled:opacity-50 transition-colors"
                style={{ backgroundColor: "var(--brand-orange)" }}>
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {saving ? t("venture.saving") : t("venture.save")}
              </button>
            </div>
          </form>
        )}

        {/* Founders Tab */}
        {activeTab === "founders" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t("venture.founders")} ({getFounders().length})</h2>
              <button onClick={() => { setAddMemberType("founder"); setShowAddMember(true); }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-white transition-colors"
                style={{ backgroundColor: "var(--brand-orange)" }}>
                <UserPlus size={16} /> {t("venture.addFounder")}
              </button>
            </div>
            <div className="rounded-xl border" style={cardStyle}>
              {getFounders().length === 0 ? (
                <div className="p-6 text-center" style={{ color: "var(--text-secondary)" }}>{t("venture.noFoundersYet")}</div>
              ) : getFounders().map(m => (
                <div key={m.id} className="flex items-center justify-between p-4 border-b last:border-0" style={{ borderColor: "rgb(255 255 255 / 0.05)" }}>
                  <div>
                    <p className="font-medium">{m.contact_name || m.contact_id}</p>
                    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      {m.role || t("venture.founders")} • {t("venture.memberSince")} {new Date(m.joined_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button onClick={() => setRemoveConfirm(m)}
                    className="text-xs px-3 py-1 rounded-lg transition-colors"
                    style={{ color: "var(--text-secondary)", border: "1px solid rgb(255 255 255 / 0.15)" }}>
                    {t("venture.remove")}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Team Tab */}
        {activeTab === "team" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t("venture.teamMembers")} ({getTeam().length})</h2>
              <button onClick={() => { setAddMemberType("team_member"); setShowAddMember(true); }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-white transition-colors"
                style={{ backgroundColor: "var(--brand-orange)" }}>
                <UserPlus size={16} /> {t("venture.addTeamMember")}
              </button>
            </div>
            <div className="rounded-xl border" style={cardStyle}>
              {getTeam().length === 0 ? (
                <div className="p-6 text-center" style={{ color: "var(--text-secondary)" }}>{t("venture.noTeamMembersYet")}</div>
              ) : getTeam().map(m => (
                <div key={m.id} className="flex items-center justify-between p-4 border-b last:border-0" style={{ borderColor: "rgb(255 255 255 / 0.05)" }}>
                  <div>
                    <p className="font-medium">{m.contact_name || m.contact_id}</p>
                    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      {m.role || t("venture.teamMembers")} • {t("venture.memberSince")} {new Date(m.joined_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button onClick={() => setRemoveConfirm(m)}
                    className="text-xs px-3 py-1 rounded-lg transition-colors"
                    style={{ color: "var(--text-secondary)", border: "1px solid rgb(255 255 255 / 0.15)" }}>
                    {t("venture.remove")}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dashboard Tab */}
        {activeTab === "dashboard" && (
          <div className="space-y-4">
            {!dashboardData ? (
              <div className="text-center py-8"><Loader2 className="animate-spin mx-auto" style={{ color: "var(--text-secondary)" }} size={24} /></div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: t("venture.founderCount"), value: dashboardData.venture.founder_count, icon: Users },
                    { label: t("venture.memberCount"), value: dashboardData.venture.member_count, icon: Users },
                    { label: t("venture.businessStage"), value: t(`venture.stages.${dashboardData.venture.business_stage || "idea"}`), icon: BarChart3 },
                    { label: t("venture.status"), value: t(`venture.statuses.${dashboardData.venture.status || "active"}`), icon: Clock },
                  ].map((stat, i) => (
                    <div key={i} className="rounded-xl p-4 border" style={cardStyle}>
                      <stat.icon size={18} className="mb-2" style={{ color: "var(--brand-orange)" }} />
                      <p className="text-2xl font-bold">{stat.value}</p>
                      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{stat.label}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl p-6 border" style={cardStyle}>
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Clock size={16} style={{ color: "var(--brand-orange)" }} />
                    {t("venture.recentActivity")}
                  </h3>
                  {dashboardData.recent_activity?.length === 0 ? (
                    <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{t("venture.noTeamMembersYet")}</p>
                  ) : dashboardData.recent_activity?.map((a, i) => (
                    <div key={i} className="flex items-center gap-3 py-2 border-b last:border-0 text-sm" style={{ borderColor: "rgb(255 255 255 / 0.05)" }}>
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "var(--brand-orange)" }} />
                      <span className="font-medium">{a.contact_name || a.contact_id}</span>
                      <span style={{ color: "var(--text-secondary)" }}>{a.member_type === "founder" ? t("venture.founders") : t("venture.teamMembers")}</span>
                      <span style={{ color: "var(--text-secondary)" }}>• {new Date(a.joined_at).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === "history" && (
          <div className="space-y-4">
            {!historyData ? (
              <div className="text-center py-8"><Loader2 className="animate-spin mx-auto" style={{ color: "var(--text-secondary)" }} size={24} /></div>
            ) : (
              <>
                {historyData.previous_program && (
                  <div className="rounded-xl p-6 border" style={cardStyle}>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <History size={16} style={{ color: "var(--brand-orange)" }} />
                      {t("venture.previousProgram")}
                    </h3>
                    <p className="font-medium">{historyData.previous_program.name}</p>
                    {historyData.previous_program.start_date && (
                      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                        {new Date(historyData.previous_program.start_date).toLocaleDateString()}
                        {historyData.previous_program.end_date && ` - ${new Date(historyData.previous_program.end_date).toLocaleDateString()}`}
                      </p>
                    )}
                    {historyData.previous_program.deliverables?.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>{t("venture.deliverables")}:</p>
                        <div className="flex flex-wrap gap-1">
                          {historyData.previous_program.deliverables.map((d, i) => (
                            <span key={i} className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgb(255 255 255 / 0.1)" }}>{d}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {historyData.graduation ? (
                  <div className="rounded-xl p-6 border" style={cardStyle}>
                    <h3 className="font-semibold mb-2">{t("venture.graduationInfo")}</h3>
                    <p className="text-sm">{new Date(historyData.graduation.graduated_at).toLocaleDateString()}</p>
                    {historyData.graduation.graduation_notes && (
                      <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>{historyData.graduation.graduation_notes}</p>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl p-6 border" style={cardStyle}>
                    <h3 className="font-semibold mb-2">{t("venture.graduationInfo")}</h3>
                    <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{t("venture.notYetGraduated")}</p>
                  </div>
                )}

                <div className="rounded-xl p-6 border" style={cardStyle}>
                  <h3 className="font-semibold mb-3">{t("venture.founderHistory")}</h3>
                  {historyData.founder_history?.length === 0 ? (
                    <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{t("venture.noFoundersYet")}</p>
                  ) : historyData.founder_history?.map((fh, i) => (
                    <div key={i} className="mb-4 pb-4 border-b last:border-0 last:mb-0 last:pb-0" style={{ borderColor: "rgb(255 255 255 / 0.05)" }}>
                      <p className="font-medium">{fh.contact_name || fh.contact_id}</p>
                      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                        {t("venture.founders")} {fh.removed_at ? `(removed ${new Date(fh.removed_at).toLocaleDateString()})` : `(${t("venture.statuses.active")})`}
                      </p>
                      {fh.programs?.length > 0 && (
                        <div className="mt-2 space-y-1">
                          <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{t("venture.programs")}:</p>
                          {fh.programs.map((p, j) => (
                            <p key={j} className="text-xs pl-3" style={{ color: "var(--text-secondary)" }}>
                              • {p.program_name || `Program ${p.program_id}`} {p.joined_at && `(${new Date(p.joined_at).toLocaleDateString()})`}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Add Member Modal */}
        {showAddMember && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgb(0 0 0 / 0.6)" }} onClick={() => setShowAddMember(false)}>
            <div className="rounded-2xl p-6 w-full max-w-md mx-4 border shadow-xl" style={{ backgroundColor: "#0f172a", borderColor: "rgb(255 255 255 / 0.1)", color: "var(--text-primary)" }} onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">{addMemberType === "founder" ? t("venture.addFounder") : t("venture.addTeamMember")}</h2>
                <button onClick={() => setShowAddMember(false)} style={{ color: "var(--text-secondary)" }}><X size={20} /></button>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t("venture.searchContacts")}</label>
                <input value={searchQuery} onChange={e => { setSearchQuery(e.target.value); searchContacts(e.target.value); }}
                  className="w-full px-3 py-2 rounded-lg outline-none border mb-2" style={inputStyle} placeholder={t("venture.searchContacts")} />
              </div>
              {searching && <p className="text-sm py-2" style={{ color: "var(--text-secondary)" }}>Searching...</p>}
              <div className="max-h-48 overflow-y-auto space-y-1">
                {searchResults.map(c => (
                  <button key={c.cid} onClick={() => handleAddMember(c.cid)}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors hover:bg-white/10">
                    <span className="font-medium">{c.name || c.cid}</span>
                    {c.email && <span className="ml-2" style={{ color: "var(--text-secondary)" }}>({c.email})</span>}
                  </button>
                ))}
                {searchQuery.length >= 2 && searchResults.length === 0 && !searching && (
                  <p className="text-sm py-2" style={{ color: "var(--text-secondary)" }}>No contacts found</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Remove Confirm Modal */}
        {removeConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgb(0 0 0 / 0.6)" }} onClick={() => setRemoveConfirm(null)}>
            <div className="rounded-2xl p-6 w-full max-w-sm mx-4 border shadow-xl" style={{ backgroundColor: "#0f172a", borderColor: "rgb(255 255 255 / 0.1)", color: "var(--text-primary)" }} onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-bold mb-2">{t("venture.confirmRemove")}</h2>
              <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
                {removeConfirm.contact_name || removeConfirm.contact_id}
              </p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setRemoveConfirm(null)} className="px-4 py-2 rounded-lg text-sm" style={{ color: "var(--text-secondary)" }}>
                  {t("venture.cancel")}
                </button>
                <button onClick={() => handleRemoveMember(removeConfirm.id)}
                  className="px-4 py-2 rounded-lg text-sm text-white" style={{ backgroundColor: "#ef4444" }}>
                  {t("venture.remove")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

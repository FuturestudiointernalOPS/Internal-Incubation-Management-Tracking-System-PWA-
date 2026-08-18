"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  User,
  Mail,
  Phone,
  Save,
  BookOpen,
  FileText,
  Target,
  Rocket,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Calendar,
  ExternalLink,
  Building2,
  Globe,
  Lightbulb,
  Shield,
  Camera,
  Clock,
  BadgeCheck,
  Languages,
  LogOut,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import SearchableSelect from "@/components/ui/SearchableSelect";
import { getCountries, getLanguages, resolveCountryCode } from "@/lib/profile-options";

// ─── Info Row ───────────────────────────────────────────────────────
function InfoRow({ icon: Icon, label, value, editable, onChange }) {
  return (
    <div className="space-y-1">
      <p className="flex items-center gap-2 text-[8px] font-black text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
        <Icon className="w-3 h-3" /> {label}
      </p>
      {editable ? (
        <input
          defaultValue={value}
          onChange={(e) => onChange?.(e.target.value)}
          className="w-full bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-lg p-3 text-[11px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all"
        />
      ) : (
        <p className="text-[11px] font-bold text-[var(--text-primary)] bg-[var(--surface-2)] rounded-lg p-3 border border-[var(--border-primary)]">
          {value || "—"}
        </p>
      )}
    </div>
  );
}

// ─── Section Card ───────────────────────────────────────────────────
function SectionCard({ title, icon: Icon, children, className = "" }) {
  return (
    <div
      className={`bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-xl p-5 ${className}`}
    >
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-4 h-4 text-[var(--brand-orange)]" />
        <h3 className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider">
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}

// ─── History Group ──────────────────────────────────────────────────
function HistoryGroup({ title, rows, roleLabel, activeLabel, completedLabel }) {
  if (!rows || rows.length === 0) return null;
  return (
    <div>
      <p className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-wider mb-2">
        {title}
      </p>
      <div className="space-y-2">
        {rows.map((h) => (
          <div
            key={`${h.program_id}-${h.role}`}
            className="flex items-center justify-between p-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border-primary)]"
          >
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-[var(--text-primary)] truncate">
                {h.program_name}
              </p>
              <p className="text-[8px] text-[var(--text-tertiary)]">
                {roleLabel(h.role)}
              </p>
            </div>
            <span
              className={`text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 ${
                h.status === "active"
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-white/5 text-[var(--text-tertiary)]"
              }`}
            >
              {h.status === "active" ? activeLabel : completedLabel}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────
export default function ProfileView() {
  const { t, switchLang, lang } = useI18n();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [contact, setContact] = useState(null);
  const [programs, setPrograms] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [groupInfo, setGroupInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);
  const [editedName, setEditedName] = useState("");
  const [history, setHistory] = useState([]);
  const [editedAlternativeEmail, setEditedAlternativeEmail] = useState("");
  const [editedAlternativePhone, setEditedAlternativePhone] = useState("");
  const [editedPhone, setEditedPhone] = useState("");
  const [editedLanguage, setEditedLanguage] = useState("en");
  const [editedCountryCode, setEditedCountryCode] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoMessage, setPhotoMessage] = useState(null);

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("user") || "{}");
    setUser(stored);
    if (stored?.cid || stored?.email) {
      fetchAllData(stored);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchAllData = async (u) => {
    try {
      const cid = u.cid;
      const email = u.email;

      // Fetch own profile (session-based — no CRM-wide capability required),
      // plus participant programs/submissions in parallel.
      const [profileRes, progRes, subRes, histRes] = await Promise.all([
        fetch("/api/profile"),
        fetch("/api/participant/programs"),
        cid
          ? fetch(`/api/participant/submissions?participant_id=${cid}`)
          : fetch(`/api/participant/submissions?participant_id=${email}`),
        fetch("/api/profile/history"),
      ]);

      const profileData = await profileRes.json();
      const progData = await progRes.json();
      const subData = await subRes.json();
      const histData = await histRes.json();

      if (profileData.success && profileData.profile) {
        const p = profileData.profile;
        setContact({
          cid: p.cid || cid,
          name: p.name || "",
          email: p.email || email,
          phone: p.phone || "",
          address: p.address || "",
          language: p.language || "en",
          role: p.role || "",
          group_name: p.group_name || "",
          image: p.image || "",
          status: p.status || "",
          created_at: p.created_at || "",
          alternative_email: p.alternative_email || "",
          alternative_phone: p.alternative_phone || "",
          country: p.country || "",
          country_code: p.country_code || "",
          last_login_at: p.last_login_at || "",
          login_count: p.login_count || 0,
        });
        setEditedName(p.name || "");
        setEditedPhone(p.phone || "");
        setEditedLanguage(p.language || "en");
        setEditedAlternativeEmail(p.alternative_email || "");
        setEditedAlternativePhone(p.alternative_phone || "");
        setEditedCountryCode(p.country_code || resolveCountryCode(p.country) || "");
      }

      if (progData.success) {
        setPrograms(progData.programs || []);
      }

      if (subData.success) {
        setSubmissions(subData.submissions || []);
      }

      if (histData.success) {
        setHistory(histData.history || []);
      }

      // Fetch group info if participant has a group_name
      if (u.group_name) {
        try {
          const grpRes = await fetch(
            `/api/groups?name=${encodeURIComponent(u.group_name)}`,
          );
          const grpData = await grpRes.json();
          if (grpData.success && grpData.groups?.length > 0) {
            setGroupInfo(grpData.groups[0]);
          }
        } catch (e) {
          /* ignore */
        }
      }
    } catch (e) {
      console.error("Profile fetch error:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!contact?.cid) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editedName || contact.name,
          phone: editedPhone || contact.phone,
          language: editedLanguage || contact.language,
          alternative_email: editedAlternativeEmail,
          alternative_phone: editedAlternativePhone,
          country_code: editedCountryCode,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSaveMessage({
          type: "success",
          text: t("adminMisc.profile.saveSuccess"),
        });
        // Update localStorage
        const stored = JSON.parse(localStorage.getItem("user") || "{}");
        stored.name = editedName || contact.name;
        stored.phone = editedPhone || contact.phone;
        stored.language = editedLanguage || contact.language;
        localStorage.setItem("user", JSON.stringify(stored));
        // Persist language preference through the i18n engine too
        if (editedLanguage && editedLanguage !== contact.language) {
          switchLang(editedLanguage);
        }
        // Dispatch global notification
        window.dispatchEvent(
          new CustomEvent("impactos:notify", {
            detail: { type: "success", message: t("adminMisc.profile.saved") },
          }),
        );
      } else {
        setSaveMessage({
          type: "error",
          text:
            t((data.error || t("adminMisc.profile.saveFailed")) || "") ||
            (data.error || t("adminMisc.profile.saveFailed")),
        });
      }
    } catch (e) {
      setSaveMessage({ type: "error", text: t("adminMisc.profile.networkError") });
    }
    setSaving(false);
    setTimeout(() => setSaveMessage(null), 3000);
  };

  const handlePhotoUpload = async (file) => {
    if (!file) return;
    setUploadingPhoto(true);
    setPhotoMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch("/api/profile/photo", {
        method: "POST",
        body: formData,
      });
      const uploadData = await uploadRes.json();

      if (!uploadData.success || !uploadData.url) {
        throw new Error(uploadData.error || t("adminMisc.profile.photoUploadFailed"));
      }

      const saveRes = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: uploadData.url }),
      });
      const saveData = await saveRes.json();

      if (!saveData.success) {
        throw new Error(saveData.error || t("adminMisc.profile.saveFailed"));
      }

      setContact((prev) => ({ ...prev, image: uploadData.url }));
      setPhotoMessage({ type: "success", text: t("adminMisc.profile.photoUploadSuccess") });

      const stored = JSON.parse(localStorage.getItem("user") || "{}");
      stored.image = uploadData.url;
      localStorage.setItem("user", JSON.stringify(stored));
      window.dispatchEvent(
        new CustomEvent("impactos:notify", {
          detail: { type: "success", message: t("adminMisc.profile.photoUploadSuccess") },
        }),
      );
    } catch (e) {
      setPhotoMessage({ type: "error", text: e.message || t("adminMisc.profile.photoUploadFailed") });
    }
    setUploadingPhoto(false);
    setTimeout(() => setPhotoMessage(null), 3000);
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/session-logout", { method: "POST" });
    } catch (e) {
      console.error("Logout error:", e);
    }
    localStorage.clear();
    router.replace("/login");
  };

  const roleLabel = (role) => {
    switch (role) {
      case "program_manager":
        return t("adminMisc.profile.programManagerRole");
      case "facilitator":
        return t("adminMisc.profile.facilitatorRole");
      case "assistant":
        return t("adminMisc.profile.assistantRole");
      case "staff":
        return t("adminMisc.profile.staffRole");
      case "participant":
        return t("adminMisc.profile.participantRole");
      default:
        return (role || "").replace(/_/g, " ");
    }
  };

  const deriveCurrentRole = () => {
    const active = history.filter((h) => h.status === "active");
    const order = [
      "program_manager",
      "staff",
      "assistant",
      "facilitator",
      "participant",
    ];
    for (const role of order) {
      if (active.some((h) => h.role === role)) return role;
    }
    return contact?.role || "participant";
  };

  const statusLabel = (status) => {
    if (!status) return t("adminMisc.profile.statusUnknown");
    const key = String(status).toLowerCase().replace(/\s+/g, "");
    const mapped = {
      active: "status.active",
      pending: "status.pending",
      approved: "status.active",
      suspended: "status.blocked",
      archived: "status.archived",
      blocked: "status.blocked",
    };
    if (mapped[key]) return t(mapped[key]);
    return status;
  };

  const formatDate = (value) => {
    if (!value) return t("adminMisc.profile.notAvailable");
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return t("adminMisc.profile.notAvailable");
    return date.toLocaleDateString();
  };

  const formatDateTime = (value) => {
    if (!value) return t("adminMisc.profile.neverLoggedIn");
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return t("adminMisc.profile.neverLoggedIn");
    return date.toLocaleString();
  };

  const countryOptions = useMemo(() => getCountries(lang), [lang]);
  const languageOptions = useMemo(() => getLanguages(lang), [lang]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-white/10 rounded" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <div className="h-48 bg-[var(--bg-tertiary)] rounded-xl border border-[var(--border-primary)]" />
          </div>
          <div className="lg:col-span-2 space-y-4">
            <div className="h-32 bg-[var(--bg-tertiary)] rounded-xl border border-[var(--border-primary)]" />
            <div className="h-32 bg-[var(--bg-tertiary)] rounded-xl border border-[var(--border-primary)]" />
          </div>
        </div>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <AlertCircle className="w-12 h-12 text-rose-400" />
        <p className="text-[12px] font-bold text-[var(--text-secondary)]">
          {t("adminMisc.profile.loadError")}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest"
        >
          <RefreshCw className="w-3 h-3" /> {t("adminMisc.profile.retry")}
        </button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-black text-[var(--text-primary)] uppercase tracking-tight">
            {t("adminMisc.profile.title")}
          </h1>
          <p className="text-[11px] text-[var(--text-secondary)] mt-1">
            {t("adminMisc.profile.subtitle")}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-30"
        >
          <Save className="w-3.5 h-3.5" />{" "}
          {saving ? t("adminMisc.profile.saving") : t("adminMisc.profile.saveChanges")}
        </button>
      </div>

      {/* Save message */}
      {saveMessage && (
        <div
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-bold ${
            saveMessage.type === "success"
              ? "bg-emerald-500/10 text-emerald-400"
              : "bg-rose-500/10 text-rose-400"
          }`}
        >
          {saveMessage.type === "success" ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          {saveMessage.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ═══ LEFT COLUMN: Avatar + Quick Info ═══ */}
        <div className="lg:col-span-1 space-y-4">
          {/* Avatar card */}
          <div className="bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-xl p-6 text-center">
            <div className="relative w-24 h-24 mx-auto mb-4">
              <div className="w-24 h-24 rounded-2xl bg-[var(--brand-orange)]/10 border-2 border-[var(--brand-orange)]/20 flex items-center justify-center overflow-hidden">
                {contact.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={contact.image}
                    alt={contact.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-12 h-12 text-[var(--brand-orange)]" />
                )}
              </div>
              <label className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-[var(--brand-orange)] text-black flex items-center justify-center cursor-pointer hover:brightness-110 transition-all shadow-lg">
                <Camera className="w-4 h-4" />
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => handlePhotoUpload(e.target.files?.[0])}
                />
              </label>
            </div>
            <h2 className="text-base font-black text-[var(--text-primary)]">
              {contact.name}
            </h2>
            <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mt-1">
              {roleLabel(deriveCurrentRole())}
            </p>
            {uploadingPhoto && (
              <p className="text-[9px] font-bold text-[var(--brand-orange)] mt-2">
                {t("adminMisc.profile.uploadingPhoto")}
              </p>
            )}
            {photoMessage && (
              <p
                className={`text-[9px] font-bold mt-2 ${
                  photoMessage.type === "success"
                    ? "text-emerald-400"
                    : "text-rose-400"
                }`}
              >
                {photoMessage.text}
              </p>
            )}
            <div className="mt-4 pt-4 border-t border-[var(--border-primary)] space-y-2 text-left">
              <div className="flex items-center gap-2 text-[9px] text-[var(--text-tertiary)]">
                <Mail className="w-3 h-3 shrink-0" />
                <span className="truncate">{contact.email}</span>
              </div>
              <div className="flex items-center gap-2 text-[9px] text-[var(--text-tertiary)]">
                <Calendar className="w-3 h-3 shrink-0" />
                <span>CID: {contact.cid?.substring(0, 16)}...</span>
              </div>
            </div>
          </div>

          {/* Programs summary */}
          <SectionCard title={t("adminMisc.profile.enrolledPrograms")} icon={BookOpen}>
            {programs.length === 0 ? (
              <p className="text-[10px] text-[var(--text-tertiary)]">
                {t("adminMisc.profile.noPrograms")}
              </p>
            ) : (
              <div className="space-y-2">
                {programs.slice(0, 5).map((p) => (
                  <div key={p.id} className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-[var(--text-primary)] truncate">
                      {p.name}
                    </span>
                    <span
                      className={`text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                        p.status === "active"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-white/5 text-[var(--text-tertiary)]"
                      }`}
                    >
                      {p.status || "active"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        {/* ═══ RIGHT COLUMN: Details + Activity ═══ */}
        <div className="lg:col-span-2 space-y-6">
          {/* Personal Information */}
          <SectionCard title={t("adminMisc.profile.personalInformation")} icon={User}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoRow
                icon={User}
                label={t("adminMisc.profile.fullName")}
                value={contact.name}
                editable
                onChange={setEditedName}
              />
              <InfoRow icon={Mail} label={t("adminMisc.profile.email")} value={contact.email} />
              <InfoRow
                icon={Phone}
                label={t("adminMisc.profile.phone")}
                value={contact.phone}
                editable
                onChange={setEditedPhone}
              />
              <InfoRow
                icon={Shield}
                label={t("adminMisc.profile.role")}
                value={roleLabel(deriveCurrentRole())}
              />
              <InfoRow
                icon={Building2}
                label={t("adminMisc.profile.organization")}
                value={contact.group_name}
              />
              <InfoRow
                icon={BadgeCheck}
                label={t("adminMisc.profile.accountStatus")}
                value={statusLabel(contact.status)}
              />
              <SearchableSelect
                label={t("adminMisc.profile.country")}
                icon={Globe}
                value={editedCountryCode}
                onChange={setEditedCountryCode}
                options={countryOptions}
                placeholder={t("common.select")}
                searchPlaceholder={t("common.search")}
                emptyText={t("common.noResults")}
              />

              {/* Preferred Language */}
              <SearchableSelect
                label={t("adminMisc.profile.preferredLanguage")}
                icon={Languages}
                value={editedLanguage || "en"}
                onChange={setEditedLanguage}
                options={languageOptions}
                placeholder={t("common.select")}
                searchPlaceholder={t("common.search")}
                emptyText={t("common.noResults")}
              />

              <InfoRow
                icon={Calendar}
                label={t("adminMisc.profile.dateJoined")}
                value={formatDate(contact.created_at)}
              />
              <InfoRow
                icon={Clock}
                label={t("adminMisc.profile.lastLogin")}
                value={formatDateTime(contact.last_login_at)}
              />
              <InfoRow
                icon={Mail}
                label={t("adminMisc.profile.alternativeEmail")}
                value={contact.alternative_email}
                editable
                onChange={setEditedAlternativeEmail}
              />
              <InfoRow
                icon={Phone}
                label={t("adminMisc.profile.alternativePhone")}
                value={contact.alternative_phone}
                editable
                onChange={setEditedAlternativePhone}
              />
            </div>
          </SectionCard>

          {/* Program History */}
          <SectionCard title={t("adminMisc.profile.programHistory")} icon={BookOpen}>
            {history.length === 0 ? (
              <p className="text-[10px] text-[var(--text-tertiary)]">
                {t("adminMisc.profile.noHistory")}
              </p>
            ) : (
              <div className="space-y-5">
                <HistoryGroup
                  title={t("adminMisc.profile.currentPrograms")}
                  rows={history.filter((h) => h.status === "active")}
                  roleLabel={roleLabel}
                  activeLabel={t("adminMisc.profile.activeStatus")}
                  completedLabel={t("adminMisc.profile.completedStatus")}
                />
                <HistoryGroup
                  title={t("adminMisc.profile.pastPrograms")}
                  rows={history.filter((h) => h.status !== "active")}
                  roleLabel={roleLabel}
                  activeLabel={t("adminMisc.profile.activeStatus")}
                  completedLabel={t("adminMisc.profile.completedStatus")}
                />
              </div>
            )}
          </SectionCard>

          {/* Startup / Group Profile */}
          {groupInfo && (
            <SectionCard title={t("adminMisc.profile.startupProfile")} icon={Rocket}>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--brand-orange)]/10 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-[var(--brand-orange)]" />
                  </div>
                  <div>
                    <p className="text-[12px] font-black text-[var(--text-primary)]">
                      {groupInfo.name}
                    </p>
                    {groupInfo.project_description && (
                      <p className="text-[9px] text-[var(--text-secondary)]">
                        {groupInfo.project_description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {groupInfo.url && (
                    <a
                      href={groupInfo.url}
                      target="_blank"
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border-primary)] text-[8px] font-bold text-[var(--brand-orange)] hover:brightness-110 transition-all"
                    >
                      <Globe className="w-3 h-3" /> {t("adminMisc.profile.website")}
                    </a>
                  )}
                  {groupInfo.demo_link && (
                    <a
                      href={groupInfo.demo_link}
                      target="_blank"
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border-primary)] text-[8px] font-bold text-blue-400 hover:brightness-110 transition-all"
                    >
                      <ExternalLink className="w-3 h-3" /> {t("adminMisc.profile.demo")}
                    </a>
                  )}
                  {groupInfo.pitch_deck_url && (
                    <a
                      href={groupInfo.pitch_deck_url}
                      target="_blank"
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border-primary)] text-[8px] font-bold text-purple-400 hover:brightness-110 transition-all"
                    >
                      <ExternalLink className="w-3 h-3" /> {t("adminMisc.profile.pitchDeck")}
                    </a>
                  )}
                </div>
              </div>
            </SectionCard>
          )}

          {/* Goals */}
          <SectionCard title={t("adminMisc.profile.goalsObjectives")} icon={Target}>
            <div className="space-y-3">
              <p className="text-[10px] text-[var(--text-secondary)]">
                {programs.length > 0
                  ? t("adminMisc.profile.activelyEnrolled", { count: programs.length })
                  : t("adminMisc.profile.noActivePrograms")}
              </p>
              <div className="flex flex-wrap gap-2">
                {programs
                  .filter((p) => p.status === "active" || !p.status)
                  .map((p) => (
                    <div
                      key={p.id}
                      className="px-3 py-1.5 rounded-lg bg-[var(--brand-orange)]/10 border border-[var(--brand-orange)]/20"
                    >
                      <p className="text-[9px] font-bold text-[var(--brand-orange)]">
                        {p.name}
                      </p>
                      <p className="text-[7px] text-[var(--text-tertiary)]">
                        {t("adminMisc.profile.weekProgress", {
                          week: p.currentWeek,
                          duration: p.durationWeeks || "?",
                          percent: p.metrics?.percentComplete || 0,
                        })}
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          </SectionCard>

          {/* Account / Sign out */}
          <SectionCard title={t("adminMisc.profile.securitySettings")} icon={Shield}>
            <div className="flex justify-end">
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[9px] font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all"
              >
                <LogOut className="w-3.5 h-3.5" />
                {t("adminMisc.profile.logout")}
              </button>
            </div>
          </SectionCard>

          {/* Recent Submissions */}
          <SectionCard title={t("adminMisc.profile.submittedWork")} icon={FileText}>
            {submissions.length === 0 ? (
              <div className="text-center py-6">
                <FileText className="w-8 h-8 text-[var(--text-tertiary)] mx-auto mb-2" />
                <p className="text-[10px] font-bold text-[var(--text-secondary)]">
                  {t("adminMisc.profile.noSubmissions")}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {submissions.slice(0, 10).map((sub) => (
                  <div
                    key={sub.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border-primary)]"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-7 h-7 rounded-md flex items-center justify-center ${
                          sub.status === "approved"
                            ? "bg-emerald-500/10"
                            : sub.status === "pending"
                              ? "bg-amber-500/10"
                              : "bg-white/5"
                        }`}
                      >
                        <FileText
                          className={`w-3.5 h-3.5 ${
                            sub.status === "approved"
                              ? "text-emerald-400"
                              : sub.status === "pending"
                                ? "text-amber-400"
                                : "text-[var(--text-tertiary)]"
                          }`}
                        />
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-[var(--text-primary)]">
                          {t("adminMisc.profile.deliverableNumber", { id: sub.document_id || sub.deliverable_id })}
                        </p>
                        <p className="text-[7px] text-[var(--text-tertiary)]">
                          {sub.created_at
                            ? new Date(sub.created_at).toLocaleDateString()
                            : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                          sub.status === "approved"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : sub.status === "pending"
                              ? "bg-amber-500/10 text-amber-400"
                              : "bg-white/5 text-[var(--text-tertiary)]"
                        }`}
                      >
                        {sub.status || "draft"}
                      </span>
                      {sub.score > 0 && (
                        <span className="text-[8px] font-bold text-emerald-400">
                          {sub.score} pts
                        </span>
                      )}
                      {sub.file_url && (
                        <a
                          href={sub.file_url}
                          target="_blank"
                          className="text-[var(--brand-orange)] hover:underline text-[8px] font-bold"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </motion.div>
  );
}

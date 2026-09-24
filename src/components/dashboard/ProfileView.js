"use client";

import React, { useState, useMemo } from "react";
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
  Shield,
  Camera,
  Clock,
  BadgeCheck,
  Languages,
} from "lucide-react";
import { motion } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import SearchableSelect from "@/components/ui/SearchableSelect";
import AppImage from "@/components/ui/AppImage";
import { getCountries, getLanguages, resolveCountryCode } from "@/lib/profile-options";
import { useApi } from "@/lib/hooks/useApi";
import { useSessionUser } from "@/lib/hooks/useSessionUser";

// ─── Read shapers (module scope: built once, never per render) ──────
const pickAltEmails = (payload) =>
  payload?.success ? (payload.emails || []).filter((email) => email.label !== "primary") : [];
const pickProfile = (payload) => (payload?.success && payload.profile ? payload.profile : null);
const pickPrograms = (payload) => (payload?.success ? payload.programs || [] : []);
const pickSubmissions = (payload) => (payload?.success ? payload.submissions || [] : []);
const pickHistory = (payload) => (payload?.success ? payload.history || [] : []);
const pickTimeline = (payload) => (payload?.success ? payload.events || [] : []);
const pickGroup = (payload) =>
  payload?.success && payload.groups?.length > 0 ? payload.groups[0] : null;

// ─── Info Row ───────────────────────────────────────────────────────
function InfoRow({ icon: Icon, label, value, editable, onChange }) {
  return (
    <div className="space-y-1">
      <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1">
        <Icon className="w-3 h-3" /> {label}
      </p>
      {editable ? (
        <input
          defaultValue={value}
          onChange={(event) => onChange?.(event.target.value)}
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
        <h3 className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-primary)]">
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
      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2">
        {title}
      </p>
      <div className="space-y-2">
        {rows.map((row) => (
          <div
            key={`${row.program_id}-${row.role}`}
            className="flex items-center justify-between p-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border-primary)]"
          >
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-[var(--text-primary)] truncate">
                {row.program_name}
              </p>
              <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                {roleLabel(row.role)}
              </p>
            </div>
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 ${
                row.status === "active"
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-white/5 text-[var(--text-tertiary)]"
              }`}
            >
              {row.status === "active" ? activeLabel : completedLabel}
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

  // Who is signed in, from the shell's session cache: it costs no request of this
  // screen's own and no read of the browser's stored copy.
  const { user, cid } = useSessionUser();
  const sessionEmail = user?.email || null;
  const groupName = user?.group_name || null;
  // The identity is absent for the first moment of a cold load, so the reads wait
  // for it and the screen keeps its placeholder rather than claim there is
  // nothing to show.
  const identityReady = Boolean(cid || sessionEmail);

  // ─── Reads ───
  // The shared hook owns the cache, the cache-first paint, the discarding of a
  // stale answer and the loading flag, so this screen keeps no copy of its own.
  const {
    data: altEmails,
    setData: setAltEmails,
    refresh: refreshAltEmails,
  } = useApi("/api/contact-emails", {
    defaultValue: [],
    transform: pickAltEmails,
  });

  const {
    data: profile,
    setData: setProfile,
    loading: profileLoading,
  } = useApi(identityReady ? "/api/profile" : null, {
    defaultValue: null,
    transform: pickProfile,
  });

  const { data: programs, loading: programsLoading } = useApi(
    identityReady ? "/api/participant/programs" : null,
    { defaultValue: [], transform: pickPrograms },
  );

  const { data: submissions, loading: submissionsLoading } = useApi(
    cid
      ? `/api/participant/submissions?participant_id=${cid}`
      : sessionEmail
        ? `/api/participant/submissions?participant_id=${sessionEmail}`
        : null,
    { defaultValue: [], transform: pickSubmissions },
  );

  const { data: history, loading: historyLoading } = useApi(
    identityReady ? "/api/profile/history" : null,
    { defaultValue: [], transform: pickHistory },
  );

  const { data: timeline, loading: timelineLoading } = useApi(
    identityReady ? "/api/participant/timeline?limit=20" : null,
    { defaultValue: [], transform: pickTimeline },
  );

  const { data: groupInfo, loading: groupLoading } = useApi(
    groupName ? `/api/groups?name=${encodeURIComponent(groupName)}` : null,
    { defaultValue: null, transform: pickGroup },
  );

  // The stored record is the base the form is drawn from; the person's changes are
  // recorded against the field they touch and laid back over it, so nothing has to
  // be copied in when the read answers.
  const contact = profile
    ? {
        cid: profile.cid || cid,
        name: profile.name || "",
        email: profile.email || sessionEmail,
        phone: profile.phone || "",
        address: profile.address || "",
        language: profile.language || "en",
        role: profile.role || "",
        group_name: profile.group_name || "",
        image: profile.image || "",
        status: profile.status || "",
        created_at: profile.created_at || "",
        alternative_email: profile.alternative_email || "",
        alternative_phone: profile.alternative_phone || "",
        country: profile.country || "",
        country_code: profile.country_code || "",
        last_login_at: profile.last_login_at || "",
        login_count: profile.login_count || 0,
      }
    : null;

  // The country the form starts from, resolved from the stored record the way the
  // loader used to.
  const storedCountryCode =
    contact?.country_code || resolveCountryCode(contact?.country) || "";

  const loading =
    !identityReady ||
    profileLoading ||
    programsLoading ||
    submissionsLoading ||
    historyLoading ||
    timelineLoading ||
    groupLoading;

  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);
  const [editedName, setEditedName] = useState(null);
  const [editedPhone, setEditedPhone] = useState(null);
  const [editedLanguage, setEditedLanguage] = useState(null);
  const [editedAlternativePhone, setEditedAlternativePhone] = useState(null);

  // Multiple alternative emails (identity matching) — edits over the read above
  const [newAltEmail, setNewAltEmail] = useState("");
  const [altBusy, setAltBusy] = useState(false);
  const [altNotice, setAltNotice] = useState("");

  async function addAltEmail() {
    const email = newAltEmail.trim();
    if (!email || !email.includes("@")) {
      setAltNotice(t("adminMisc.profile.altEmailsInvalid"));
      return;
    }
    setAltBusy(true);
    setAltNotice("");
    try {
      const response = await fetch("/api/contact-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (data.success) {
        setNewAltEmail("");
        await refreshAltEmails();
        setAltNotice(t("adminMisc.profile.altEmailsAdded"));
      } else {
        setAltNotice(data.error || t("adminMisc.profile.altEmailsError"));
      }
    } catch (_) {
      setAltNotice(t("adminMisc.profile.altEmailsError"));
    } finally {
      setAltBusy(false);
    }
  }

  async function removeAltEmail(id) {
    setAltBusy(true);
    setAltNotice("");
    try {
      const response = await fetch(`/api/contact-emails?id=${id}`, { method: "DELETE" });
      const data = await response.json();
      if (data.success) {
        setAltEmails((prev) => prev.filter((email) => email.id !== id));
        setAltNotice(t("adminMisc.profile.altEmailsRemoved"));
      } else {
        setAltNotice(data.error || t("adminMisc.profile.altEmailsError"));
      }
    } catch (_) {
      setAltNotice(t("adminMisc.profile.altEmailsError"));
    } finally {
      setAltBusy(false);
    }
  }

  const [editedCountryCode, setEditedCountryCode] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoMessage, setPhotoMessage] = useState(null);

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
          alternative_email: contact.alternative_email,
          alternative_phone: editedAlternativePhone ?? contact.alternative_phone,
          country_code: editedCountryCode ?? storedCountryCode,
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
    } catch {
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

      setProfile((prev) => (prev ? { ...prev, image: uploadData.url } : prev));
      setPhotoMessage({ type: "success", text: t("adminMisc.profile.photoUploadSuccess") });

      const stored = JSON.parse(localStorage.getItem("user") || "{}");
      stored.image = uploadData.url;
      localStorage.setItem("user", JSON.stringify(stored));
      window.dispatchEvent(
        new CustomEvent("impactos:notify", {
          detail: { type: "success", message: t("adminMisc.profile.photoUploadSuccess") },
        }),
      );
    } catch (error) {
      setPhotoMessage({ type: "error", text: error.message || t("adminMisc.profile.photoUploadFailed") });
    }
    setUploadingPhoto(false);
    setTimeout(() => setPhotoMessage(null), 3000);
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
    const active = history.filter((entry) => entry.status === "active");
    const order = [
      "program_manager",
      "staff",
      "assistant",
      "facilitator",
      "participant",
    ];
    for (const role of order) {
      if (active.some((entry) => entry.role === role)) return role;
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
        <p className="text-sm text-[var(--text-secondary)]">
          {t("adminMisc.profile.loadError")}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--brand-orange)] text-black rounded-xl text-[10px] font-bold uppercase tracking-wide"
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
      <div>
        <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-[var(--text-primary)]">
          {t("adminMisc.profile.title")}
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          {t("adminMisc.profile.subtitle")}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ═══ LEFT COLUMN: Avatar + Quick Info ═══ */}
        <div className="lg:col-span-1 space-y-4">
          {/* Avatar card */}
          <div className="bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-xl p-6 text-center">
            <div className="relative w-24 h-24 mx-auto mb-4">
              <div className="w-24 h-24 rounded-2xl bg-brand-orange/10 border-2 border-brand-orange/20 flex items-center justify-center overflow-hidden">
                {contact.image ? (
                  <AppImage
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
                  onChange={(event) => handlePhotoUpload(event.target.files?.[0])}
                />
              </label>
            </div>
            <h2 className="text-base font-black text-[var(--text-primary)]">
              {contact.name}
            </h2>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mt-1">
              {roleLabel(deriveCurrentRole())}
            </p>
            {uploadingPhoto && (
              <p className="text-[10px] font-bold text-[var(--brand-orange)] mt-2">
                {t("adminMisc.profile.uploadingPhoto")}
              </p>
            )}
            {photoMessage && (
              <p
                className={`text-[10px] font-bold mt-2 ${
                  photoMessage.type === "success"
                    ? "text-emerald-400"
                    : "text-rose-400"
                }`}
              >
                {photoMessage.text}
              </p>
            )}
            <div className="mt-4 pt-4 border-t border-[var(--border-primary)] space-y-2 text-left">
              <div className="flex items-center gap-2 text-[10px] font-medium text-[var(--text-secondary)]">
                <Mail className="w-3 h-3 shrink-0" />
                <span className="truncate">{contact.email}</span>
              </div>
            </div>
          </div>

          {/* Programs summary */}
          <SectionCard title={t("adminMisc.profile.enrolledPrograms")} icon={BookOpen}>
            {programs.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">
                {t("adminMisc.profile.noPrograms")}
              </p>
            ) : (
              <div className="space-y-2">
                {programs.slice(0, 5).map((program) => (
                  <div key={program.id} className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[var(--text-primary)] truncate">
                      {program.name}
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                        program.status === "active"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-white/5 text-[var(--text-tertiary)]"
                      }`}
                    >
                      {program.status || "active"}
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
                value={editedCountryCode ?? storedCountryCode}
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
                value={editedLanguage ?? contact.language}
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
                icon={Phone}
                label={t("adminMisc.profile.alternativePhone")}
                value={contact.alternative_phone}
                editable
                onChange={setEditedAlternativePhone}
              />

              {/* Alternative emails — identity matching (multiple) */}
              <div className="space-y-2 pt-1">
                <p className="flex items-center gap-2 text-[8px] font-black text-[var(--text-tertiary)] uppercase tracking-wider">
                  <Mail className="w-3 h-3" /> {t("adminMisc.profile.alternativeEmailsTitle")}
                </p>
                {altEmails.length === 0 ? (
                  <p className="text-[10px] font-bold text-[var(--text-tertiary)]">
                    {t("adminMisc.profile.alternativeEmailsEmpty")}
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {altEmails.map((email) => (
                      <div
                        key={email.id}
                        className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border-primary)]"
                      >
                        <span className="text-[10px] font-bold text-[var(--text-primary)] break-all">
                          {email.email}
                        </span>
                        <button
                          type="button"
                          disabled={altBusy}
                          onClick={() => removeAltEmail(email.id)}
                          className="text-[9px] font-black uppercase tracking-wider text-red-400 hover:text-red-300 disabled:opacity-40 shrink-0"
                        >
                          {t("adminMisc.profile.altEmailRemove")}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <input
                    value={newAltEmail}
                    disabled={altBusy}
                    onChange={(event) => setNewAltEmail(event.target.value)}
                    placeholder={t("adminMisc.profile.altEmailPlaceholder")}
                    onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addAltEmail(); } }}
                    className="flex-1 min-w-0 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all"
                  />
                  <button
                    type="button"
                    disabled={altBusy}
                    onClick={addAltEmail}
                    className="px-3 py-2 rounded-lg bg-[var(--brand-orange)] text-white text-[9px] font-black uppercase tracking-wider disabled:opacity-40"
                  >
                    {t("adminMisc.profile.altEmailAdd")}
                  </button>
                </div>
                {altNotice && (
                  <p className="text-[9px] font-bold text-[var(--text-secondary)]">
                    {altNotice}
                  </p>
                )}
              </div>
            </div>
          </SectionCard>

          {/* Program History */}
          <SectionCard title={t("adminMisc.profile.programHistory")} icon={BookOpen}>
            {history.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">
                {t("adminMisc.profile.noHistory")}
              </p>
            ) : (
              <div className="space-y-5">
                <HistoryGroup
                  title={t("adminMisc.profile.currentPrograms")}
                  rows={history.filter((entry) => entry.status === "active")}
                  roleLabel={roleLabel}
                  activeLabel={t("adminMisc.profile.activeStatus")}
                  completedLabel={t("adminMisc.profile.completedStatus")}
                />
                <HistoryGroup
                  title={t("adminMisc.profile.pastPrograms")}
                  rows={history.filter((entry) => entry.status !== "active")}
                  roleLabel={roleLabel}
                  activeLabel={t("adminMisc.profile.activeStatus")}
                  completedLabel={t("adminMisc.profile.completedStatus")}
                />
              </div>
            )}
          </SectionCard>

          {/* Activity Timeline — the user's own contact activity log */}
          <div id="timeline">
            <SectionCard title={t("participant.activityTimeline")} icon={Clock}>
              {timeline.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">
                  {t("participant.timelineEmpty")}
                </p>
              ) : (
                <div className="space-y-2">
                  {timeline.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-start gap-3 p-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border-primary)]"
                    >
                      <Clock className="w-3.5 h-3.5 text-[var(--brand-orange)] shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-[var(--text-primary)]">
                          {event.description}
                        </p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mt-1">
                          {(event.event_type || "").replace(/_/g, " ")} ·{" "}
                          {event.created_at ? new Date(event.created_at).toLocaleDateString() : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>

          {/* Startup / Group Profile */}
          {groupInfo && (
            <SectionCard title={t("adminMisc.profile.startupProfile")} icon={Rocket}>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-orange/10 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-[var(--brand-orange)]" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-[var(--text-primary)]">
                      {groupInfo.name}
                    </p>
                    {groupInfo.project_description && (
                      <p className="text-sm text-[var(--text-secondary)]">
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
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-wide text-[var(--brand-orange)] hover:brightness-110 transition-all" rel="noreferrer"
                    >
                      <Globe className="w-3 h-3" /> {t("adminMisc.profile.website")}
                    </a>
                  )}
                  {groupInfo.demo_link && (
                    <a
                      href={groupInfo.demo_link}
                      target="_blank"
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-wide text-blue-400 hover:brightness-110 transition-all" rel="noreferrer"
                    >
                      <ExternalLink className="w-3 h-3" /> {t("adminMisc.profile.demo")}
                    </a>
                  )}
                  {groupInfo.pitch_deck_url && (
                    <a
                      href={groupInfo.pitch_deck_url}
                      target="_blank"
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-wide text-purple-400 hover:brightness-110 transition-all" rel="noreferrer"
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
                  .filter((program) => program.status === "active" || !program.status)
                  .map((program) => (
                    <div
                      key={program.id}
                      className="px-3 py-1.5 rounded-lg bg-brand-orange/10 border border-brand-orange/20"
                    >
                      <p className="text-[10px] font-bold text-[var(--brand-orange)]">
                        {program.name}
                      </p>
                      <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                        {t("adminMisc.profile.weekProgress", {
                          week: program.currentWeek,
                          duration: program.durationWeeks || "?",
                          percent: program.metrics?.percentComplete || 0,
                        })}
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          </SectionCard>



          {/* Recent Submissions */}
          <SectionCard title={t("adminMisc.profile.submittedWork")} icon={FileText}>
            {submissions.length === 0 ? (
              <div className="text-center py-6">
                <FileText className="w-8 h-8 text-[var(--text-tertiary)] mx-auto mb-2" />
                <p className="text-sm text-[var(--text-secondary)]">
                  {t("adminMisc.profile.noSubmissions")}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {submissions.slice(0, 10).map((submission) => (
                  <div
                    key={submission.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border-primary)]"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-7 h-7 rounded-md flex items-center justify-center ${
                          submission.status === "approved"
                            ? "bg-emerald-500/10"
                            : submission.status === "pending"
                              ? "bg-amber-500/10"
                              : "bg-white/5"
                        }`}
                      >
                        <FileText
                          className={`w-3.5 h-3.5 ${
                            submission.status === "approved"
                              ? "text-emerald-400"
                              : submission.status === "pending"
                                ? "text-amber-400"
                                : "text-[var(--text-tertiary)]"
                          }`}
                        />
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-[var(--text-primary)]">
                          {t("adminMisc.profile.deliverableNumber", { id: submission.document_id || submission.deliverable_id })}
                        </p>
                        <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                          {submission.created_at
                            ? new Date(submission.created_at).toLocaleDateString()
                            : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                          submission.status === "approved"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : submission.status === "pending"
                              ? "bg-amber-500/10 text-amber-400"
                              : "bg-white/5 text-[var(--text-tertiary)]"
                        }`}
                      >
                        {submission.status || "draft"}
                      </span>
                      {submission.score > 0 && (
                        <span className="text-[10px] font-bold text-emerald-400">
                          {submission.score} pts
                        </span>
                      )}
                      {submission.file_url && (
                        <a
                          href={submission.file_url}
                          target="_blank"
                          className="text-[var(--brand-orange)] hover:underline" rel="noreferrer"
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

      {/* Save actions — at the bottom of the profile form */}
      <div className="space-y-3">
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
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-[var(--brand-orange)] text-black rounded-xl text-[10px] font-bold uppercase tracking-wide hover:brightness-110 transition-all disabled:opacity-30"
          >
            <Save className="w-3.5 h-3.5" />{" "}
            {saving ? t("adminMisc.profile.saving") : t("adminMisc.profile.saveChanges")}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

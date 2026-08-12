"use client";

import React, { useState, useEffect, useCallback } from "react";
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
  Eye,
  EyeOff,
} from "lucide-react";
import { motion } from "framer-motion";
import { useI18n } from "@/lib/i18n";

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

// ─── Main Component ─────────────────────────────────────────────────
export default function ProfileView() {
  const { t } = useI18n();
  const [user, setUser] = useState(null);
  const [contact, setContact] = useState(null);
  const [programs, setPrograms] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [groupInfo, setGroupInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);
  const [editedName, setEditedName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState(null);

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

      // Fetch contact, programs, submissions, and group info in parallel
      const [contactRes, progRes, subRes] = await Promise.all([
        fetch("/api/contacts"),
        fetch("/api/participant/programs"),
        cid
          ? fetch(`/api/participant/submissions?participant_id=${cid}`)
          : fetch(`/api/participant/submissions?participant_id=${email}`),
      ]);

      const contactData = await contactRes.json();
      const progData = await progRes.json();
      const subData = await subRes.json();

      if (contactData.success) {
        const found = contactData.contacts?.find(
          (c) => c.cid === cid || c.email === email,
        );
        if (found) {
          setContact(found);
          setEditedName(found.name || "");
        }
      }

      if (progData.success) {
        setPrograms(progData.programs || []);
      }

      if (subData.success) {
        setSubmissions(subData.submissions || []);
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
      const res = await fetch("/api/contacts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cid: contact.cid,
          name: editedName || contact.name,
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
        localStorage.setItem("user", JSON.stringify(stored));
        // Dispatch global notification
        window.dispatchEvent(
          new CustomEvent("impactos:notify", {
            detail: { type: "success", message: t("adminMisc.profile.saved") },
          }),
        );
      } else {
        setSaveMessage({ type: "error", text: data.error || t("adminMisc.profile.saveFailed") });
      }
    } catch (e) {
      setSaveMessage({ type: "error", text: t("adminMisc.profile.networkError") });
    }
    setSaving(false);
    setTimeout(() => setSaveMessage(null), 3000);
  };

  const handlePasswordSave = async () => {
    const field = document.getElementById("profile_password_field");
    const newPass = field?.value;
    if (!newPass || newPass.length < 4) {
      setPasswordMessage({
        type: "error",
        text: t("adminMisc.profile.passwordTooShort"),
      });
      setTimeout(() => setPasswordMessage(null), 3000);
      return;
    }
    setPasswordSaving(true);
    setPasswordMessage(null);
    try {
      const res = await fetch("/api/contacts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cid: contact.cid,
          password: newPass,
          name: contact.name,
        }),
      });
      const data = await res.json();
      if (data.success) {
        field.value = "";
        setPasswordMessage({
          type: "success",
          text: t("adminMisc.profile.passwordUpdateSuccess"),
        });
        window.dispatchEvent(
          new CustomEvent("impactos:notify", {
            detail: {
              type: "success",
              message: t("adminMisc.profile.passwordUpdateSuccess"),
            },
          }),
        );
      } else {
        setPasswordMessage({
          type: "error",
          text: data.error || t("adminMisc.profile.passwordUpdateFailed"),
        });
      }
    } catch (e) {
      setPasswordMessage({ type: "error", text: t("adminMisc.profile.passwordNetworkError") });
    }
    setPasswordSaving(false);
    setTimeout(() => setPasswordMessage(null), 3000);
  };

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

      {/* Password message */}
      {passwordMessage && (
        <div
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-bold ${
            passwordMessage.type === "success"
              ? "bg-emerald-500/10 text-emerald-400"
              : "bg-rose-500/10 text-rose-400"
          }`}
        >
          {passwordMessage.type === "success" ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          {passwordMessage.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ═══ LEFT COLUMN: Avatar + Quick Info ═══ */}
        <div className="lg:col-span-1 space-y-4">
          {/* Avatar card */}
          <div className="bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-xl p-6 text-center">
            <div className="w-20 h-20 rounded-2xl bg-[var(--brand-orange)]/10 border-2 border-[var(--brand-orange)]/20 flex items-center justify-center mx-auto mb-4">
              <User className="w-10 h-10 text-[var(--brand-orange)]" />
            </div>
            <h2 className="text-base font-black text-[var(--text-primary)]">
              {contact.name}
            </h2>
            <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mt-1">
              {contact.role?.replace(/_/g, " ") || t("adminMisc.profile.participantRole")}
            </p>
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
              <InfoRow icon={Phone} label={t("adminMisc.profile.phone")} value={contact.phone} />
              <InfoRow
                icon={User}
                label={t("adminMisc.profile.groupCohort")}
                value={contact.group_name}
              />
            </div>
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

          {/* Security / Password Change */}
          <SectionCard title={t("adminMisc.profile.securitySettings")} icon={Shield}>
            <p className="text-[9px] text-[var(--text-secondary)] mb-4">
              {t("adminMisc.profile.securityHint")}
            </p>
            <div className="flex flex-col sm:flex-row items-end gap-4">
              <div className="flex-1 space-y-2 w-full relative">
                <label className="text-[8px] font-black text-[var(--text-tertiary)] uppercase tracking-widest pl-1">
                  {t("adminMisc.profile.newPassword")}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    id="profile_password_field"
                    placeholder={t("adminMisc.profile.passwordPlaceholder")}
                    className="w-full bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-lg p-3 pr-12 text-[11px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all"
                  />
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[var(--text-tertiary)] hover:text-[var(--brand-orange)] transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
              <button
                onClick={handlePasswordSave}
                disabled={passwordSaving}
                className="flex items-center gap-2 px-5 py-3 bg-[var(--brand-orange)] text-black rounded-lg text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-30 shrink-0"
              >
                <Save className="w-3.5 h-3.5" />
                {passwordSaving ? t("adminMisc.profile.updating") : t("adminMisc.profile.updatePassword")}
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

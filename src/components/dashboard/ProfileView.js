"use client";

import { useState, useMemo } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { getCountries, getLanguages, resolveCountryCode } from "@/lib/profile-options";
import { useApi } from "@/lib/hooks/useApi";
import { useSessionUser } from "@/lib/hooks/useSessionUser";
import ProfileViewContent from "./profile-view/ProfileViewContent";

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

// ─── Main Profile View ─────────────────────────────────

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

  const ctx = {
    addAltEmail,
    altBusy,
    altEmails,
    altNotice,
    contact,
    countryOptions,
    deriveCurrentRole,
    editedCountryCode,
    editedLanguage,
    formatDate,
    formatDateTime,
    groupInfo,
    handlePhotoUpload,
    handleSave,
    history,
    languageOptions,
    newAltEmail,
    photoMessage,
    programs,
    removeAltEmail,
    roleLabel,
    saveMessage,
    saving,
    setEditedAlternativePhone,
    setEditedCountryCode,
    setEditedLanguage,
    setEditedName,
    setEditedPhone,
    setNewAltEmail,
    statusLabel,
    storedCountryCode,
    submissions,
    t,
    timeline,
    uploadingPhoto,
  };

  return <ProfileViewContent ctx={ctx} />;
}

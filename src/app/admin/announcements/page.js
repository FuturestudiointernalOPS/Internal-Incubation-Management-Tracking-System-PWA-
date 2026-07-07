"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import {
  Megaphone,
  Plus,
  X,
  Pin,
  PinOff,
  Archive,
  Trash2,
  Loader2,
  ChevronDown,
  Send,
  Users,
  Globe,
  Folder,
  Briefcase,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";

const TARGET_TYPES = [
  { value: "all", label: "announcements.targetAll", icon: Globe },
  { value: "group", label: "announcements.targetGroup", icon: Users },
  { value: "project", label: "announcements.targetProject", icon: Folder },
  { value: "program", label: "announcements.targetProgram", icon: Briefcase },
];

export default function AnnouncementsPage() {
  const { t } = useI18n();
  const [user, setUser] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [targetType, setTargetType] = useState("all");
  const [targetId, setTargetId] = useState("");
  const [isPinned, setIsPinned] = useState(false);

  const fetchAnnouncements = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/announcements${showArchived ? "?all=true" : ""}`,
      );
      const data = await res.json();
      if (data.success) {
        setAnnouncements(data.announcements || []);
      }
    } catch (_) {
    } finally {
      setLoading(false);
    }
  }, [showArchived]);

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem("user") || "{}");
    setUser(u);
  }, []);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      setError("Title and body are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const savedUser = JSON.parse(localStorage.getItem("user") || "{}");
      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          author_id: savedUser.cid || savedUser.id,
          author_name: savedUser.name || savedUser.cid || "Unknown",
          target_type: targetType,
          target_id: targetType !== "all" ? targetId.trim() || null : null,
          is_pinned: isPinned,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTitle("");
        setBody("");
        setTargetType("all");
        setTargetId("");
        setIsPinned(false);
        setShowForm(false);
        fetchAnnouncements();
      } else {
        setError(data.error || "Failed to create announcement.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePin = async (ann) => {
    try {
      const res = await fetch("/api/announcements", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: ann.id, is_pinned: !ann.is_pinned }),
      });
      const data = await res.json();
      if (data.success) fetchAnnouncements();
    } catch (_) {}
  };

  const handleArchive = async (ann) => {
    if (!window.confirm(t("announcements.archiveConfirm"))) return;
    try {
      const res = await fetch(`/api/announcements?id=${ann.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) fetchAnnouncements();
    } catch (_) {}
  };

  const canCreate =
    user?.role === "super_admin" ||
    user?.role === "program_manager" ||
    user?.role === "admin" ||
    user?.role === "staff";

  return (
    <DashboardLayout role={user?.role || "super_admin"}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-[var(--text-primary)] tracking-tight">
              {t("announcements.title")}
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              {t("announcements.targetLabel")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowArchived(!showArchived)}
              className={`px-3 py-1.5 text-[10px] font-bold rounded-lg border transition-all uppercase ${
                showArchived
                  ? "bg-[var(--brand-orange)]/10 border-[var(--brand-orange)]/30 text-[var(--brand-orange)]"
                  : "border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {showArchived
                ? t("announcements.showActive")
                : t("announcements.showAll")}
            </button>
            {canCreate && (
              <button
                onClick={() => setShowForm(!showForm)}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--brand-orange)] text-white rounded-lg text-[10px] font-black uppercase tracking-wider hover:brightness-110 transition-all"
              >
                {showForm ? (
                  <X className="w-3.5 h-3.5" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                {showForm
                  ? t("common.cancel")
                  : t("announcements.createAnnouncement")}
              </button>
            )}
          </div>
        </div>

        {/* Create Form */}
        {showForm && (
          <form
            onSubmit={handleCreate}
            className="mb-8 p-6 rounded-xl bg-secondary border border-[var(--border-primary)] space-y-4"
          >
            <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider">
              {t("announcements.newAnnouncement")}
            </h3>

            {error && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                {error}
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase mb-1">
                {t("announcements.titleLabel")}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--brand-orange)]"
                placeholder={t("announcements.titleLabel")}
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase mb-1">
                {t("announcements.bodyLabel")}
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 rounded-lg bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--brand-orange)] resize-none"
                placeholder={t("announcements.bodyLabel")}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase mb-1">
                  {t("announcements.targetLabel")}
                </label>
                <div className="relative">
                  <select
                    value={targetType}
                    onChange={(e) => {
                      setTargetType(e.target.value);
                      setTargetId("");
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--brand-orange)] appearance-none"
                  >
                    {TARGET_TYPES.map((tt) => (
                      <option key={tt.value} value={tt.value}>
                        {t(tt.label)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)] pointer-events-none" />
                </div>
              </div>

              {targetType !== "all" && (
                <div>
                  <label className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase mb-1">
                    {t("common.target")}
                  </label>
                  <input
                    type="text"
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--brand-orange)]"
                    placeholder={
                      targetType === "group"
                        ? t("announcements.groupPlaceholder")
                        : targetType === "project"
                          ? t("announcements.projectPlaceholder")
                          : t("announcements.programPlaceholder")
                    }
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                  className="w-4 h-4 rounded accent-[var(--brand-orange)]"
                />
                <span className="text-xs text-[var(--text-secondary)]">
                  {t("announcements.pin")}
                </span>
              </label>

              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 bg-[var(--brand-orange)] text-white rounded-lg text-[10px] font-black uppercase tracking-wider hover:brightness-110 transition-all disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                {saving ? t("common.saving") : t("common.send")}
              </button>
            </div>
          </form>
        )}

        {/* Announcements List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-[var(--brand-orange)] animate-spin" />
          </div>
        ) : announcements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-[var(--text-secondary)]">
            <Megaphone className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-sm font-medium">
              {t("announcements.noAnnouncements")}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {announcements.map((ann) => (
              <div
                key={ann.id}
                className={`p-5 rounded-xl border transition-all ${
                  ann.is_pinned
                    ? "bg-[var(--brand-orange)]/5 border-[var(--brand-orange)]/30"
                    : ann.is_archived
                      ? "bg-secondary border-[var(--border-primary)] opacity-60"
                      : "bg-secondary border-[var(--border-primary)]"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      {ann.is_pinned && (
                        <Pin className="w-3.5 h-3.5 text-[var(--brand-orange)]" />
                      )}
                      {ann.is_archived && (
                        <span className="px-2 py-0.5 text-[9px] font-black uppercase rounded bg-slate-500/10 text-slate-400 border border-slate-500/20">
                          {t("announcements.archived")}
                        </span>
                      )}
                      <h3 className="text-sm font-black text-[var(--text-primary)] truncate">
                        {ann.title}
                      </h3>
                      {!ann.is_archived && (
                        <span className="flex-shrink-0 px-2 py-0.5 text-[9px] font-bold rounded bg-[var(--brand-orange)]/10 text-[var(--brand-orange)] border border-[var(--brand-orange)]/20">
                          {ann.target_type === "all"
                            ? t("announcements.targetAll")
                            : `${ann.target_type}: ${ann.target_id || "—"}`}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">
                      {ann.body}
                    </p>
                    <div className="flex items-center gap-2 mt-3 text-[10px] text-[var(--text-secondary)]">
                      <span>{t("announcements.postedBy")}</span>
                      <span className="font-bold text-[var(--text-primary)]">
                        {ann.author_name || ann.author_id}
                      </span>
                      <span>{t("announcements.on")}</span>
                      <span>
                        {new Date(ann.created_at).toLocaleDateString("en", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {!ann.is_archived && canCreate && (
                      <>
                        <button
                          onClick={() => handleTogglePin(ann)}
                          className="p-1.5 rounded-lg hover:bg-primary transition-colors text-[var(--text-secondary)] hover:text-[var(--brand-orange)]"
                          title={
                            ann.is_pinned
                              ? t("announcements.unpin")
                              : t("announcements.pin")
                          }
                        >
                          {ann.is_pinned ? (
                            <PinOff className="w-4 h-4" />
                          ) : (
                            <Pin className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleArchive(ann)}
                          className="p-1.5 rounded-lg hover:bg-primary transition-colors text-[var(--text-secondary)] hover:text-rose-400"
                          title={t("announcements.archive")}
                        >
                          <Archive className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

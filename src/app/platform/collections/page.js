"use client";

export const dynamic = "force-dynamic";

import React, { useState, useEffect, useCallback } from "react";
import {
  FolderKanban,
  Plus,
  Search,
  Loader2,
  ChevronRight,
  MoreHorizontal,
  Archive,
  RotateCcw,
  Edit3,
  Tag,
  User,
  Clock,
  Filter,
  X,
  FolderTree,
  AlertTriangle,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * PLATFORM COLLECTIONS
 * Browse, create, edit, search, and manage organizational collections.
 */

const STATUS_CONFIG = {
  active: { color: "text-emerald-500", bg: "bg-emerald-500/10", label: "platformMisc.collections.statusActive" },
  draft: { color: "text-amber-500", bg: "bg-amber-500/10", label: "platformMisc.collections.statusDraft" },
  archived: { color: "text-rose-500", bg: "bg-rose-500/10", label: "platformMisc.collections.statusArchived" },
};

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

export default function CollectionsPage() {
  const { t } = useI18n();
  const [collections, setCollections] = useState([]);
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [viewMode, setViewMode] = useState("grid"); // grid | tree | list
  const [expandedIds, setExpandedIds] = useState(new Set());

  // Compose modal
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    parent_id: "",
    visibility: "internal",
    tags: "",
    category: "",
    color: "#FF6600",
    status: "active",
  });

  // Archive confirmation
  const [archiveConfirm, setArchiveConfirm] = useState(null); // { id, name, action: "archive"|"unarchive" }

  const [notification, setNotification] = useState(null);

  const fetchCollections = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search) params.set("search", search);
      const res = await fetch(`/api/platform/collections?${params}`);
      const data = await res.json();
      if (data.success) {
        setCollections(data.collections || []);
        const t = data.tree || [];
        setTree(t);
        // Auto-expand all tree nodes
        const collectIds = (nodes) => {
          const ids = [];
          for (const n of nodes) {
            ids.push(n.id);
            if (n.children?.length) ids.push(...collectIds(n.children));
          }
          return ids;
        };
        setExpandedIds(new Set(collectIds(t)));
      }
    } catch (_) {}
    setLoading(false);
  }, [search, statusFilter]);

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  const notify = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const toggleExpand = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const method = editing ? "PUT" : "POST";
      const body = editing
        ? { id: editing.id, ...form, tags: form.tags ? form.tags.split(",").map((t) => t.trim()) : [] }
        : { ...form, tags: form.tags ? form.tags.split(",").map((t) => t.trim()) : [] };
      const res = await fetch("/api/platform/collections", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        notify(editing ? t("platformMisc.collections.updated") : t("platformMisc.collections.created"));
        setShowCreate(false);
        setEditing(null);
        setForm({ name: "", description: "", parent_id: "", visibility: "internal", tags: "", category: "", color: "#FF6600", status: "active" });
        fetchCollections();
      } else {
        notify(data.error || t("platformMisc.collections.failed"));
      }
    } catch (_) {}
    setSaving(false);
  };

  const handleArchive = async (id) => {
    const col = collections.find((c) => c.id === id);
    if (!col) return;
    setArchiveConfirm({ id, name: col.name, action: "archive" });
  };

  const handleUnarchive = async (id) => {
    const col = collections.find((c) => c.id === id);
    if (!col) return;
    setArchiveConfirm({ id, name: col.name, action: "unarchive" });
  };

  const confirmArchiveAction = async () => {
    if (!archiveConfirm) return;
    const { id, action } = archiveConfirm;
    const newStatus = action === "archive" ? "archived" : "active";
    try {
      if (action === "archive") {
        await fetch(`/api/platform/collections?id=${id}`, { method: "DELETE" });
      } else {
        await fetch("/api/platform/collections", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, status: newStatus }),
        });
      }
      notify(action === "archive" ? t("platformMisc.collections.archivedNotify") : t("platformMisc.collections.restoredNotify"));
      fetchCollections();
    } catch (_) {}
    setArchiveConfirm(null);
  };

  const handleEdit = (col) => {
    setEditing(col);
    setForm({
      name: col.name || "",
      description: col.description || "",
      parent_id: col.parent_id ? String(col.parent_id) : "",
      visibility: col.visibility || "internal",
      tags: Array.isArray(col.tags) ? col.tags.join(", ") : "",
      category: col.category || "",
      color: col.color || "#FF6600",
      status: col.status || "active",
    });
    setShowCreate(true);
  };

  const renderTreeNode = (node, depth = 0) => {
    const cfg = STATUS_CONFIG[node.status] || STATUS_CONFIG.active;
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedIds.has(node.id);
    return (
      <div key={node.id}>
        <div
          className={cn(
            "flex items-center gap-3 p-3 rounded-xl transition-all cursor-pointer group",
            "hover:bg-tertiary",
          )}
          style={{ marginLeft: depth * 20 }}
        >
          {hasChildren ? (
            <button onClick={() => toggleExpand(node.id)} className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
              <ChevronRight
                className={cn("w-3 h-3 transition-transform", isExpanded && "rotate-90")}
              />
            </button>
          ) : (
            <span className="w-5" />
          )}
          <span
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: node.color || "#FF6600" }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-bold text-[var(--text-primary)] truncate">
              {node.name}
            </p>
            {node.description && (
              <p className="text-[9px] text-[var(--text-secondary)] truncate">
                {node.description}
              </p>
            )}
          </div>
          <span className={cn("px-2 py-0.5 rounded text-[8px] font-black uppercase", cfg.color, cfg.bg)}>
            {t(cfg.label)}
          </span>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => handleEdit(node)} className="p-1 text-[var(--text-secondary)] hover:text-[var(--brand-orange)]">
              <Edit3 className="w-3 h-3" />
            </button>
            {node.status !== "archived" ? (
              <button onClick={() => handleArchive(node.id)} className="p-1 text-[var(--text-secondary)] hover:text-rose-500" title={t("platformMisc.collections.archiveTitle")}>
                <Archive className="w-3 h-3" />
              </button>
            ) : (
              <button onClick={() => handleUnarchive(node.id)} className="p-1 text-[var(--text-secondary)] hover:text-emerald-500" title={t("platformMisc.collections.restoreTitle")}>
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
        {hasChildren && isExpanded && node.children.map((child) => renderTreeNode(child, depth + 1))}
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6 animate-in">
      {/* Notification */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-[500] px-5 py-3 rounded-xl bg-emerald-500 text-black text-[10px] font-black uppercase tracking-widest">
          {notification}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-lg font-black uppercase tracking-tight text-[var(--text-primary)]">
            {t("platformMisc.collections.title")}
          </h1>
          <p className="text-[10px] text-[var(--text-secondary)] mt-1">
            {t("platformMisc.collections.subtitle")}
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setForm({ name: "", description: "", parent_id: "", visibility: "internal", tags: "", category: "", color: "#FF6600", status: "active" });
            setShowCreate(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-[var(--brand-orange)] text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition-all"
        >
          <Plus className="w-3.5 h-3.5" /> {t("platformMisc.collections.newCollection")}
        </button>
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-secondary)]" />
          <input
            type="text"
            placeholder={t("platformMisc.collections.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-tertiary border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none focus:border-[var(--brand-orange)] transition-all"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 rounded-xl bg-tertiary border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]"
        >
          <option value="all">{t("platformMisc.collections.allStatus")}</option>
          <option value="active">{t("platformMisc.collections.statusActive")}</option>
          <option value="draft">{t("platformMisc.collections.statusDraft")}</option>
          <option value="archived">{t("platformMisc.collections.statusArchived")}</option>
        </select>
        <div className="flex bg-primary p-1 rounded-xl border border-[var(--border-primary)]">
          {[
            { id: "grid", label: t("platformMisc.collections.viewGrid") },
            { id: "tree", icon: FolderTree, label: t("platformMisc.collections.viewTree") },
          ].map((mode) => (
            <button
              key={mode.id}
              onClick={() => setViewMode(mode.id)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                viewMode === mode.id
                  ? "bg-[var(--brand-orange)] text-black"
                  : "text-[var(--text-secondary)]",
              )}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tree View */}
      {viewMode === "tree" && (
        <div className="rounded-2xl bg-secondary border border-[var(--border-primary)] p-3 space-y-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-[var(--brand-orange)]" />
            </div>
          ) : tree.length === 0 ? (
            <div className="py-16 text-center">
              <FolderTree className="w-10 h-10 mx-auto text-[var(--text-secondary)] opacity-20" />
              <p className="text-[11px] text-[var(--text-secondary)] mt-3 font-bold">
                {t("platformMisc.collections.noCollections")}
              </p>
              <p className="text-[9px] text-[var(--text-secondary)] mt-1 opacity-50">
                {t("platformMisc.collections.createFirstPrompt")}
              </p>
            </div>
          ) : (
            tree.map((node) => renderTreeNode(node))
          )}
        </div>
      )}

      {/* Grid View */}
      {viewMode === "grid" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            <div className="col-span-full flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-[var(--brand-orange)]" />
            </div>
          ) : collections.length === 0 ? (
            <div className="col-span-full py-16 text-center">
              <FolderKanban className="w-10 h-10 mx-auto text-[var(--text-secondary)] opacity-20" />
              <p className="text-[11px] text-[var(--text-secondary)] mt-3 font-bold">
                {t("platformMisc.collections.noCollections")}
              </p>
              <p className="text-[9px] text-[var(--text-secondary)] mt-1 opacity-50">
                {t("platformMisc.collections.createFirstPrompt")}
              </p>
            </div>
          ) : (
            collections.map((col) => {
              const cfg = STATUS_CONFIG[col.status] || STATUS_CONFIG.active;
              const parent = col.parent_id
                ? collections.find((c) => c.id === col.parent_id)
                : null;
              return (
                <div
                  key={col.id}
                  className="p-5 rounded-2xl bg-secondary border border-[var(--border-primary)] hover:border-[var(--brand-orange)]/50 transition-all group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <span
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: (col.color || "#FF6600") + "20" }}
                    >
                      <FolderKanban
                        className="w-5 h-5"
                        style={{ color: col.color || "#FF6600" }}
                      />
                    </span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleEdit(col)}
                        className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--brand-orange)] hover:bg-tertiary"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                      {col.status !== "archived" ? (
                        <button
                          onClick={() => handleArchive(col.id)}
                          className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-rose-500 hover:bg-tertiary"
                          title={t("platformMisc.collections.archiveTitle")}
                        >
                          <Archive className="w-3 h-3" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUnarchive(col.id)}
                          className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-emerald-500 hover:bg-tertiary"
                          title={t("platformMisc.collections.restoreTitle")}
                        >
                          <RotateCcw className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight">
                    {col.name}
                  </h3>
                  {col.description && (
                    <p className="text-[10px] text-[var(--text-secondary)] mt-1 leading-relaxed">
                      {col.description}
                    </p>
                  )}

                  {parent && (
                    <p className="text-[9px] text-[var(--text-secondary)] mt-2 opacity-50">
                      {t("platformMisc.collections.nestedIn", { name: parent.name })}
                    </p>
                  )}

                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <span className={cn("px-2 py-0.5 rounded text-[8px] font-black uppercase", cfg.color, cfg.bg)}>
                      {t(cfg.label)}
                    </span>
                    {Array.isArray(col.tags) &&
                      col.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 rounded bg-tertiary text-[var(--text-secondary)] text-[8px] font-bold"
                        >
                          {tag}
                        </span>
                      ))}
                  </div>

                  <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[var(--border-primary)] text-[9px] text-[var(--text-secondary)]">
                    {col.owner_name && (
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {col.owner_name}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {col.updated_at
                        ? new Date(col.updated_at).toLocaleDateString()
                        : "—"}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Create / Edit Modal */}
      {showCreate && (
        <div
          className="fixed inset-0 z-[400] bg-black/40 flex items-center justify-center p-6"
          onClick={() => {
            setShowCreate(false);
            setEditing(null);
          }}
        >
          <div
            className="card w-full max-w-xl space-y-5 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">
                {editing ? t("platformMisc.collections.editCollection") : t("platformMisc.collections.newCollection")}
              </h3>
              <button
                onClick={() => {
                  setShowCreate(false);
                  setEditing(null);
                }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("platformMisc.collections.name")}
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={t("platformMisc.collections.namePlaceholder")}
                  className="w-full rounded-xl px-4 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] focus:border-[var(--brand-orange)]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("platformMisc.collections.description")}
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  placeholder={t("platformMisc.collections.descriptionPlaceholder")}
                  className="w-full rounded-xl px-4 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] focus:border-[var(--brand-orange)] resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                    {t("platformMisc.collections.parent")}
                  </label>
                  <select
                    value={form.parent_id}
                    onChange={(e) => setForm({ ...form, parent_id: e.target.value })}
                    className="w-full rounded-xl px-3 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] focus:border-[var(--brand-orange)]"
                  >
                    <option value="">{t("platformMisc.collections.noParent")}</option>
                    {collections
                      .filter((c) => c.id !== editing?.id)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                    {t("platformMisc.collections.visibility")}
                  </label>
                  <select
                    value={form.visibility}
                    onChange={(e) => setForm({ ...form, visibility: e.target.value })}
                    className="w-full rounded-xl px-3 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] focus:border-[var(--brand-orange)]"
                  >
                    <option value="internal">{t("platformMisc.collections.visibilityInternal")}</option>
                    <option value="public">{t("platformMisc.collections.visibilityPublic")}</option>
                    <option value="restricted">{t("platformMisc.collections.visibilityRestricted")}</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("platformMisc.collections.tagsLabel")}
                </label>
                <input
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  placeholder={t("platformMisc.collections.tagsPlaceholder")}
                  className="w-full rounded-xl px-4 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] focus:border-[var(--brand-orange)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                    {t("platformMisc.collections.status")}
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full rounded-xl px-3 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] focus:border-[var(--brand-orange)]"
                  >
                    <option value="active">{t("platformMisc.collections.statusActive")}</option>
                    <option value="draft">{t("platformMisc.collections.statusDraft")}</option>
                    <option value="archived">{t("platformMisc.collections.statusArchived")}</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                    {t("platformMisc.collections.category")}
                  </label>
                  <input
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    placeholder={t("platformMisc.collections.categoryPlaceholder")}
                    className="w-full rounded-xl px-3 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] focus:border-[var(--brand-orange)]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                    {t("platformMisc.collections.color")}
                  </label>
                  <input
                    type="color"
                    value={form.color}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    className="w-full h-[42px] rounded-xl cursor-pointer border border-[var(--border-primary)]"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  setShowCreate(false);
                  setEditing(null);
                }}
                className="flex-1 btn btn-secondary"
              >
                {t("platformMisc.collections.cancel")}
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving || !form.name.trim()}
                className="flex-1 btn btn-primary"
              >
                {saving ? t("platformMisc.collections.saving") : editing ? t("platformMisc.collections.update") : t("platformMisc.collections.create")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Archive Confirmation Modal */}
      {archiveConfirm && (
        <div className="fixed inset-0 z-[500] bg-black/50 flex items-center justify-center p-6" onClick={() => setArchiveConfirm(null)}>
          <div className="card w-full max-w-sm space-y-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-500" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase text-[var(--text-primary)]">
                  {archiveConfirm.action === 'archive' ? t("platformMisc.collections.archiveCollectionTitle") : t("platformMisc.collections.restoreCollectionTitle")}
                </h3>
                <p className="text-[10px] text-[var(--text-secondary)] mt-1 leading-relaxed">
                  {archiveConfirm.action === 'archive'
                    ? t("platformMisc.collections.confirmArchivePrompt")
                    : t("platformMisc.collections.confirmRestorePrompt")}
                  <strong className="text-[var(--text-primary)]">&quot;{archiveConfirm.name}&quot;</strong>?
                </p>
              </div>
            </div>
            {archiveConfirm.action === 'archive' ? (
              <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-2">
                <p className="text-[9px] font-bold text-amber-500 uppercase">{t("platformMisc.collections.archiveExplanationTitle")}</p>
                <ul className="text-[9px] text-[var(--text-secondary)] space-y-1 list-disc list-inside">
                  <li>{t("platformMisc.collections.archiveHidden")}</li>
                  <li>{t("platformMisc.collections.archiveFormsAccessible")}</li>
                  <li>{t("platformMisc.collections.archiveRestorable")}</li>
                  <li>{t("platformMisc.collections.archiveInFilter")}</li>
                </ul>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-2">
                <p className="text-[9px] font-bold text-emerald-500 uppercase">{t("platformMisc.collections.restoreExplanationTitle")}</p>
                <ul className="text-[9px] text-[var(--text-secondary)] space-y-1 list-disc list-inside">
                  <li>{t("platformMisc.collections.restoreActive")}</li>
                  <li>{t("platformMisc.collections.restoreReappear")}</li>
                  <li>{t("platformMisc.collections.restoreFormsUnchanged")}</li>
                </ul>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => setArchiveConfirm(null)} className="flex-1 btn btn-secondary">{t("platformMisc.collections.cancel")}</button>
              <button onClick={confirmArchiveAction}
                className={archiveConfirm.action === 'archive' ? 'flex-1 px-4 py-2.5 rounded-xl bg-rose-500 text-white text-[10px] font-black uppercase hover:bg-rose-600 transition-all' : 'flex-1 px-4 py-2.5 rounded-xl bg-emerald-500 text-white text-[10px] font-black uppercase hover:bg-emerald-600 transition-all'}>
                {archiveConfirm.action === 'archive' ? t("platformMisc.collections.archive") : t("platformMisc.collections.restore")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

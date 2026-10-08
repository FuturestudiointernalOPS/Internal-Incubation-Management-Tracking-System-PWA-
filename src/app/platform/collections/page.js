"use client";

export const dynamic = "force-dynamic";

import React, { useState } from "react";
import {
  ChevronRight,
  Archive,
  RotateCcw,
  Edit3,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import { cn } from "@/components/platform/collections/helpers";
import { STATUS_CONFIG } from "@/components/platform/collections/constants";
import CollectionsHeader from "@/components/platform/collections/CollectionsHeader";
import CollectionsToolbar from "@/components/platform/collections/CollectionsToolbar";
import CollectionsTreeView from "@/components/platform/collections/CollectionsTreeView";
import CollectionsGridView from "@/components/platform/collections/CollectionsGridView";
import CollectionFormModal from "@/components/platform/collections/CollectionFormModal";
import ArchiveConfirmModal from "@/components/platform/collections/ArchiveConfirmModal";

/**
 * PLATFORM COLLECTIONS
 * Browse, create, edit, search, and manage organizational collections.
 */

// The shape the screen renders from, so a failed or malformed payload never
// reaches an `Object.entries` / tree-walk read. Module scope keeps both values
// stable for the hook (an inline literal would refetch on every render).
const EMPTY_COLLECTIONS = { collections: [], tree: [] };
const pickCollections = (response) =>
  response?.success
    ? { collections: response.collections || [], tree: response.tree || [] }
    : EMPTY_COLLECTIONS;

export default function CollectionsPage() {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [viewMode, setViewMode] = useState("grid"); // grid | tree | list
  // The tree starts fully expanded, so the screen only remembers the nodes the
  // user collapsed. Tracking the exceptions is what lets that choice survive a
  // refresh: the old loader re-expanded every node on each load, silently undoing
  // it.
  const [collapsedIds, setCollapsedIds] = useState(new Set());

  // The loader's work — painting from the cache first, discarding a stale
  // response, the background refresh — belongs to the hook, so the screen keeps
  // no list state of its own and never sets state from an effect. The search term
  // and the status filter stay plain dependencies; create, edit and archive call
  // refresh(), which bypasses the cache like bypassCache did.
  const collectionQuery = new URLSearchParams();
  if (statusFilter !== "all") collectionQuery.set("status", statusFilter);
  if (search) collectionQuery.set("search", search);
  const { data, loading, refresh } = useApi(
    `/api/platform/collections?${collectionQuery}`,
    {
      defaultValue: EMPTY_COLLECTIONS,
      transform: pickCollections,
      deps: [search, statusFilter],
    },
  );
  const { collections, tree } = data;

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

  const notify = (message) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 3000);
  };

  const toggleExpand = (nodeId) => {
    setCollapsedIds((previousIds) => {
      const nextIds = new Set(previousIds);
      if (nextIds.has(nodeId)) nextIds.delete(nodeId);
      else nextIds.add(nodeId);
      return nextIds;
    });
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const method = editing ? "PUT" : "POST";
      const body = editing
        ? { id: editing.id, ...form, tags: form.tags ? form.tags.split(",").map((tag) => tag.trim()) : [] }
        : { ...form, tags: form.tags ? form.tags.split(",").map((tag) => tag.trim()) : [] };
      const response = await fetch("/api/platform/collections", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (data.success) {
        notify(editing ? t("platformMisc.collections.updated") : t("platformMisc.collections.created"));
        setShowCreate(false);
        setEditing(null);
        setForm({ name: "", description: "", parent_id: "", visibility: "internal", tags: "", category: "", color: "#FF6600", status: "active" });
        refresh();
      } else {
        notify(t((data.error || t("platformMisc.collections.failed")) || "") || (data.error || t("platformMisc.collections.failed")));
      }
    } catch (_) {}
    setSaving(false);
  };

  const handleArchive = async (collectionId) => {
    const collection = collections.find((entry) => entry.id === collectionId);
    if (!collection) return;
    setArchiveConfirm({ id: collectionId, name: collection.name, action: "archive" });
  };

  const handleUnarchive = async (collectionId) => {
    const collection = collections.find((entry) => entry.id === collectionId);
    if (!collection) return;
    setArchiveConfirm({ id: collectionId, name: collection.name, action: "unarchive" });
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
      refresh();
    } catch (_) {}
    setArchiveConfirm(null);
  };

  const handleEdit = (collection) => {
    setEditing(collection);
    setForm({
      name: collection.name || "",
      description: collection.description || "",
      parent_id: collection.parent_id ? String(collection.parent_id) : "",
      visibility: collection.visibility || "internal",
      tags: Array.isArray(collection.tags) ? collection.tags.join(", ") : "",
      category: collection.category || "",
      color: collection.color || "#FF6600",
      status: collection.status || "active",
    });
    setShowCreate(true);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", description: "", parent_id: "", visibility: "internal", tags: "", category: "", color: "#FF6600", status: "active" });
    setShowCreate(true);
  };

  const closeForm = () => {
    setShowCreate(false);
    setEditing(null);
  };

  const renderTreeNode = (node, depth = 0) => {
    const statusConfig = STATUS_CONFIG[node.status] || STATUS_CONFIG.active;
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = !collapsedIds.has(node.id);
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
              <p className="text-[10px] font-medium text-[var(--text-secondary)] truncate">
                {node.description}
              </p>
            )}
          </div>
          <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase", statusConfig.color, statusConfig.bg)}>
            {t(statusConfig.label)}
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
      <CollectionsHeader t={t} onNew={openCreate} />

      {/* Search & Filters */}
      <CollectionsToolbar
        t={t}
        search={search}
        setSearch={setSearch}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        viewMode={viewMode}
        setViewMode={setViewMode}
      />

      {/* Tree View */}
      {viewMode === "tree" && (
        <CollectionsTreeView t={t} loading={loading} tree={tree} renderTreeNode={renderTreeNode} />
      )}

      {/* Grid View */}
      {viewMode === "grid" && (
        <CollectionsGridView
          t={t}
          loading={loading}
          collections={collections}
          onEdit={handleEdit}
          onArchive={handleArchive}
          onUnarchive={handleUnarchive}
        />
      )}

      {/* Create / Edit Modal */}
      {showCreate && (
        <CollectionFormModal
          t={t}
          editing={editing}
          form={form}
          setForm={setForm}
          collections={collections}
          saving={saving}
          onSubmit={handleSubmit}
          onClose={closeForm}
        />
      )}

      {/* Archive Confirmation Modal */}
      {archiveConfirm && (
        <ArchiveConfirmModal
          t={t}
          archiveConfirm={archiveConfirm}
          onClose={() => setArchiveConfirm(null)}
          onConfirm={confirmArchiveAction}
        />
      )}
    </div>
  );
}

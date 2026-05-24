"use client";

import React, { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import {
  Plus,
  Search,
  Loader2,
  ChevronRight,
  User,
  Shield,
  Users,
  Edit3,
  Archive,
  RotateCcw,
  Trash2,
  Settings,
  ArrowLeft,
  Signal,
  FileText,
  Upload,
  Target,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { uploadFile } from "@/lib/storage";

export default function ProgramManagement() {
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setTab] = useState("active");
  const [editingProgram, setEditingProgram] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [notes, setNotes] = useState([]);
  const [teams, setTeams] = useState([]);
  const [knowledgeItems, setKnowledgeItems] = useState([]);

  const [editingKpis, setEditingKpis] = useState([]);
  const [editKpiInput, setEditKpiInput] = useState({
    title: "",
    target_value: 80,
  });
  const [isKpiSubmitting, setIsKpiSubmitting] = useState(false);

  useEffect(() => {
    if (editingProgram?.id) {
      fetchEditingKpis(editingProgram.id);
    } else {
      setEditingKpis([]);
    }
  }, [editingProgram?.id]);

  const fetchEditingKpis = async (programId) => {
    try {
      const res = await fetch(`/api/v2/kpis?program_id=${programId}`);
      const data = await res.json();
      if (data.success) {
        setEditingKpis(data.kpis || []);
      }
    } catch (e) {
      console.error("Failed to fetch KPIs:", e);
    }
  };

  const handleAddEditKpi = async () => {
    if (!editKpiInput.title.trim() || !editingProgram?.id) return;
    setIsKpiSubmitting(true);
    try {
      const res = await fetch("/api/v2/kpis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          program_id: editingProgram.id,
          title: editKpiInput.title,
          target_value: editKpiInput.target_value,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setEditKpiInput({ title: "", target_value: 80 });
        fetchEditingKpis(editingProgram.id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsKpiSubmitting(false);
    }
  };

  const handleDeleteEditKpi = async (kpiId) => {
    if (!confirm("Decommission this KPI target?")) return;
    try {
      const res = await fetch("/api/v2/kpis", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: kpiId }),
      });
      const data = await res.json();
      if (data.success) {
        fetchEditingKpis(editingProgram.id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const router = useRouter();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const statusParam = activeTab === "active" ? "all" : activeTab;
      const [progRes, managerRes, segmentRes, kbRes] = await Promise.all([
        fetch(
          `/api/pm/programs?show_archived=${activeTab === "archived"}&status=${statusParam}`,
        ),
        fetch("/api/contacts/full-state"),
        fetch("/api/families"),
        fetch("/api/knowledge"),
      ]);

      const [progData, managerData, segmentData, kbData] = await Promise.all([
        progRes.json().catch(() => ({ success: false })),
        managerRes.json().catch(() => ({ success: false })),
        segmentRes.json().catch(() => ({ success: false })),
        kbRes.json().catch(() => ({ success: false })),
      ]);

      if (progData?.success)
        setPrograms(Array.isArray(progData.programs) ? progData.programs : []);
      if (managerData?.success) {
        const managers = (
          Array.isArray(managerData.contacts) ? managerData.contacts : []
        ).filter(
          (c) =>
            c &&
            (c.role === "super_admin" ||
              c.role === "program_manager" ||
              c.role === "admin" ||
              c.role === "staff"),
        );
        setTeams(managers);
      }
      if (segmentData?.success)
        setNotes(
          Array.isArray(segmentData.families) ? segmentData.families : [],
        );
      if (kbData?.success) {
        const items =
          kbData.conceptNotes || kbData.knowledgeItems || kbData.notes || [];
        setKnowledgeItems(Array.isArray(items) ? items : []);
      }
    } catch (e) {
      console.error("Sync Failure:", e);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editingProgram?.id) return;
    setIsUpdating(true);
    try {
      const res = await fetch("/api/pm/programs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingProgram),
      });
      const json = await res.json();
      if (json.success) {
        setEditingProgram(null);
        fetchData();
        // Fire success notification
        window.dispatchEvent(
          new CustomEvent("impactos:notify", {
            detail: {
              type: "success",
              message: "Program saved successfully. Groups have been linked.",
            },
          }),
        );
      } else {
        window.dispatchEvent(
          new CustomEvent("impactos:notify", {
            detail: { type: "error", message: json.error || "Save failed." },
          }),
        );
      }
    } catch (e) {
      console.error("Update Failure:", e);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleArchiveAction = async (id, isArchiving, e) => {
    if (!id) return;
    e.stopPropagation();
    try {
      const res = await fetch("/api/pm/programs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          is_archived: isArchiving ? 1 : 0,
          action: "archive",
        }),
      });
      if ((await res.json()).success) fetchData();
    } catch (e) {
      console.error("Archive Failure:", e);
    }
  };

  const handlePermanentDelete = async (id, e) => {
    if (!id) return;
    e.stopPropagation();
    if (!confirm("Permanent deletion protocol initialized. Are you sure?"))
      return;
    try {
      const res = await fetch("/api/pm/programs", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if ((await res.json()).success) fetchData();
    } catch (e) {
      console.error("Delete Failure:", e);
    }
  };

  const handleEditFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !editingProgram) return;

    setIsUploading(true);
    try {
      const path = `curriculum/${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
      const res = await uploadFile("knowledge", path, file);

      if (res?.success) {
        const newMaterial = {
          name: file.name,
          url: res.url,
          size: file.size,
          type: file.type,
          uploadedAt: new Date().toISOString(),
        };

        const currentMaterials = Array.isArray(editingProgram.materials)
          ? editingProgram.materials
          : [];
        setEditingProgram({
          ...editingProgram,
          materials: [...currentMaterials, newMaterial],
        });
      }
    } catch (e) {
      console.error("Upload failed:", e);
    } finally {
      setIsUploading(false);
    }
  };

  const safePrograms = Array.isArray(programs) ? programs : [];
  const filtered = safePrograms.filter(
    (p) =>
      p?.name && p.name.toLowerCase().includes((search || "").toLowerCase()),
  );

  return (
    <DashboardLayout role="super_admin" activeTab="programs">
      <div className="space-y-10 pb-20 animate-in text-left">
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 border-b border-[var(--border-primary)] pb-10">
          <div className="space-y-4">
            <button
              onClick={() => router.push("/admin")}
              className="group flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all font-bold text-[9px] uppercase tracking-widest"
            >
              <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" />{" "}
              Back to Dashboard
            </button>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Signal className="w-4 h-4 text-[var(--brand-orange)]" />
                <span className="text-[10px] font-bold text-[var(--brand-orange)] uppercase tracking-[0.4em]">
                  Administration
                </span>
              </div>
              <h1 className="text-5xl font-bold tracking-tight text-[var(--text-primary)]">
                PROGRAMS DASHBOARD
              </h1>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => router.push("/admin/standardization")}
              className="btn btn-secondary gap-2"
            >
              <Settings className="w-4 h-4" /> Settings
            </button>
            <button
              onClick={() => router.push("/admin/programs/new")}
              className="btn btn-primary gap-2"
            >
              <Plus className="w-4 h-4" /> Create Program
            </button>
          </div>
        </header>

        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex gap-2 p-1 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-primary)]">
            {[
              { id: "active", label: "All Programs" },
              { id: "completed", label: "Completed Programs" },
              { id: "archived", label: "Archived" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setTab(tab.id)}
                className={`px-6 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === tab.id ? "bg-[var(--brand-orange)] text-black" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by program name..."
              className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl py-3 pl-10 pr-4 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]"
            />
          </div>
        </div>

        {loading ? (
          <TableSkeleton rows={10} />
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Program Details</th>
                  <th>Status</th>
                  <th>PROGRAM MANAGER</th>
                  <th>Engagement</th>
                  <th className="text-right">Administration</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, idx) => (
                  <tr
                    key={p?.id || idx}
                    className="group cursor-pointer hover:bg-[var(--bg-secondary)]"
                    onClick={() =>
                      p?.id && router.push(`/admin/programs/${p.id}`)
                    }
                  >
                    <td>
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-primary)] flex items-center justify-center text-[var(--brand-orange)]">
                          <Signal className="w-5 h-5" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-base font-bold text-[var(--text-primary)] uppercase tracking-tight">
                            {p?.name || "Unnamed Mission"}
                          </span>
                          <span className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mt-0.5 line-clamp-1 max-w-xs">
                            {p?.description || "No directive provided."}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`px-2 py-1 rounded text-[9px] font-bold uppercase tracking-widest ${p?.status === "active" ? "bg-emerald-500/10 text-emerald-500" : "bg-slate-500/10 text-slate-500"}`}
                      >
                        {p?.status || "Unknown"}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <User className="w-3 h-3 text-[var(--brand-orange)]" />
                        <span className="text-[10px] font-bold text-[var(--text-primary)] uppercase">
                          {p?.pm_name || "Unassigned"}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-[var(--text-primary)] uppercase">
                            {p?.participants_count || 0} Members
                          </span>
                          <span className="text-[9px] font-bold text-[var(--brand-orange)] uppercase mt-0.5">
                            {Math.round(p?.completion_index || 0) || 0}%
                            Progress
                          </span>
                        </div>
                        <div className="w-16 h-1 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[var(--brand-orange)]"
                            style={{ width: `${p?.completion_index || 0}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                        {activeTab === "archived" ? (
                          <>
                            <button
                              onClick={(e) =>
                                handleArchiveAction(p?.id, false, e)
                              }
                              title="Restore"
                              className="p-2 hover:text-emerald-500"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => handlePermanentDelete(p?.id, e)}
                              title="Delete"
                              className="p-2 hover:text-rose-500"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/admin/programs/${p?.id}`);
                              }}
                              title="Launch Executive Dashboard"
                              className="p-2 hover:text-[var(--brand-orange)]"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingProgram(p);
                              }}
                              title="Edit"
                              className="p-2 hover:text-[var(--brand-orange)]"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) =>
                                handleArchiveAction(p?.id, true, e)
                              }
                              title="Archive"
                              className="p-2 hover:text-orange-500"
                            >
                              <Archive className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingProgram && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md overflow-y-auto">
          <div className="card w-full max-w-xl space-y-8 border-[var(--brand-orange)]/30 animate-in text-left my-auto max-h-[85vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center sticky top-0 bg-[var(--bg-secondary)] pb-4 z-10 border-b border-[var(--border-primary)]">
              <div>
                <h3 className="text-xl font-bold text-[var(--text-primary)] uppercase tracking-tight italic">
                  Edit Program Registry
                </h3>
                <p className="text-[10px] font-bold text-[var(--brand-orange)] uppercase tracking-widest mt-1">
                  Operational ID: {editingProgram?.id}
                </p>
              </div>
              <button
                onClick={() => setEditingProgram(null)}
                className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg text-[var(--text-secondary)] transition-all"
              >
                <Plus className="w-5 h-5 rotate-45" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-6 pt-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">
                  Program Name
                </label>
                <input
                  type="text"
                  value={editingProgram?.name || ""}
                  onChange={(e) =>
                    setEditingProgram({
                      ...editingProgram,
                      name: e.target.value,
                    })
                  }
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl p-4 font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] focus:ring-1 focus:ring-[var(--brand-orange)] transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">
                  PROGRAM MANAGER
                </label>
                <select
                  value={editingProgram?.assigned_pm_id || ""}
                  onChange={(e) =>
                    setEditingProgram({
                      ...editingProgram,
                      assigned_pm_id: e.target.value,
                    })
                  }
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl p-4 text-[13px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all cursor-pointer"
                >
                  <option value="">Unassigned</option>
                  {(Array.isArray(teams) ? teams : []).map(
                    (m) =>
                      m && (
                        <option key={m.cid || m.id} value={m.cid || m.id}>
                          {m.name?.toUpperCase()}
                        </option>
                      ),
                  )}
                </select>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">
                  PROGRAM PERSONNEL (STAFF)
                </label>
                <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2 opacity-50">
                  Select staff members assigned to assist the Program Manager in
                  oversight.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto p-3 bg-[var(--bg-primary)] rounded-2xl border border-[var(--border-primary)]">
                  {(Array.isArray(teams) ? teams : [])
                    .filter(
                      (t) =>
                        t && (t.cid || t.id) !== editingProgram?.assigned_pm_id,
                    )
                    .map((member) => {
                      if (!member) return null;
                      const mId = member.cid || member.id;
                      let assistantIds = [];
                      if (
                        typeof editingProgram?.assigned_assistant_id ===
                        "string"
                      ) {
                        try {
                          const parsed = JSON.parse(
                            editingProgram.assigned_assistant_id,
                          );
                          assistantIds = Array.isArray(parsed)
                            ? parsed
                            : editingProgram.assigned_assistant_id
                                .split(",")
                                .filter(Boolean);
                        } catch (e) {
                          assistantIds = editingProgram.assigned_assistant_id
                            .split(",")
                            .filter(Boolean);
                        }
                      } else if (
                        Array.isArray(editingProgram?.assigned_assistant_id)
                      ) {
                        assistantIds = editingProgram.assigned_assistant_id;
                      }

                      const isActive = assistantIds.includes(mId);

                      return (
                        <button
                          key={mId}
                          type="button"
                          onClick={() => {
                            let next;
                            if (isActive) {
                              next = assistantIds.filter((id) => id !== mId);
                            } else {
                              next = [...assistantIds, mId];
                            }
                            setEditingProgram({
                              ...editingProgram,
                              assigned_assistant_id: next.join(","),
                            });
                          }}
                          className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                            isActive
                              ? "bg-[var(--brand-orange)]/10 border-[var(--brand-orange)] text-[var(--brand-orange)]"
                              : "bg-[var(--bg-secondary)] border-[var(--border-primary)] text-[var(--text-secondary)]"
                          }`}
                        >
                          <div
                            className={`w-6 h-6 rounded bg-[var(--bg-primary)] border border-[var(--border-primary)] flex items-center justify-center text-[8px] font-black ${isActive ? "text-[var(--brand-orange)] border-[var(--brand-orange)]/30" : ""}`}
                          >
                            {member.name?.charAt(0) || "?"}
                          </div>
                          <span className="text-[9px] font-black uppercase truncate italic">
                            {member.name || "Unknown"}
                          </span>
                        </button>
                      );
                    })}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">
                    Knowledge Base Note
                  </label>
                  <select
                    value={editingProgram?.note_id || ""}
                    onChange={(e) =>
                      setEditingProgram({
                        ...editingProgram,
                        note_id: e.target.value,
                      })
                    }
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl p-4 text-[13px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all cursor-pointer"
                  >
                    <option value="">None Assigned</option>
                    {(Array.isArray(knowledgeItems) ? knowledgeItems : []).map(
                      (item) =>
                        item && (
                          <option key={item.id} value={item.id}>
                            {item.title?.toUpperCase() || "UNTITLED NODE"}
                          </option>
                        ),
                    )}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">
                    Duration (Weeks)
                  </label>
                  <input
                    type="number"
                    value={editingProgram?.duration_weeks || 4}
                    onChange={(e) =>
                      setEditingProgram({
                        ...editingProgram,
                        duration_weeks: parseInt(e.target.value) || 4,
                      })
                    }
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl p-4 font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">
                  Curriculum Materials (PDF)
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {(() => {
                    if (!editingProgram) return null;
                    let mats = [];
                    try {
                      const raw = Array.isArray(editingProgram.materials)
                        ? editingProgram.materials
                        : typeof editingProgram.materials === "string"
                          ? JSON.parse(editingProgram.materials || "[]")
                          : [];
                      mats = Array.isArray(raw) ? raw : [];
                    } catch (e) {
                      console.error("Materials parse failure:", e);
                      mats = [];
                    }

                    if (mats.length === 0)
                      return (
                        <p className="text-[10px] italic opacity-40 ml-2">
                          No program-specific PDFs uploaded.
                        </p>
                      );

                    return mats.map(
                      (f, i) =>
                        f && (
                          <div
                            key={i}
                            className="flex items-center justify-between p-3 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-xl"
                          >
                            <div className="flex items-center gap-3">
                              <FileText className="w-4 h-4 text-blue-500" />
                              <span className="text-[10px] font-bold text-white uppercase truncate max-w-[200px]">
                                {f.name || "Untitled PDF"}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const newMats = mats.filter(
                                  (_, idx) => idx !== i,
                                );
                                setEditingProgram({
                                  ...editingProgram,
                                  materials: newMats,
                                });
                              }}
                              className="text-rose-500 hover:bg-rose-500/10 p-1 rounded transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ),
                    );
                  })()}
                </div>

                <div className="flex items-center gap-3 mt-2">
                  <button
                    type="button"
                    disabled={isUploading}
                    onClick={() =>
                      document.getElementById("curriculum-upload")?.click()
                    }
                    className="btn btn-secondary px-6 py-3 flex items-center gap-2 border-dashed"
                  >
                    {isUploading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    <span className="text-[10px] uppercase font-black">
                      {isUploading ? "Syncing..." : "Upload Additional PDF"}
                    </span>
                  </button>
                  <input
                    id="curriculum-upload"
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={handleEditFileUpload}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">
                  TARGET STUDENT GROUPS
                </label>
                <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2 opacity-50">
                  Assign this program to specific student cohorts or families.
                </p>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-3 bg-[var(--bg-primary)] rounded-2xl border border-[var(--border-primary)]">
                  {(Array.isArray(notes) ? notes : []).map((s) => {
                    if (!s) return null;
                    const assignedSegments = Array.isArray(
                      editingProgram?.assigned_segments,
                    )
                      ? editingProgram.assigned_segments
                      : [];
                    const isActive = assignedSegments.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          const current = Array.isArray(
                            editingProgram?.assigned_segments,
                          )
                            ? editingProgram.assigned_segments
                            : [];
                          const next = current.includes(s.id)
                            ? current.filter((id) => id !== s.id)
                            : [...current, s.id];
                          setEditingProgram({
                            ...editingProgram,
                            assigned_segments: next,
                          });
                        }}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                          isActive
                            ? "bg-[var(--brand-orange)]/10 border-[var(--brand-orange)] text-[var(--brand-orange)]"
                            : "bg-[var(--bg-secondary)] border-[var(--border-primary)] text-[var(--text-secondary)]"
                        }`}
                      >
                        <Users
                          className={`w-3.5 h-3.5 ${isActive ? "text-[var(--brand-orange)]" : "text-[var(--text-secondary)]"}`}
                        />
                        <span className="text-[9px] font-black uppercase truncate italic">
                          {s.name || "Unnamed"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">
                  Program Description
                </label>
                <textarea
                  rows={3}
                  value={editingProgram?.description || ""}
                  onChange={(e) =>
                    setEditingProgram({
                      ...editingProgram,
                      description: e.target.value,
                    })
                  }
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl p-4 font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] resize-none transition-all"
                />
              </div>

              {/* STRATEGIC KPIs EDITOR */}
              <div className="space-y-4 pt-6 border-t border-[var(--border-primary)] text-left">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2 font-sans flex items-center gap-2">
                    <Target className="w-3.5 h-3.5" /> Strategic KPIs
                    Configuration
                  </label>
                  <span className="text-[8px] font-bold text-[var(--text-secondary)] uppercase tracking-widest italic opacity-50">
                    SuperAdmin Only
                  </span>
                </div>

                <div className="space-y-3">
                  {editingKpis.map((kpi) => (
                    <div
                      key={kpi.id}
                      className="flex items-center justify-between p-3.5 bg-white/[0.02] border border-[var(--border-primary)] rounded-xl group hover:border-[var(--brand-orange)]/30 transition-all"
                    >
                      <div>
                        <p className="text-xs font-bold text-white uppercase tracking-tight">
                          {kpi.title}
                        </p>
                        <p className="text-[8px] font-bold text-[var(--brand-orange)] uppercase tracking-widest mt-1">
                          Target Value: {kpi.target_value}%
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteEditKpi(kpi.id)}
                        className="text-slate-500 hover:text-rose-500 transition-colors p-2"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}

                  <div className="p-4 bg-[var(--brand-orange)]/5 border border-[var(--brand-orange)]/10 rounded-xl space-y-4">
                    <div className="space-y-1">
                      <p className="text-[9px] font-bold text-[var(--brand-orange)] uppercase tracking-widest">
                        Define New Target
                      </p>
                      <p className="text-[10px] text-[var(--text-secondary)]">
                        Target represents the completion percentage goal (e.g.
                        80%) for this metric. All defined KPIs are averaged
                        together to calculate the program's total progress.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        placeholder="KPI Title (e.g. Attendance)..."
                        className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl px-4 py-3 text-white outline-none focus:border-[var(--brand-orange)] text-xs font-bold"
                        value={editKpiInput.title}
                        onChange={(e) =>
                          setEditKpiInput({
                            ...editKpiInput,
                            title: e.target.value,
                          })
                        }
                      />
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          placeholder="80%"
                          className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl px-4 py-3 text-white outline-none focus:border-[var(--brand-orange)] text-xs font-bold"
                          value={editKpiInput.target_value}
                          onChange={(e) =>
                            setEditKpiInput({
                              ...editKpiInput,
                              target_value: parseInt(e.target.value) || 0,
                            })
                          }
                        />
                        <button
                          type="button"
                          onClick={handleAddEditKpi}
                          disabled={
                            isKpiSubmitting || !editKpiInput.title.trim()
                          }
                          className="px-4 bg-[var(--brand-orange)] text-black font-bold uppercase text-[9px] tracking-widest rounded-xl hover:bg-white transition-all disabled:opacity-50"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isUpdating}
                className="btn btn-primary w-full py-5 uppercase font-black tracking-[0.2em] italic shadow-xl shadow-orange-500/20"
              >
                {isUpdating ? (
                  <div className="flex items-center justify-center gap-3">
                    <Loader2 className="w-5 h-5 animate-spin" />{" "}
                    <span>Saving...</span>
                  </div>
                ) : (
                  "Save"
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Loader2, CheckCircle2, AlertCircle, X, Plus, Search, BookOpen, Bookmark,
  ExternalLink, Clock, Eye, Filter, FileText, Video, Link as LinkIcon, TrendingUp, Target,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cacheGet, cacheSet } from "@/lib/hooks/useApi";

const TYPE_ICONS = {
  article: FileText, video: Video, pdf: FileText, template: FileText,
  checklist: CheckCircle2, presentation: FileText, external_link: LinkIcon,
  course: BookOpen, case_study: FileText,
};

export default function VentureKnowledgePage() {
  const { id } = useParams();
  const router = useRouter();
  const { t } = useI18n();
  const [venture, setVenture] = useState(null);
  const [resources, setResources] = useState([]);
  const [categories, setCategories] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [recommended, setRecommended] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("");
  const [activeView, setActiveView] = useState("browse");
  const [toast, setToast] = useState(null);
  const [selectedResource, setSelectedResource] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Learning
  const [learningProgress, setLearningProgress] = useState(null);
  const [learningPaths, setLearningPaths] = useState([]);
  const [allPaths, setAllPaths] = useState([]);

  // Create form
  const [crForm, setCrForm] = useState({ title: "", description: "", resource_type: "article", category_id: "", url: "", tags: "" });

  useEffect(() => { fetchAll(); }, []);

  const notify = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000); };

  const fetchAll = async (bypassCache = false) => {
    const urls = [
      `/api/ventures/${id}`,
      `/api/ventures/${id}/knowledge`,
      `/api/ventures/${id}/knowledge?type=categories`,
      `/api/ventures/${id}/knowledge?type=bookmarks`,
      `/api/ventures/${id}/knowledge?type=recommended`,
      `/api/ventures/${id}/knowledge?type=learning_progress`,
      `/api/ventures/${id}/knowledge?type=learning_paths`,
    ];
    const apply = (v, r, c, b, rec, lp, paths) => {
      if (v.success) setVenture(v.venture);
      if (r.success) setResources(r.resources || []);
      if (c.success) setCategories(c.categories || []);
      if (b.success) setBookmarks(b.bookmarks || []);
      if (rec.success) setRecommended(rec.resources || []);
      if (lp.success) setLearningProgress(lp);
      if (paths.success) setLearningPaths(paths.paths || []);
    };
    setLoading(true);
    try {
      // Cache-first paint: returning to this page renders instantly from
      // fresh snapshots; mutation flows pass bypassCache=true so the data
      // always reflects the last action.
      if (!bypassCache) {
        const cached = urls.map((u) => cacheGet(u));
        if (cached.every((c) => c !== null && c.success)) {
          apply(...cached);
          setLoading(false);
        }
      }
      const [vRes, rRes, cRes, bRes, recRes, lpRes, pathsRes] = await Promise.all(urls.map((u) => fetch(u)));
      const v = await vRes.json(); const r = await rRes.json(); const c = await cRes.json();
      const b = await bRes.json(); const rec = await recRes.json();
      const lp = await lpRes.json(); const paths = await pathsRes.json();
      if (v.success) cacheSet(urls[0], v);
      if (r.success) cacheSet(urls[1], r);
      if (c.success) cacheSet(urls[2], c);
      if (b.success) cacheSet(urls[3], b);
      if (rec.success) cacheSet(urls[4], rec);
      if (lp.success) cacheSet(urls[5], lp);
      if (paths.success) cacheSet(urls[6], paths);
      apply(v, r, c, b, rec, lp, paths);
    } catch {} finally { setLoading(false); }
  };

  const handleSearch = async () => {
    const res = await fetch(`/api/ventures/${id}/knowledge?search=${encodeURIComponent(search)}`);
    const d = await res.json();
    if (d.success) setResources(d.resources || []);
  };

  const handleBookmark = async (resourceId) => {
    const res = await fetch(`/api/ventures/${id}/knowledge`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "bookmark", resource_id: resourceId }),
    });
    const d = await res.json();
    if (d.success) { notify(d.bookmarked ? t("vadmin.knowledge.bookmarked") : t("vadmin.knowledge.removed")); fetchAll(true); }
  };

  const handleComplete = async (resourceId) => {
    await fetch(`/api/ventures/${id}/knowledge`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "complete", resource_id: resourceId }),
    });
    notify(t("vadmin.knowledge.markedComplete"));
    fetchAll(true);
  };

  const loadResource = async (resourceId) => {
    const res = await fetch(`/api/ventures/${id}/knowledge?type=resource&resource_id=${resourceId}`);
    const d = await res.json();
    if (d.success) setSelectedResource(d.resource);
  };

  const createResource = async () => {
    if (!crForm.title.trim()) { notify(t("vadmin.knowledge.titleRequired"), "error"); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/ventures/${id}/knowledge`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", ...crForm, category_id: crForm.category_id ? parseInt(crForm.category_id) : null, tags: crForm.tags ? crForm.tags.split(",").map((t) => t.trim()) : [] }),
      });
      const d = await res.json();
      if (d.success) { notify(t("vadmin.knowledge.resourceCreated")); setShowCreateModal(false); setCrForm({ title: "", description: "", resource_type: "article", category_id: "", url: "", tags: "" }); fetchAll(true); }
      else notify(t((d.error || t("vadmin.knowledge.failed")) || "") || (d.error || t("vadmin.knowledge.failed")), "error");
    } catch { notify(t("vadmin.knowledge.networkError"), "error"); }
    setSaving(false);
  };

  const filterByCategory = async (slug) => {
    setActiveCategory(slug);
    if (!slug) { fetchAll(); return; }
    const res = await fetch(`/api/ventures/${id}/knowledge?category=${slug}`);
    const d = await res.json();
    if (d.success) setResources(d.resources || []);
  };

  if (loading) return (
    <><div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-[var(--brand-orange)]" /></div></>
  );

  const displayResources = activeView === "bookmarks" ? bookmarks : activeView === "recommended" ? recommended : activeView === "progress" ? [] : resources;

  const progressBar = (pct) => (
    <div className="w-full bg-tertiary rounded-full h-2 overflow-hidden">
      <div className={`h-full rounded-full transition-all ${pct >= 80 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-[var(--brand-orange)]"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );

  return (
    <>
      <div className="space-y-8 pb-20">
        {toast && (<div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 ${toast.type === "error" ? "bg-rose-600 text-white" : "bg-emerald-600 text-white"}`}>
          {toast.type === "error" ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}{toast.msg}
        </div>)}

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <button onClick={() => router.push(`/admin/ventures/${id}/dashboard`)}
              className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-[var(--text-primary)] transition-all mb-2">
              <ArrowLeft className="w-3 h-3" /> {t("vadmin.knowledge.backToDashboard")}
            </button>
            <h1 className="text-2xl font-black text-[var(--text-primary)] flex items-center gap-3">
              <BookOpen className="w-6 h-6 text-[var(--brand-orange)]" /> {t("vadmin.knowledge.knowledgeHub")}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">{t("vadmin.knowledge.resourcesCount", { count: resources.length })} · {t("vadmin.knowledge.categoriesCount", { count: categories.length })}</p>
          </div>
          <button onClick={() => setShowCreateModal(true)} className="px-4 py-2.5 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all flex items-center gap-2">
            <Plus className="w-3.5 h-3.5" /> {t("vadmin.knowledge.addResource")}
          </button>
        </div>

        {/* Search */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder={t("vadmin.knowledge.searchPlaceholder")} className="w-full pl-12 pr-4 py-3 bg-secondary border border-[var(--border-primary)] rounded-xl text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]" />
          </div>
          <button onClick={handleSearch} className="px-4 py-3 bg-[var(--brand-orange)]/10 text-[var(--brand-orange)] rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110">{t("vadmin.knowledge.search")}</button>
        </div>

        {/* View Tabs */}
        <div className="flex gap-1 border-b border-[var(--border-primary)]">
          {[
            { id: "browse", label: t("vadmin.knowledge.browse"), icon: BookOpen },
            { id: "recommended", label: t("vadmin.knowledge.recommended"), icon: Bookmark },
            { id: "bookmarks", label: t("vadmin.knowledge.bookmarksCount", { count: bookmarks.length }), icon: Bookmark },
            { id: "progress", label: t("vadmin.knowledge.learning"), icon: TrendingUp },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveView(tab.id)}
                className={`px-4 py-2.5 text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5 border-b-2 transition-all ${activeView === tab.id ? "border-[var(--brand-orange)] text-[var(--brand-orange)]" : "border-transparent text-slate-500"}`}>
                <Icon className="w-3 h-3" />{tab.label}
              </button>
            );
          })}
        </div>

        {/* Categories + Resources */}
        <div className="flex gap-6">
          {/* Categories sidebar */}
          <div className="w-48 shrink-0 space-y-1">
            <button onClick={() => filterByCategory("")}
              className={`w-full text-left px-3 py-2 rounded-xl text-[8px] font-black uppercase tracking-wider transition-all ${!activeCategory ? "bg-[var(--brand-orange)]/10 text-[var(--brand-orange)]" : "text-slate-500 hover:bg-tertiary"}`}>
              {t("vadmin.knowledge.allResources")}
            </button>
            {categories.map((cat) => (
              <button key={cat.id} onClick={() => filterByCategory(cat.slug)}
                className={`w-full text-left px-3 py-2 rounded-xl text-[9px] font-bold transition-all flex items-center justify-between ${activeCategory === cat.slug ? "bg-[var(--brand-orange)]/10 text-[var(--brand-orange)]" : "text-slate-500 hover:bg-tertiary"}`}>
                <span>{cat.name}</span>
                <span className="text-[7px] text-slate-600">{cat.resource_count}</span>
              </button>
            ))}
          </div>

          {/* Resources grid */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeView === "progress" ? (
              <div className="col-span-full space-y-6">
                {/* Progress Overview */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-4 rounded-2xl bg-tertiary border border-[var(--border-primary)]">
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{t("vadmin.knowledge.completed")}</p>
                    <p className="text-2xl font-black text-emerald-400">{learningProgress?.completed_resources || 0}<span className="text-sm text-slate-500">/{learningProgress?.total_resources || 0}</span></p>
                  </div>
                  <div className="p-4 rounded-2xl bg-tertiary border border-[var(--border-primary)]">
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{t("vadmin.knowledge.progress")}</p>
                    <p className="text-2xl font-black text-[var(--brand-orange)]">{learningProgress?.completion_percentage || 0}%</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-tertiary border border-[var(--border-primary)]">
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{t("vadmin.knowledge.hoursLearned")}</p>
                    <p className="text-2xl font-black text-blue-400">{learningProgress?.hours_learned || 0}h</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-tertiary border border-[var(--border-primary)]">
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{t("vadmin.knowledge.streak")}</p>
                    <p className="text-2xl font-black text-amber-400">{learningProgress?.learning_streak || 0}d</p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="card">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">{t("vadmin.knowledge.overallLearningProgress")}</span>
                    <span className="text-sm font-black">{learningProgress?.completion_percentage || 0}%</span>
                  </div>
                  {progressBar(learningProgress?.completion_percentage || 0)}
                </div>

                {/* Learning Paths */}
                {learningPaths.length > 0 && (
                  <div className="card">
                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">{t("vadmin.knowledge.learningPaths")}</h3>
                    <div className="space-y-3">
                      {learningPaths.map((p) => (
                        <div key={p.id} className="p-4 rounded-xl bg-tertiary border border-[var(--border-primary)]">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <p className="text-xs font-bold text-[var(--text-primary)]">{p.name}</p>
                              <p className="text-[8px] text-slate-500 capitalize">{p.level} · {t("vadmin.knowledge.estimatedHours", { hours: p.estimated_hours })}</p>
                            </div>
                            <span className="text-sm font-black">{p.completion || 0}%</span>
                          </div>
                          {progressBar(p.completion || 0)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Pending Resources */}
                {(learningProgress?.pending_resources || []).length > 0 && (
                  <div className="card">
                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">{t("vadmin.knowledge.continueLearning")}</h3>
                    <div className="space-y-2">
                      {learningProgress.pending_resources.map((r) => (
                        <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl bg-tertiary border border-[var(--border-primary)] cursor-pointer hover:border-[var(--brand-orange)]/30" onClick={() => loadResource(r.id)}>
                          <FileText className="w-4 h-4 text-[var(--brand-orange)]" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold text-[var(--text-primary)] truncate">{r.title}</p>
                            <p className="text-[8px] text-slate-500">{r.category_name || ""} · {t("vadmin.knowledge.lastViewed")} {r.last_viewed_at ? new Date(r.last_viewed_at).toLocaleDateString() : ""}</p>
                          </div>
                          <Clock className="w-3 h-3 text-slate-500" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : displayResources.length === 0 ? (
              <div className="col-span-full text-center py-16">
                <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-sm text-slate-500">{activeView === "bookmarks" ? t("vadmin.knowledge.noBookmarksYet") : t("vadmin.knowledge.noResourcesFound")}</p>
              </div>
            ) : (
              displayResources.map((r) => {
                const Icon = TYPE_ICONS[r.resource_type] || FileText;
                return (
                  <div key={r.id} className="p-4 rounded-2xl bg-tertiary border border-[var(--border-primary)] hover:border-[var(--brand-orange)]/30 transition-all cursor-pointer"
                    onClick={() => loadResource(r.id)}>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[var(--brand-orange)]/10 flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5 text-[var(--brand-orange)]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-[var(--text-primary)] truncate">{r.title}</p>
                          {r.is_featured && <span className="text-[7px] font-black px-1 py-0.5 rounded bg-amber-500/10 text-amber-400">{t("vadmin.knowledge.featured")}</span>}
                        </div>
                        {r.description && <p className="text-[9px] text-slate-500 mt-1 line-clamp-2">{r.description}</p>}
                        <div className="flex items-center gap-3 mt-2 text-[8px] text-slate-500">
                          <span className="capitalize">{r.resource_type?.replace(/_/g, " ")}</span>
                          {r.category_name && <span>{r.category_name}</span>}
                          {r.estimated_minutes && <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{t("vadmin.knowledge.minutes", { minutes: r.estimated_minutes })}</span>}
                          <span className="flex items-center gap-1"><Eye className="w-2.5 h-2.5" />{r.view_count || 0}</span>
                        </div>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); handleBookmark(r.id); }}
                        className={`p-1.5 rounded-lg transition-all ${r.is_bookmarked || bookmarks.some((b) => b.id === r.id) ? "text-[var(--brand-orange)]" : "text-slate-500 hover:text-[var(--brand-orange)]"}`}>
                        <Bookmark className={`w-4 h-4 ${r.is_bookmarked ? "fill-current" : ""}`} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ── Resource Detail Modal ── */}
      {selectedResource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-3xl p-8 max-h-[80vh] overflow-y-auto space-y-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-[var(--brand-orange)]/10 flex items-center justify-center">
                  {React.createElement(TYPE_ICONS[selectedResource.resource_type] || FileText, { className: "w-6 h-6 text-[var(--brand-orange)]" })}
                </div>
                <div>
                  <h2 className="text-lg font-black text-[var(--text-primary)]">{selectedResource.title}</h2>
                  <p className="text-[9px] text-slate-500 capitalize">{selectedResource.resource_type?.replace(/_/g, " ")} · {selectedResource.category_name}</p>
                </div>
              </div>
              <button onClick={() => setSelectedResource(null)} className="p-2 hover:bg-white/5 rounded-lg"><X className="w-4 h-4 text-slate-500" /></button>
            </div>

            {selectedResource.description && <p className="text-sm text-[var(--text-secondary)]">{selectedResource.description}</p>}

            <div className="flex flex-wrap gap-2">
              {selectedResource.estimated_minutes && <span className="text-[8px] font-bold px-2 py-1 rounded bg-slate-500/10 text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" />{t("vadmin.knowledge.minutes", { minutes: selectedResource.estimated_minutes })}</span>}
              <span className="text-[8px] font-bold px-2 py-1 rounded bg-slate-500/10 text-slate-400 flex items-center gap-1"><Eye className="w-3 h-3" />{t("vadmin.knowledge.views", { views: selectedResource.view_count || 0 })}</span>
              {selectedResource.is_completed && <span className="text-[8px] font-bold px-2 py-1 rounded bg-emerald-500/10 text-emerald-400">✓ {t("vadmin.knowledge.completed")}</span>}
            </div>

            {(selectedResource.tags || []).length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {selectedResource.tags.map((t, i) => <span key={i} className="text-[7px] font-bold px-1.5 py-0.5 rounded bg-slate-500/10 text-slate-400">#{t}</span>)}
              </div>
            )}

            {selectedResource.content && <div className="p-4 bg-primary rounded-xl text-xs text-[var(--text-secondary)] whitespace-pre-wrap max-h-48 overflow-y-auto">{selectedResource.content}</div>}

            {selectedResource.url && (
              <a href={selectedResource.url} target="_blank" className="flex items-center gap-2 px-4 py-2.5 bg-[var(--brand-orange)]/10 text-[var(--brand-orange)] rounded-xl text-[9px] font-black uppercase tracking-wider hover:brightness-110 w-fit">
                <ExternalLink className="w-3.5 h-3.5" /> {t("vadmin.knowledge.openResource")}
              </a>
            )}

            <div className="flex gap-3 pt-2 border-t border-[var(--border-primary)]">
              <button onClick={() => { handleBookmark(selectedResource.id); setSelectedResource((p) => ({ ...p, is_bookmarked: !p.is_bookmarked })); }}
                className={`px-4 py-2 rounded-xl text-[8px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${selectedResource.is_bookmarked ? "bg-[var(--brand-orange)]/10 text-[var(--brand-orange)]" : "border border-[var(--border-primary)] text-slate-500 hover:bg-tertiary"}`}>
                <Bookmark className={`w-3 h-3 ${selectedResource.is_bookmarked ? "fill-current" : ""}`} /> {selectedResource.is_bookmarked ? t("vadmin.knowledge.bookmarked") : t("vadmin.knowledge.bookmark")}
              </button>
              {!selectedResource.is_completed && (
                <button onClick={() => { handleComplete(selectedResource.id); setSelectedResource((p) => ({ ...p, is_completed: true })); }}
                  className="px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 text-[8px] font-black uppercase tracking-wider hover:brightness-110 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3" /> {t("vadmin.knowledge.markComplete")}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Create Resource Modal ── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-3xl p-8 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-[var(--text-primary)]">{t("vadmin.knowledge.addResource")}</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-white/5 rounded-lg"><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">{t("vadmin.knowledge.titleLabel")}</label>
                <input value={crForm.title} onChange={(e) => setCrForm((p) => ({ ...p, title: e.target.value }))} className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">{t("vadmin.knowledge.type")}</label>
                  <select value={crForm.resource_type} onChange={(e) => setCrForm((p) => ({ ...p, resource_type: e.target.value }))} className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none">
                    <option value="article">{t("vadmin.knowledge.typeArticle")}</option><option value="video">{t("vadmin.knowledge.typeVideo")}</option><option value="pdf">{t("vadmin.knowledge.typePdf")}</option>
                    <option value="template">{t("vadmin.knowledge.typeTemplate")}</option><option value="checklist">{t("vadmin.knowledge.typeChecklist")}</option><option value="presentation">{t("vadmin.knowledge.typePresentation")}</option>
                    <option value="external_link">{t("vadmin.knowledge.typeExternalLink")}</option><option value="course">{t("vadmin.knowledge.typeCourse")}</option><option value="case_study">{t("vadmin.knowledge.typeCaseStudy")}</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">{t("vadmin.knowledge.category")}</label>
                  <select value={crForm.category_id} onChange={(e) => setCrForm((p) => ({ ...p, category_id: e.target.value }))} className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none">
                    <option value="">{t("vadmin.knowledge.select")}</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">{t("vadmin.knowledge.urlLabel")}</label>
                <input value={crForm.url} onChange={(e) => setCrForm((p) => ({ ...p, url: e.target.value }))} className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none" />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">{t("vadmin.knowledge.description")}</label>
                <textarea value={crForm.description} onChange={(e) => setCrForm((p) => ({ ...p, description: e.target.value }))} rows={2} className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none resize-none" />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">{t("vadmin.knowledge.tagsLabel")}</label>
                <input value={crForm.tags} onChange={(e) => setCrForm((p) => ({ ...p, tags: e.target.value }))} placeholder={t("vadmin.knowledge.tagsPlaceholder")} className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowCreateModal(false)} className="flex-1 py-3 rounded-xl border border-[var(--border-primary)] text-[9px] font-black uppercase tracking-widest hover:bg-tertiary">{t("vadmin.knowledge.cancel")}</button>
              <button onClick={createResource} disabled={saving}
                className="flex-1 py-3 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 disabled:opacity-30 flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} {t("vadmin.knowledge.create")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

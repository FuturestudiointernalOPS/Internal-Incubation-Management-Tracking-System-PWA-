"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Loader2, CheckCircle2, AlertCircle, X, Plus, Search, FileText, Upload,
  Share2, Clock, Eye, Download, History, Trash2, Copy, Link as LinkIcon,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";

const CATEGORIES = [
  { value: "pitch_deck", label: "Pitch Deck", icon: FileText },
  { value: "business_plan", label: "Business Plan", icon: FileText },
  { value: "financial_statements", label: "Financial Statements", icon: FileText },
  { value: "cap_table", label: "Cap Table", icon: FileText },
  { value: "legal_documents", label: "Legal Documents", icon: FileText },
  { value: "product_roadmap", label: "Product Roadmap", icon: FileText },
  { value: "market_research", label: "Market Research", icon: FileText },
  { value: "customer_metrics", label: "Customer Metrics", icon: FileText },
  { value: "revenue_reports", label: "Revenue Reports", icon: FileText },
  { value: "technical_documentation", label: "Technical Documentation", icon: FileText },
  { value: "other", label: "Other", icon: FileText },
];

export default function VentureDataRoomPage() {
  const { id } = useParams();
  const router = useRouter();
  const [venture, setVenture] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("");
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shares, setShares] = useState([]);
  const [accessLogs, setAccessLogs] = useState([]);
  const [saving, setSaving] = useState(false);

  // Upload form
  const [uForm, setUForm] = useState({ title: "", description: "", category: "other", file_name: "", file_url: "", is_pitch_deck: false });

  // Share form
  const [shareForm, setShareForm] = useState({ email: "", name: "", access_type: "read", expires_in_hours: "72" });

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [vRes, dRes] = await Promise.all([
        fetch(`/api/ventures/${id}`),
        fetch(`/api/ventures/${id}/documents`),
      ]);
      const v = await vRes.json(); const d = await dRes.json();
      if (v.success) setVenture(v.venture);
      if (d.success) setDocuments(d.documents || []);
    } catch {} finally { setLoading(false); }
  };

  const loadDetail = async (docId) => {
    const [dRes, sRes, lRes] = await Promise.all([
      fetch(`/api/ventures/${id}/documents?type=detail&document_id=${docId}`),
      fetch(`/api/ventures/${id}/documents?type=shares&document_id=${docId}`),
      fetch(`/api/ventures/${id}/documents?type=access_logs&document_id=${docId}`),
    ]);
    const d = await dRes.json(); const s = await sRes.json(); const l = await lRes.json();
    if (d.success) setSelectedDoc(d.document);
    if (s.success) setShares(s.shares || []);
    if (l.success) setAccessLogs(l.logs || []);
    setShowDetail(true);
  };

  const handleUpload = async () => {
    if (!uForm.title.trim() || !uForm.file_url.trim()) return;
    setSaving(true);
    try {
      await fetch(`/api/ventures/${id}/documents`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "upload", ...uForm, file_name: uForm.file_name || uForm.title + ".pdf" }),
      });
      setShowUploadModal(false); setUForm({ title: "", description: "", category: "other", file_name: "", file_url: "", is_pitch_deck: false });
      fetchAll();
    } catch {} finally { setSaving(false); }
  };

  const handleShare = async () => {
    if (!selectedDoc) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/ventures/${id}/documents`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "share", document_id: selectedDoc.id, ...shareForm }),
      });
      const d = await res.json();
      if (d.success) {
        navigator.clipboard?.writeText(`${window.location.origin}${d.share_url}`);
        loadDetail(selectedDoc.id);
        setShowShareModal(false);
      }
    } catch {} finally { setSaving(false); }
  };

  const handleRevoke = async (shareId) => {
    await fetch(`/api/ventures/${id}/documents`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "revoke_share", share_id: shareId }),
    });
    if (selectedDoc) loadDetail(selectedDoc.id);
  };

  const handleDelete = async (docId) => {
    await fetch(`/api/ventures/${id}/documents`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", document_id: docId }),
    });
    setShowDetail(false); setSelectedDoc(null); fetchAll();
  };

  const filtered = documents.filter((d) => {
    if (activeCategory && d.category !== activeCategory) return false;
    if (search) { const q = search.toLowerCase(); return d.title?.toLowerCase().includes(q) || d.description?.toLowerCase().includes(q); }
    return true;
  });

  if (loading) return (
    <DashboardLayout role="super_admin"><div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-[var(--brand-orange)]" /></div></DashboardLayout>
  );

  return (
    <DashboardLayout role="super_admin">
      <div className="space-y-8 pb-20">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <button onClick={() => router.push(`/admin/ventures/${id}/dashboard`)}
              className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-[var(--text-primary)] transition-all mb-2">
              <ArrowLeft className="w-3 h-3" /> Back to Dashboard
            </button>
            <h1 className="text-2xl font-black text-[var(--text-primary)] flex items-center gap-3">
              <FileText className="w-6 h-6 text-[var(--brand-orange)]" /> Data Room
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">{venture?.company_name||""} · {documents.length} documents</p>
          </div>
          <button onClick={() => setShowUploadModal(true)} className="px-4 py-2.5 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all flex items-center gap-2">
            <Upload className="w-3.5 h-3.5" /> Upload Document
          </button>
        </div>

        {/* Categories + Search */}
        <div className="flex gap-3">
          <div className="flex gap-1 overflow-x-auto pb-1">
            <button onClick={() => setActiveCategory("")} className={`px-3 py-1.5 rounded-xl text-[7px] font-black uppercase tracking-wider whitespace-nowrap ${!activeCategory ? "bg-[var(--brand-orange)]/10 text-[var(--brand-orange)]" : "bg-tertiary text-slate-500 hover:bg-white/5"}`}>All</button>
            {CATEGORIES.map((c) => (
              <button key={c.value} onClick={() => setActiveCategory(c.value)} className={`px-3 py-1.5 rounded-xl text-[7px] font-black uppercase tracking-wider whitespace-nowrap ${activeCategory===c.value ? "bg-[var(--brand-orange)]/10 text-[var(--brand-orange)]" : "bg-tertiary text-slate-500 hover:bg-white/5"}`}>{c.label}</button>
            ))}
          </div>
          <div className="relative flex-1 max-w-xs ml-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="w-full pl-9 pr-3 py-2 bg-tertiary border border-[var(--border-primary)] rounded-xl text-[10px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]" />
          </div>
        </div>

        {/* Document Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.length === 0 ? (
            <div className="col-span-full text-center py-16"><FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" /><p className="text-sm text-slate-500">No documents</p></div>
          ) : (
            filtered.map((doc) => (
              <div key={doc.id} onClick={() => loadDetail(doc.id)} className="p-4 rounded-2xl bg-tertiary border border-[var(--border-primary)] cursor-pointer hover:border-[var(--brand-orange)]/30 transition-all">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--brand-orange)]/10 flex items-center justify-center shrink-0"><FileText className="w-5 h-5 text-[var(--brand-orange)]" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-[var(--text-primary)] truncate">{doc.title}</p>
                    <p className="text-[8px] text-slate-500 mt-0.5 capitalize">{doc.category?.replace(/_/g, " ")}</p>
                    <div className="flex items-center gap-2 mt-1.5 text-[7px] text-slate-500">
                      {doc.file_size && <span>{(doc.file_size/1024).toFixed(0)} KB</span>}
                      <span>v{doc.current_version||1}</span>
                      {doc.is_pitch_deck && <span className="text-[var(--brand-orange)]">Pitch</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Upload Modal ── */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-3xl p-8 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-[var(--text-primary)]">Upload Document</h2>
              <button onClick={() => setShowUploadModal(false)} className="p-2 hover:bg-white/5 rounded-lg"><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Title *</label>
                <input value={uForm.title} onChange={(e) => setUForm((p) => ({ ...p, title: e.target.value }))} className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Category</label>
                  <select value={uForm.category} onChange={(e) => setUForm((p) => ({ ...p, category: e.target.value, is_pitch_deck: e.target.value === "pitch_deck" }))} className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none">
                    {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">File URL *</label>
                  <input value={uForm.file_url} onChange={(e) => setUForm((p) => ({ ...p, file_url: e.target.value }))} placeholder="https://..." className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none" />
                </div>
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Description</label>
                <textarea value={uForm.description} onChange={(e) => setUForm((p) => ({ ...p, description: e.target.value }))} rows={2} className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none resize-none" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowUploadModal(false)} className="flex-1 py-3 rounded-xl border border-[var(--border-primary)] text-[9px] font-black uppercase tracking-widest hover:bg-tertiary">Cancel</button>
              <button onClick={handleUpload} disabled={saving} className="flex-1 py-3 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 disabled:opacity-30 flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Upload
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Document Detail Drawer ── */}
      {showDetail && selectedDoc && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowDetail(false)} />
          <div className="relative w-full max-w-lg bg-[var(--bg-tertiary)] border-l border-[var(--border-primary)] overflow-y-auto">
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-[var(--brand-orange)]" />
                  <h2 className="text-sm font-black text-[var(--text-primary)]">{selectedDoc.title}</h2>
                </div>
                <button onClick={() => setShowDetail(false)} className="p-2 hover:bg-white/5 rounded-lg"><X className="w-4 h-4 text-slate-500" /></button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-[10px]">
                <div className="p-3 bg-primary rounded-xl"><p className="text-[7px] font-black text-slate-500 uppercase">Type</p><p className="font-bold mt-0.5 capitalize">{selectedDoc.category?.replace(/_/g, " ")}</p></div>
                <div className="p-3 bg-primary rounded-xl"><p className="text-[7px] font-black text-slate-500 uppercase">Version</p><p className="font-bold mt-0.5">{selectedDoc.current_version||1}</p></div>
                {selectedDoc.file_size && <div className="p-3 bg-primary rounded-xl"><p className="text-[7px] font-black text-slate-500 uppercase">Size</p><p className="font-bold mt-0.5">{(selectedDoc.file_size/1024).toFixed(0)} KB</p></div>}
                <div className="p-3 bg-primary rounded-xl"><p className="text-[7px] font-black text-slate-500 uppercase">Uploaded</p><p className="font-bold mt-0.5">{new Date(selectedDoc.created_at).toLocaleDateString()}</p></div>
              </div>

              {selectedDoc.description && <p className="text-xs text-[var(--text-secondary)]">{selectedDoc.description}</p>}

              {/* Actions */}
              <div className="flex gap-2">
                <a href={selectedDoc.file_url} target="_blank" className="flex-1 py-2.5 bg-[var(--brand-orange)]/10 text-[var(--brand-orange)] rounded-xl text-[8px] font-black uppercase tracking-wider hover:brightness-110 flex items-center justify-center gap-1.5"><Eye className="w-3 h-3" /> View</a>
                <button onClick={() => { setShowShareModal(true); }} className="flex-1 py-2.5 bg-blue-500/10 text-blue-400 rounded-xl text-[8px] font-black uppercase tracking-wider hover:brightness-110 flex items-center justify-center gap-1.5"><Share2 className="w-3 h-3" /> Share</button>
                <button onClick={() => handleDelete(selectedDoc.id)} className="flex-1 py-2.5 bg-rose-500/10 text-rose-400 rounded-xl text-[8px] font-black uppercase tracking-wider hover:brightness-110 flex items-center justify-center gap-1.5"><Trash2 className="w-3 h-3" /> Delete</button>
              </div>

              {/* Versions */}
              {(selectedDoc.versions||[]).length > 0 && (
                <div>
                  <p className="text-[9px] font-black text-slate-500 uppercase mb-2 flex items-center gap-1.5"><History className="w-3 h-3" /> Versions</p>
                  <div className="space-y-1">
                    {selectedDoc.versions.map((v) => (
                      <div key={v.id} className="flex items-center justify-between p-2 bg-primary rounded-lg border border-[var(--border-primary)]">
                        <span className="text-[9px] font-bold">v{v.version}</span>
                        <span className="text-[8px] text-slate-500">{new Date(v.created_at).toLocaleDateString()}</span>
                        <a href={v.file_url} className="text-[var(--brand-orange)]"><Download className="w-3 h-3" /></a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Shares */}
              {shares.length > 0 && (
                <div>
                  <p className="text-[9px] font-black text-slate-500 uppercase mb-2 flex items-center gap-1.5"><Share2 className="w-3 h-3" /> Shared Links</p>
                  {shares.map((s) => (
                    <div key={s.id} className="flex items-center justify-between p-2 bg-primary rounded-lg mb-1">
                      <div>
                        <span className="text-[8px] font-bold">{s.shared_with_email || "Anyone with link"}</span>
                        <span className="text-[7px] text-slate-500 ml-2">{s.access_type} · {s.download_count||0} downloads</span>
                        {s.expires_at && <span className="text-[7px] text-rose-400 ml-1">Expires {new Date(s.expires_at).toLocaleDateString()}</span>}
                      </div>
                      {!s.is_revoked && <button onClick={() => handleRevoke(s.id)} className="text-[7px] font-black text-rose-400 uppercase hover:underline">Revoke</button>}
                    </div>
                  ))}
                </div>
              )}

              {/* Access Logs */}
              {accessLogs.length > 0 && (
                <div>
                  <p className="text-[9px] font-black text-slate-500 uppercase mb-2 flex items-center gap-1.5"><Eye className="w-3 h-3" /> Access Logs</p>
                  {accessLogs.slice(0, 5).map((l) => (
                    <div key={l.id} className="flex items-center gap-2 p-2 bg-primary rounded-lg mb-1 text-[8px]">
                      <span className="font-bold capitalize">{l.access_type}</span>
                      <span className="text-slate-500">{l.viewer_name || l.viewer_email || "Anonymous"}</span>
                      <span className="text-slate-500 ml-auto">{new Date(l.created_at).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Share Modal ── */}
      {showShareModal && selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-3xl p-8 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-[var(--text-primary)]">Share Document</h2>
              <button onClick={() => setShowShareModal(false)} className="p-2 hover:bg-white/5 rounded-lg"><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            <p className="text-[10px] text-slate-500">Create a secure sharing link for <strong>{selectedDoc.title}</strong></p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Email (optional)</label>
                  <input value={shareForm.email} onChange={(e) => setShareForm((p) => ({ ...p, email: e.target.value }))} placeholder="investor@example.com" className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Name (optional)</label>
                  <input value={shareForm.name} onChange={(e) => setShareForm((p) => ({ ...p, name: e.target.value }))} placeholder="Investor name" className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Access Type</label>
                  <select value={shareForm.access_type} onChange={(e) => setShareForm((p) => ({ ...p, access_type: e.target.value }))} className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none">
                    <option value="read">Read Only</option><option value="download">Download</option><option value="full">Full Access</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Expires In</label>
                  <select value={shareForm.expires_in_hours} onChange={(e) => setShareForm((p) => ({ ...p, expires_in_hours: e.target.value }))} className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none">
                    <option value="24">24 hours</option><option value="72">3 days</option><option value="168">7 days</option><option value="720">30 days</option><option value="">Never</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowShareModal(false)} className="flex-1 py-3 rounded-xl border border-[var(--border-primary)] text-[9px] font-black uppercase tracking-widest hover:bg-tertiary">Cancel</button>
              <button onClick={handleShare} disabled={saving} className="flex-1 py-3 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 disabled:opacity-30 flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <LinkIcon className="w-4 h-4" />} Generate Link
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

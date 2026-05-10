'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Library, Upload, Eye, FileText, Plus, X, 
  BookOpen, Clock, Loader2, Trash2, Edit3, 
  Archive, RotateCcw, Search, Paperclip, ChevronRight, 
  ExternalLink, Shield, Download, FileCheck, Files, CheckCircle2, AlertCircle
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { CardSkeleton, TableSkeleton } from '@/components/ui/Skeleton';
import { uploadFile } from '@/lib/storage';

/**
 * IMPACTOS KNOWLEDGE BANK — OPERATIONAL INTELLIGENCE
 * Centralized repository with High-Visibility Feedback & Error Handling.
 */

export default function KnowledgeBank() {
  const [allNotes, setAllNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewingNote, setViewingNote] = useState(null);
  const [activeFileUrl, setActiveFileUrl] = useState(null);
  const [activeTab, setLibraryTab] = useState('active'); 
  
  // Modals & Feedback
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [notification, setNotification] = useState(null); // { type: 'success' | 'error', message: '' }
  
  // Forms
  const [newNote, setNewNote] = useState({ title: '', description: '', stagedFiles: [] });
  const [editingNote, setEditingNote] = useState(null);

  const notify = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/knowledge');
      const data = await res.json();
      if (data.success) {
        setAllNotes(data.conceptNotes || []);
      }
    } catch (e) {
      console.error("Sync Error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  useEffect(() => {
    if (viewingNote?.files?.length > 0) {
      setActiveFileUrl(viewingNote.files[0].url);
    } else {
      setActiveFileUrl(null);
    }
  }, [viewingNote]);

  const handleFileSelection = (e) => {
    const files = Array.from(e.target.files);
    const pdfs = files.filter(f => f.type === 'application/pdf');
    if (pdfs.length === 0) {
      notify('error', 'Please select PDF files only.');
      return;
    }
    setNewNote(prev => ({ ...prev, stagedFiles: [...(prev.stagedFiles || []), ...pdfs] }));
    e.target.value = '';
  };

  const handleCreateNote = async () => {
    if (!newNote.title) {
      notify('error', 'Mission Title is required.');
      return;
    }
    if (newNote.stagedFiles.length === 0) {
      notify('error', 'At least one PDF must be staged.');
      return;
    }

    setIsSaving(true);
    try {
      // 1. Bulk Upload to Supabase
      const uploadedFiles = [];
      for (const file of newNote.stagedFiles) {
        const path = `knowledge/${Date.now()}_${file.name}`;
        const result = await uploadFile('knowledge', path, file);
        if (result.success) {
          uploadedFiles.push({ name: file.name, url: result.url });
        } else {
          throw new Error(`Upload failed for ${file.name}: ${result.error}`);
        }
      }

      // 2. Final Database Commit
      const res = await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newNote, files: uploadedFiles })
      });
      
      const data = await res.json();
      if (data.success) {
        notify('success', 'Operational Node Deployed Successfully.');
        fetchNotes();
        setShowUploadModal(false);
        setNewNote({ title: '', description: '', stagedFiles: [] });
      } else {
        throw new Error(data.error || "System Database Exception");
      }
    } catch (e) {
      console.error("Deployment Error:", e);
      notify('error', e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateNote = async () => {
    if (!editingNote.title) return;
    setIsSaving(true);
    try {
      // 1. Upload newly staged files if any
      const newlyUploaded = [];
      if (editingNote.stagedFiles?.length > 0) {
        for (const file of editingNote.stagedFiles) {
          const path = `knowledge/${Date.now()}_${file.name}`;
          const result = await uploadFile('knowledge', path, file);
          if (result.success) {
            newlyUploaded.push({ name: file.name, url: result.url });
          }
        }
      }

      // 2. Commit text and file updates
      const res = await fetch('/api/knowledge', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'edit', 
          id: editingNote.id, 
          title: editingNote.title, 
          description: editingNote.description,
          files: newlyUploaded 
        })
      });
      
      if (res.ok) {
        notify('success', 'Node and assets updated successfully.');
        setEditingNote(null);
        fetchNotes();
      }
    } catch (e) {
      notify('error', 'Failed to update node.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchiveToggle = async (id, currentArchiveState) => {
    try {
      const res = await fetch('/api/knowledge', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'archive', id, is_archived: !currentArchiveState })
      });
      if (res.ok) {
        notify('success', currentArchiveState ? 'Node restored from archive.' : 'Node moved to archive.');
        if (viewingNote?.id === id) setViewingNote(null);
        fetchNotes();
      }
    } catch (e) {
      notify('error', 'Sync failure.');
    }
  };

  const handleDeleteNote = async (id) => {
    if (!confirm("CRITICAL: This will permanently delete the operational node. Proceed?")) return;
    try {
      const res = await fetch('/api/knowledge', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        notify('success', 'Node decommissioned permanently.');
        if (viewingNote?.id === id) setViewingNote(null);
        fetchNotes();
      }
    } catch (e) {
      notify('error', 'Deletion failed.');
    }
  };

  const filteredNotes = allNotes.filter(n => {
    const matchesTab = activeTab === 'archive' ? !!n.is_archived : !n.is_archived;
    const matchesSearch = n.title.toLowerCase().includes(search.toLowerCase());
    return matchesTab && matchesSearch;
  });

  return (
    <DashboardLayout role="super_admin" activeTab="knowledge">
      
      {/* GLOBAL NOTIFICATION TOAST */}
      {notification && (
        <div className="fixed top-10 right-10 z-[1000] animate-in slide-in-from-right-10">
          <div className={`flex items-center gap-4 p-5 rounded-2xl border shadow-2xl backdrop-blur-xl ${notification.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'}`}>
            {notification.type === 'success' ? <CheckCircle2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest leading-none mb-1">{notification.type.toUpperCase()}</p>
              <p className="text-xs font-bold text-white/90">{notification.message}</p>
            </div>
            <button onClick={() => setNotification(null)} className="ml-4 opacity-40 hover:opacity-100 transition-opacity"><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      <div className="space-y-10 pb-20 animate-in text-left">
        
        {/* HEADER */}
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 border-b border-[var(--border-primary)] pb-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Library className="w-4 h-4 text-[var(--brand-orange)]" />
              <span className="text-[10px] font-bold text-[var(--brand-orange)] uppercase tracking-[0.4em]">Operational Intelligence</span>
            </div>
            <h1 className="text-5xl font-bold tracking-tight text-[var(--text-primary)] uppercase">Knowledge Bank</h1>
          </div>
          
          <div className="flex gap-3">
             <button 
                onClick={() => setLibraryTab(activeTab === 'active' ? 'archive' : 'active')}
                className={`btn btn-secondary gap-2 ${activeTab === 'archive' ? 'border-[var(--brand-orange)] text-[var(--brand-orange)]' : ''}`}
             >
                <Archive className="w-4 h-4" /> {activeTab === 'archive' ? 'Active Records' : 'Archive'}
             </button>
             <button onClick={() => setShowUploadModal(true)} className="btn btn-primary gap-2">
               <Plus className="w-4 h-4" /> Create New Node
             </button>
          </div>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          <div className="xl:col-span-3">
             {viewingNote ? (
                <div className="space-y-6">
                   <div className="flex justify-between items-center bg-[var(--bg-secondary)] p-6 rounded-2xl border border-[var(--border-primary)]">
                      <div className="flex items-center gap-4">
                         <BookOpen className="w-6 h-6 text-[var(--brand-orange)]" />
                         <div>
                            <h2 className="text-xl font-bold text-white uppercase">{viewingNote.title}</h2>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">{viewingNote.description}</p>
                         </div>
                      </div>
                      <div className="flex gap-2">
                         <button onClick={() => {
                            setEditingNote({ ...viewingNote, stagedFiles: [] });
                         }} className="p-2 hover:text-[var(--brand-orange)] transition-colors"><Edit3 className="w-5 h-5" /></button>
                         <button onClick={() => handleArchiveToggle(viewingNote.id, viewingNote.is_archived)} className="p-2 hover:text-orange-500 transition-colors">{viewingNote.is_archived ? <RotateCcw className="w-5 h-5" /> : <Archive className="w-5 h-5" />}</button>
                         <button onClick={() => handleDeleteNote(viewingNote.id)} className="p-2 hover:text-rose-500 transition-colors"><Trash2 className="w-5 h-5" /></button>
                         <div className="w-px h-6 bg-[var(--border-primary)] mx-2 self-center" />
                         <button onClick={() => setViewingNote(null)} className="p-2"><X className="w-6 h-6" /></button>
                      </div>
                   </div>
                   <div className="card !p-0 h-[800px] overflow-hidden rounded-3xl border-[var(--border-primary)]">
                      <iframe src={`${activeFileUrl}#toolbar=0`} className="w-full h-full" title="Viewer" />
                   </div>
                </div>
             ) : (
                <div className="card py-40 flex flex-col items-center justify-center text-center opacity-40 border-dashed">
                   <BookOpen className="w-16 h-16 mb-4" />
                   <h3 className="text-xl font-bold uppercase">Select an Operational Node</h3>
                </div>
             )}
          </div>

          <div className="xl:col-span-1 space-y-6">
             <div className="card space-y-4">
                <div className="relative">
                   <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                   <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter library..." className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl py-3 pl-10 text-xs font-bold" />
                </div>
                <div className="space-y-3">
                   {loading ? <TableSkeleton rows={5} /> : filteredNotes.length === 0 ? (
                      <div className="text-center py-10 opacity-40">
                         <Library className="w-8 h-8 mx-auto mb-2" />
                         <p className="text-[10px] font-bold uppercase">Library Empty</p>
                      </div>
                   ) : filteredNotes.map(n => (
                      <div key={n.id} onClick={() => setViewingNote(n)} className={`p-4 rounded-xl border transition-all cursor-pointer ${viewingNote?.id === n.id ? 'border-[var(--brand-orange)] bg-[var(--brand-orange)]/10' : 'border-[var(--border-primary)] bg-[var(--bg-primary)] hover:border-[var(--brand-orange)]'}`}>
                         <div className="flex justify-between items-start gap-2">
                            <p className="text-[11px] font-bold text-white uppercase truncate flex-1">{n.title}</p>
                            {n.is_archived && <span className="text-[8px] font-bold text-orange-500 bg-orange-500/10 px-1.5 py-0.5 rounded">ARCHIVE</span>}
                         </div>
                         <p className="text-[9px] text-slate-500 line-clamp-1 mt-1">{n.description}</p>
                      </div>
                   ))}
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* CREATE MODAL */}
      {showUploadModal && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
          <div className="card w-full max-w-xl space-y-8 border-[var(--brand-orange)]/30 animate-in text-left">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-[var(--text-primary)] uppercase tracking-tight">New Knowledge Node</h3>
                <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mt-1">Operational Intelligence Deployment</p>
              </div>
              <button onClick={() => setShowUploadModal(false)} className="p-2 hover:bg-[var(--bg-primary)] rounded-lg"><X className="w-6 h-6" /></button>
            </div>
            
            <div className="space-y-6">
              <input value={newNote.title} onChange={e => setNewNote({...newNote, title: e.target.value})} placeholder="Node Title" className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl p-4 font-bold text-white outline-none focus:border-[var(--brand-orange)]" />
              <textarea value={newNote.description} onChange={e => setNewNote({...newNote, description: e.target.value})} placeholder="Strategic Description..." rows={3} className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl p-4 font-bold text-white outline-none focus:border-[var(--brand-orange)] resize-none" />

              <div className="space-y-4">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-2">Asset Staging Area ({newNote.stagedFiles.length})</label>
                <div className="grid grid-cols-1 gap-3">
                  {newNote.stagedFiles.map((f, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                      <div className="flex items-center gap-3">
                        <FileCheck className="w-4 h-4 text-emerald-500" />
                        <span className="text-[10px] font-bold text-white uppercase truncate max-w-[200px]">{f.name}</span>
                      </div>
                      <button onClick={() => setNewNote(n => ({ ...n, stagedFiles: n.stagedFiles.filter((_, idx) => idx !== i) }))} className="text-rose-500 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
                    </div>
                  ))}
                  <label className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-[var(--border-primary)] rounded-2xl cursor-pointer hover:border-[var(--brand-orange)] transition-all">
                    <input type="file" accept=".pdf" multiple className="hidden" onChange={handleFileSelection} disabled={isSaving} />
                    <Files className="w-6 h-6 mb-2 text-[var(--brand-orange)]" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Stage PDFs</span>
                  </label>
                </div>
              </div>

              <button onClick={handleCreateNote} disabled={isSaving || !newNote.title} className="btn btn-primary w-full py-5 uppercase font-bold tracking-[0.2em]">
                {isSaving ? <div className="flex items-center justify-center gap-3"><Loader2 className="w-5 h-5 animate-spin" /> <span>Deploying to Supabase...</span></div> : 'Deploy Operational Node'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}      {editingNote && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
          <div className="card w-full max-w-xl space-y-8 border-[var(--brand-orange)]/30 animate-in text-left max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-[var(--text-primary)] uppercase tracking-tight italic">Edit Intelligence Node</h3>
                <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mt-1">Operational ID: {editingNote.id}</p>
              </div>
              <button onClick={() => setEditingNote(null)} className="p-2 hover:bg-[var(--bg-primary)] rounded-lg text-slate-500"><X className="w-6 h-6" /></button>
            </div>
            
            <div className="space-y-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] ml-2">Mission Title</label>
                <input value={editingNote.title} onChange={e => setEditingNote({...editingNote, title: e.target.value})} className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl p-4 font-bold text-white outline-none focus:border-[var(--brand-orange)]" />
              </div>
              
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] ml-2">Strategic Description</label>
                <textarea value={editingNote.description} onChange={e => setEditingNote({...editingNote, description: e.target.value})} rows={3} className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl p-4 font-bold text-white outline-none focus:border-[var(--brand-orange)] resize-none" />
              </div>

              {/* EXISTING FILES */}
              {editingNote.files?.length > 0 && (
                <div className="space-y-2">
                   <label className="text-[10px] font-black uppercase tracking-widest text-emerald-500 ml-2">Existing Resources</label>
                   <div className="space-y-2">
                      {editingNote.files.map(f => (
                        <div key={f.id} className="flex items-center justify-between p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                          <div className="flex items-center gap-3">
                            <FileCheck className="w-4 h-4 text-emerald-500" />
                            <span className="text-[10px] font-bold text-white uppercase truncate max-w-[250px]">{f.name}</span>
                          </div>
                          <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-2 py-1 rounded">Active</span>
                        </div>
                      ))}
                   </div>
                </div>
              )}

              {/* NEW ASSET STAGING */}
              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--brand-orange)] ml-2">Stage New Resources ({editingNote.stagedFiles?.length || 0})</label>
                <div className="grid grid-cols-1 gap-3">
                  {(editingNote.stagedFiles || []).map((f, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-[var(--brand-orange)]/5 border border-[var(--brand-orange)]/20 rounded-xl">
                      <div className="flex items-center gap-3">
                        <Upload className="w-4 h-4 text-[var(--brand-orange)]" />
                        <span className="text-[10px] font-bold text-white uppercase truncate max-w-[250px]">{f.name}</span>
                      </div>
                      <button onClick={() => setEditingNote(n => ({ ...n, stagedFiles: n.stagedFiles.filter((_, idx) => idx !== i) }))} className="text-rose-500 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
                    </div>
                  ))}
                  <label className="flex flex-col items-center justify-center py-8 border-2 border-dashed border-[var(--border-primary)] rounded-2xl cursor-pointer hover:border-[var(--brand-orange)] transition-all">
                    <input 
                      type="file" 
                      accept=".pdf" 
                      multiple 
                      className="hidden" 
                      onChange={(e) => {
                        const files = Array.from(e.target.files).filter(f => f.type === 'application/pdf');
                        setEditingNote(prev => ({ ...prev, stagedFiles: [...(prev.stagedFiles || []), ...files] }));
                        e.target.value = '';
                      }} 
                      disabled={isSaving} 
                    />
                    <Paperclip className="w-6 h-6 mb-2 text-[var(--brand-orange)]" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Attach PDF Resources</span>
                  </label>
                </div>
              </div>

              <button onClick={handleUpdateNote} disabled={isSaving || !editingNote.title} className="btn btn-primary w-full py-5 uppercase font-bold tracking-[0.2em] italic shadow-xl shadow-orange-500/20">
                {isSaving ? <div className="flex items-center justify-center gap-3"><Loader2 className="w-5 h-5 animate-spin" /> <span>Syncing Intelligence Node...</span></div> : 'Update Intelligence Node'}
              </button>
            </div>
          </div>
        </div>
      )}


    </DashboardLayout>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import { 
  Library, Upload, Eye, FileText, Plus, X, 
  BookOpen, Clock, Loader2, Trash2, Edit3, 
  Archive, RotateCcw, Search, Paperclip, ChevronRight 
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * KNOWLEDGE BANK
 * Simplified Operational Node.
 */
export default function KnowledgeBank() {
  const [allNotes, setAllNotes] = useState([]);
  const [viewingNote, setViewingNote] = useState(null);
  const [activeFileUrl, setActiveFileUrl] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [activeTab, setLibraryTab] = useState('active'); // active | archive
  
  // Modal State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Forms
  const [newNote, setNewNote] = useState({ title: '', description: '', files: [] });
  const [editingNote, setEditingNote] = useState(null);

  useEffect(() => {
     fetchNotes();
  }, []);

  useEffect(() => {
     if (viewingNote && viewingNote.files && viewingNote.files.length > 0) {
        setActiveFileUrl(viewingNote.files[0].url);
     } else {
        setActiveFileUrl(null);
     }
  }, [viewingNote]);

  // Handle Blob URL generation for reliable preview
  useEffect(() => {
    if (!activeFileUrl) {
      setPreviewUrl(null);
      return;
    }

    // If it's already an external URL, just use it
    if (!activeFileUrl.startsWith('data:')) {
      setPreviewUrl(activeFileUrl);
      return;
    }

    try {
      const parts = activeFileUrl.split(',');
      const byteString = atob(parts[1]);
      const mimeString = parts[0].split(':')[1].split(';')[0];
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: mimeString });
      const objectUrl = URL.createObjectURL(blob);
      setPreviewUrl(objectUrl);

      return () => URL.revokeObjectURL(objectUrl);
    } catch (e) {
      console.error("PDF Preview generation failed:", e);
      setPreviewUrl(activeFileUrl);
    }
  }, [activeFileUrl]);

  const fetchNotes = async () => {
     try {
        const res = await fetch('/api/v2/knowledge');
        const data = await res.json();
        if (data.success) {
           setAllNotes(data.conceptNotes || []);
        }
     } catch (e) {}
  };

  const handleFileUpload = (e, isEditing = false) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
       if (file.type === 'application/pdf') {
          if (file.size > 8 * 1024 * 1024) { // Individual file limit 8MB
             window.dispatchEvent(new CustomEvent('impactos:notify', { 
                 detail: { type: 'error', message: `File '${file.name}' is too large (>8MB).` } 
             }));
             return;
          }

          const reader = new FileReader();
          reader.onload = (event) => {
             const fileObj = { 
                name: file.name, 
                url: event.target.result, // Keep for preview
                file: file, // Keep raw file for upload
                size: (file.size / 1024 / 1024).toFixed(2) + ' MB'
             };
             if (isEditing) {
                setEditingNote(prev => ({ ...prev, files: [...prev.files, fileObj] }));
             } else {
                setNewNote(prev => ({ ...prev, files: [...prev.files, fileObj] }));
             }
          };
          reader.readAsDataURL(file);
       }
    });
  };

  const removeFile = (index, isEditing = false) => {
     if (isEditing) {
        setEditingNote(prev => ({ ...prev, files: prev.files.filter((_, i) => i !== index) }));
     } else {
        setNewNote(prev => ({ ...prev, files: prev.files.filter((_, i) => i !== index) }));
     }
  };

  const handleCreateNote = async () => {
     if (!newNote.title || newNote.files.length === 0) {
        alert("Title and at least one PDF are required.");
        return;
     }

     setIsSaving(true);
     try {
        const formData = new FormData();
        formData.append('title', newNote.title);
        formData.append('description', newNote.description);
        
        newNote.files.forEach((f, i) => {
           if (f.file) {
              formData.append(`file_${i}`, f.file);
           }
        });

        const res = await fetch('/api/v2/knowledge', {
           method: 'POST',
           body: formData
        });
        
        if (res.status === 413) {
           throw new Error("The combined size of your files exceeds the Vercel server limit (4.5MB - 10MB). Please use fewer or smaller files.");
        }

        const data = await res.json();
        if (data.success) {
           await fetchNotes();
           setShowUploadModal(false);
           setNewNote({ title: '', description: '', files: [] });
           window.dispatchEvent(new CustomEvent('impactos:notify', { 
               detail: { type: 'success', message: 'Saved successfully.' } 
           }));
        } else {
           throw new Error(data.error || "Failed to create.");
        }
     } catch (e) {
        window.dispatchEvent(new CustomEvent('impactos:notify', { 
            detail: { type: 'error', message: e.message } 
        }));
     } finally {
        setIsSaving(false);
     }
  };

  const handleSaveUpdate = async () => {
     if (!editingNote.title) return;

     setIsSaving(true);
     try {
        const formData = new FormData();
        formData.append('id', editingNote.id);
        formData.append('title', editingNote.title);
        formData.append('description', editingNote.description);
        formData.append('action', 'edit');
        
        // Pass existing files (that aren't new File objects)
        const existingFiles = editingNote.files.filter(f => !f.file);
        formData.append('existingFiles', JSON.stringify(existingFiles));

        editingNote.files.forEach((f, i) => {
           if (f.file) {
              formData.append(`file_${i}`, f.file);
           }
        });

        const res = await fetch('/api/v2/knowledge', {
           method: 'PATCH',
           body: formData
        });

        if (res.status === 413) {
           throw new Error("The combined size of your files exceeds the Vercel server limit.");
        }

        const data = await res.json();
        if (data.success) {
           await fetchNotes();
           setShowEditModal(false);
           setViewingNote(prev => prev?.id === editingNote.id ? { ...prev, ...editingNote } : prev);
           window.dispatchEvent(new CustomEvent('impactos:notify', { 
               detail: { type: 'success', message: 'Saved successfully.' } 
           }));
        } else {
           throw new Error(data.error || "Failed to save.");
        }
     } catch (e) {
        window.dispatchEvent(new CustomEvent('impactos:notify', { 
            detail: { type: 'error', message: e.message } 
        }));
     } finally {
        setIsSaving(false);
     }
  };

  const handleArchiveAction = async (id, isArchiving, e) => {
     e.stopPropagation();
     try {
        const res = await fetch('/api/v2/knowledge', {
           method: 'PATCH',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ id, is_archived: isArchiving ? 1 : 0, action: 'archive' })
        });
        const data = await res.json();
        if (data.success) {
           fetchNotes();
           if (isArchiving && viewingNote?.id === id) setViewingNote(null);
           window.dispatchEvent(new CustomEvent('impactos:notify', { 
               detail: { type: 'info', message: isArchiving ? 'Archived.' : 'Restored.' } 
           }));
        }
     } catch (e) {}
  };

  const handlePermanentDelete = async (id, e) => {
     e.stopPropagation();
     if (!confirm("Are you sure? This delete is permanent.")) return;

     try {
        const res = await fetch('/api/v2/knowledge', {
           method: 'DELETE',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ id })
        });
        const data = await res.json();
        if (data.success) {
           fetchNotes();
           if (viewingNote?.id === id) setViewingNote(null);
           window.dispatchEvent(new CustomEvent('impactos:notify', { 
               detail: { type: 'success', message: 'Deleted permanently.' } 
           }));
        }
     } catch (e) {}
  };

  const filteredNotes = allNotes.filter(n => activeTab === 'archive' ? n.is_archived : !n.is_archived);

  return (
    <DashboardLayout 
      role="super_admin" 
      activeTab="knowledge"
      modals={
          <AnimatePresence>
             {showUploadModal && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl">
                   <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="ios-card w-full max-w-xl !p-12 space-y-10 border-white/10 overflow-y-auto max-h-[90vh]">
                      <div className="flex justify-between items-start">
                         <div>
                            <h3 className="text-3xl font-black text-white uppercase tracking-tighter">Create New Note</h3>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2 font-sans opacity-60">Add a new document to the library</p>
                         </div>
                         <button onClick={() => setShowUploadModal(false)} className="text-slate-600 hover:text-white transition-colors underline-none"><X className="w-6 h-6" /></button>
                      </div>
                      <div className="space-y-6">
                         <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-sans">Title</label>
                            <input type="text" placeholder="Note Title" value={newNote.title} onChange={e => setNewNote({...newNote, title: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl py-4 px-6 text-white outline-none focus:border-[#FF6600]/30 font-bold" />
                         </div>
                         <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-sans">Description</label>
                            <textarea rows={3} placeholder="About this note..." value={newNote.description} onChange={e => setNewNote({...newNote, description: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl py-4 px-6 text-white outline-none focus:border-[#FF6600]/30 font-bold resize-none" />
                         </div>
                         <div className="space-y-4 pt-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-sans">Attachments</label>
                            <div className="space-y-3">
                               {newNote.files.map((f, idx) => (
                                  <div key={idx} className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-xl">
                                     <div className="flex items-center gap-3">
                                        <FileText className="w-4 h-4 text-[#FF6600]" />
                                        <div className="flex flex-col">
                                           <span className="text-xs font-bold text-white truncate max-w-[200px]">{f.name}</span>
                                           {f.size && <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{f.size}</span>}
                                        </div>
                                     </div>
                                     <button onClick={() => removeFile(idx)} className="text-rose-500 hover:text-white transition-colors underline-none"><X className="w-4 h-4" /></button>
                                  </div>
                               ))}
                               <label className="flex flex-col items-center justify-center py-8 border-2 border-dashed border-white/10 rounded-2xl cursor-pointer hover:border-[#FF6600]/50 hover:bg-[#FF6600]/5 transition-all text-center">
                                  <input type="file" accept=".pdf" multiple className="hidden" onChange={(e) => handleFileUpload(e)} />
                                  <Plus className="w-6 h-6 mb-2 text-[#FF6600]" />
                                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-sans">Add PDF</span>
                               </label>
                            </div>
                         </div>
                      </div>
                       <div className="grid grid-cols-2 gap-4">
                          <button 
                             onClick={() => setShowUploadModal(false)}
                             className="py-5 bg-white/5 text-slate-500 font-black uppercase text-[10px] tracking-widest rounded-2xl hover:bg-white/10 transition-all italic"
                          >
                             Cancel
                          </button>
                          <button 
                            onClick={handleCreateNote} 
                            disabled={isSaving} 
                            className={`btn-strong py-5 rounded-2xl flex items-center justify-center gap-3 transition-all ${isSaving ? 'bg-[#FF6600]/50 cursor-not-allowed text-white/50' : 'bg-[#FF6600] text-white hover:bg-blue-600'}`}
                          >
                             {isSaving ? (
                                <>
                                   <Loader2 className="w-4 h-4 animate-spin text-white" />
                                   <span>Creating...</span>
                                </>
                             ) : <span>Create</span>}
                          </button>
                       </div>
                   </motion.div>
                </div>
             )}

             {showEditModal && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl">
                   <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="ios-card w-full max-w-xl !p-12 space-y-10 border-white/10 overflow-y-auto max-h-[90vh]">
                      <div className="flex justify-between items-start">
                         <div>
                            <h3 className="text-3xl font-black text-white uppercase tracking-tighter">Edit Note</h3>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2 font-sans opacity-60">Update your document information</p>
                         </div>
                         <button onClick={() => setShowEditModal(false)} className="text-slate-600 hover:text-white transition-colors underline-none"><X className="w-6 h-6" /></button>
                      </div>
                      <div className="space-y-6">
                         <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-sans">Title</label>
                            <input type="text" value={editingNote.title} onChange={e => setEditingNote({...editingNote, title: e.target.value})} className="w-full bg-white/10 border border-white/20 rounded-xl py-4 px-6 text-white outline-none focus:border-[#FF6600]/30 font-bold" />
                         </div>
                         <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-sans">Description</label>
                            <textarea rows={3} value={editingNote.description || ''} onChange={e => setEditingNote({...editingNote, description: e.target.value})} className="w-full bg-white/10 border border-white/20 rounded-xl py-4 px-6 text-white outline-none focus:border-[#FF6600]/30 font-bold resize-none" />
                         </div>
                         <div className="space-y-4 pt-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-sans">Attachments</label>
                            <div className="space-y-3">
                               {editingNote.files.map((f, idx) => (
                                  <div key={idx} className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-xl">
                                     <div className="flex items-center gap-3">
                                        <FileText className="w-4 h-4 text-[#FF6600]" />
                                        <div className="flex flex-col">
                                           <span className="text-xs font-bold text-white truncate max-w-[280px]">{f.name}</span>
                                           {f.size && <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{f.size}</span>}
                                        </div>
                                     </div>
                                     <button onClick={() => removeFile(idx, true)} className="text-rose-500 hover:text-white transition-colors underline-none"><X className="w-4 h-4" /></button>
                                  </div>
                               ))}
                               <label className="flex flex-col items-center justify-center py-8 border-2 border-dashed border-white/10 rounded-2xl cursor-pointer hover:border-[#FF6600]/50 hover:bg-[#FF6600]/5 transition-all text-center">
                                  <input type="file" accept=".pdf" multiple className="hidden" onChange={(e) => handleFileUpload(e, true)} />
                                  <Plus className="w-6 h-6 mb-2 text-[#FF6600]" />
                                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-sans">Add PDF</span>
                               </label>
                            </div>
                         </div>
                      </div>
                       <div className="grid grid-cols-2 gap-4">
                          <button 
                             onClick={() => setShowEditModal(false)}
                             className="py-5 bg-white/5 text-slate-500 font-black uppercase text-[10px] tracking-widest rounded-2xl hover:bg-white/10 transition-all italic"
                          >
                             Cancel
                          </button>
                          <button 
                            onClick={handleSaveUpdate} 
                            disabled={isSaving} 
                            className={`btn-strong py-5 rounded-2xl flex items-center justify-center gap-3 transition-all ${isSaving ? 'bg-[#FF6600]/50 cursor-not-allowed text-white/50' : 'bg-[#FF6600] text-white hover:bg-blue-600'}`}
                          >
                             {isSaving ? (
                                <>
                                   <Loader2 className="w-4 h-4 animate-spin text-white" />
                                   <span>Saving...</span>
                                </>
                             ) : <span>Save</span>}
                          </button>
                       </div>
                   </motion.div>
                </div>
             )}
          </AnimatePresence>
      }
    >
      <div className="space-y-12 pb-20">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/5 pb-10">
          <div>
            <div className="flex items-center gap-4 mb-4 text-left">
               <span className="text-[#FF6600] font-black text-[10px] uppercase tracking-[0.4em]">Resource Library</span>
               <div className="h-px w-10 bg-[#FF6600]/30" />
            </div>
            <h2 className="text-5xl font-black text-white tracking-tighter uppercase leading-none italic">Knowledge Bank</h2>
            <p className="text-slate-500 font-bold mt-4 uppercase text-[10px] tracking-widest leading-none font-sans opacity-60">Overview and Management of baseline documents</p>
          </div>
          <button onClick={() => setShowUploadModal(true)} className="px-10 py-4 bg-[#FF6600] text-white rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-blue-600 transition-all shadow-lg shadow-blue-600/20 flex items-center gap-2">
            <Plus className="w-5 h-5" />
            <span>Create New</span>
          </button>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
           <div className="xl:col-span-3 space-y-6">
               <div className="flex justify-between items-end">
                  <div className="flex items-center gap-6">
                     <h3 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3 italic font-sans">
                        <Eye className="w-5 h-5 text-[#FF6600]" /> Viewer
                     </h3>
                     {viewingNote && viewingNote.files && viewingNote.files.length > 1 && (
                        <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
                           {viewingNote.files.map((f, i) => (
                              <button 
                                 key={i} 
                                 onClick={() => setActiveFileUrl(f.url)}
                                 className={`px-4 py-1.5 text-[8px] font-black uppercase tracking-widest rounded-lg transition-all ${activeFileUrl === f.url ? 'bg-[#FF6600] text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                              >
                                 Document {i+1}
                              </button>
                           ))}
                        </div>
                     )}
                  </div>
                  {viewingNote && <button onClick={() => setViewingNote(null)} className="text-[10px] text-[#FF6600] font-black uppercase tracking-widest hover:text-white transition-colors underline-none">Close x</button>}
               </div>
               {!viewingNote && (
                  <div className="ios-card bg-white/[0.01] border-white/5 py-40 flex flex-col items-center justify-center text-center">
                     <BookOpen className="w-20 h-20 text-slate-800 mb-6" />
                     <h4 className="text-2xl font-black text-white uppercase mb-2">Select a Note</h4>
                     <p className="text-slate-500 font-bold text-xs max-w-sm uppercase tracking-widest leading-relaxed font-sans">Choose a document from the library on the right</p>
                  </div>
               )}
                {viewingNote && previewUrl && (
                  <div className="space-y-4">
                     <div className="flex items-center justify-between bg-[#FF6600]/5 p-5 rounded-2xl border border-[#FF6600]/10 text-left">
                        <div className="flex items-center gap-4">
                           <FileText className="w-6 h-6 text-[#FF6600]" />
                           <div>
                              <h4 className="text-white font-black text-lg tracking-tighter uppercase leading-none">{viewingNote.title}</h4>
                              <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-1 italic">{viewingNote.description}</p>
                           </div>
                        </div>
                        <div className="flex items-center gap-2 px-4 py-2 bg-black/40 rounded-xl border border-white/5">
                           <Paperclip className="w-3 h-3 text-[#FF6600]" />
                           <span className="text-[10px] font-black text-white uppercase tracking-tighter truncate max-w-[200px]">
                              {viewingNote.files.find(f => f.url === activeFileUrl)?.name}
                           </span>
                        </div>
                     </div>
                     <div className="ios-card !p-0 overflow-hidden bg-white/5 border border-white/10 relative rounded-[2.5rem] shadow-2xl shadow-black/50">
                        <iframe src={previewUrl} className="w-full h-[800px] border-none bg-white" title="PDF Viewer" />
                     </div>
                  </div>
               )}
           </div>

           <div className="xl:col-span-1 space-y-6">
               <div className="flex flex-col gap-6 mb-6">
                  <div className="flex justify-between items-center">
                     <h3 className="text-xl font-black text-white uppercase tracking-tighter italic font-sans">Library</h3>
                     <span className="text-[8px] bg-white/10 text-slate-400 uppercase font-black px-3 py-1 rounded-full">{filteredNotes.length} Items</span>
                  </div>
                  <div className="flex bg-white/5 p-1 rounded-xl">
                     <button onClick={() => setLibraryTab('active')} className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'active' ? 'bg-[#FF6600] text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>Active</button>
                     <button onClick={() => setLibraryTab('archive')} className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'archive' ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}><Archive className="w-3 h-3" /> Pin</button>
                  </div>
               </div>

               <div className="space-y-4 flex flex-col max-h-[850px] overflow-y-auto pr-2 custom-scrollbar">
                  {filteredNotes.length === 0 ? (
                     <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest italic p-6 border border-white/5 rounded-2xl text-center bg-white/[0.01]">Empty.</p>
                  ) : (
                     filteredNotes.map(note => (
                        <div key={note.id} onClick={() => setViewingNote(note)} className={`p-6 rounded-2xl border transition-all cursor-pointer group flex flex-col gap-4 text-left ${viewingNote?.id === note.id ? 'bg-[#FF6600]/10 border-[#FF6600]/30' : 'bg-white/[0.02] border-white/5 hover:border-white/20 hover:bg-white/5'}`}>
                           <div>
                              <div className="flex justify-between items-start mb-2">
                                 <p className="text-sm font-black text-white leading-tight uppercase relative z-10">{note.title}</p>
                                 <div className="flex items-center gap-1.5 opacity-50">
                                    <Paperclip className="w-3 h-3" />
                                    <span className="text-[10px] font-black text-white">{note.files?.length || 0}</span>
                                 </div>
                              </div>
                              <p className="text-[10px] font-bold text-slate-500 line-clamp-2 uppercase leading-relaxed font-sans">{note.description}</p>
                           </div>
                           <div className="flex justify-between items-end border-t border-white/5 pt-3 mt-auto">
                               <div className="flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-slate-700" />
                                  <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">{note.timestamp?.split(',')[0]}</p>
                               </div>
                               <div className="flex items-center gap-2">
                                  {activeTab === 'active' ? (
                                     <>
                                        <button onClick={(e) => { e.stopPropagation(); setEditingNote(note); setShowEditModal(true); }} className="hover:text-[#FF6600] transition-all opacity-0 group-hover:opacity-100 font-black text-[9px] uppercase tracking-tighter underline-none">Edit</button>
                                        <button onClick={(e) => handleArchiveAction(note.id, true, e)} className="hover:text-orange-500 transition-all opacity-0 group-hover:opacity-100 font-black text-[9px] uppercase tracking-tighter underline-none">Archive</button>
                                     </>
                                  ) : (
                                     <>
                                        <button onClick={(e) => handleArchiveAction(note.id, false, e)} className="hover:text-emerald-500 transition-all font-black text-[9px] uppercase tracking-tighter underline-none">Restore</button>
                                        <button onClick={(e) => handlePermanentDelete(note.id, e)} className="hover:text-rose-500 transition-all font-black text-[9px] uppercase tracking-tighter underline-none">Delete</button>
                                     </>
                                  )}
                                  <ChevronRight className="w-4 h-4 text-slate-700 group-hover:text-[#FF6600] group-hover:translate-x-1 transition-all" />
                               </div>
                            </div>
                         </div>
                     ))
                  )}
               </div>
           </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

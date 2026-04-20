'use client';

import React, { useState, useEffect } from 'react';
import { Library, Upload, Eye, FileText, Plus, X, BookOpen, Clock } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * KNOWLEDGE BANK
 * Repository of Concept Notes (PDFs) that will later be distributed to Project Managers.
 */
export default function KnowledgeBank() {
  const [conceptNotes, setConceptNotes] = useState([]);
  const [viewingNote, setViewingNote] = useState(null);
  
  // Modal State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [newNote, setNewNote] = useState({ title: '', description: '', url: null, fileName: '' });

  useEffect(() => {
     fetchNotes();
  }, []);

  const fetchNotes = async () => {
     try {
        const res = await fetch('/api/v2/knowledge');
        const data = await res.json();
        if (data.success) {
           setConceptNotes(data.conceptNotes || []);
        }
     } catch (e) {}
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
       // Using FileReader or just the raw blob for preview
       const reader = new FileReader();
       reader.onload = (event) => {
          setNewNote({ ...newNote, url: event.target.result, fileName: file.name });
       };
       reader.readAsDataURL(file); // This will persist better than ObjectURL for this demo
    } else {
      alert("Please upload a valid PDF document.");
    }
  };

  const handleSaveConceptNote = async () => {
     if (!newNote.title || !newNote.url) {
        alert("Title and PDF Document are required.");
        return;
     }

     try {
        const res = await fetch('/api/v2/knowledge', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify(newNote)
        });
        const data = await res.json();
        if (data.success) {
           fetchNotes();
           setShowUploadModal(false);
           setNewNote({ title: '', description: '', url: null, fileName: '' });
           window.dispatchEvent(new CustomEvent('impactos:notify', { 
               detail: { type: 'success', message: 'Concept Note Saved Successfully.' } 
           }));
        }
     } catch (e) {
        alert("Persistence failure.");
     }
  };

  return (
    <DashboardLayout 
      role="super_admin" 
      activeTab="knowledge"
      modals={
          <AnimatePresence>
             {showUploadModal && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl">
                   <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="ios-card w-full max-w-xl !p-12 space-y-10 border-white/10"
                   >
                      <div className="flex justify-between items-start">
                         <div>
                            <h3 className="text-3xl font-black text-white uppercase tracking-tighter">Upload Concept Note</h3>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2">Establish a baseline course workflow.</p>
                         </div>
                         <button onClick={() => setShowUploadModal(false)} className="text-slate-600 hover:text-white transition-colors">
                            <X className="w-6 h-6" />
                         </button>
                      </div>
                      
                      <div className="space-y-6">
                         <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest pl-2">Subject / Title</label>
                            <input 
                              type="text" 
                              placeholder="e.g., Introduction to Business"
                              value={newNote.title}
                              onChange={e => setNewNote({...newNote, title: e.target.value})}
                              className="w-full bg-white/5 border border-white/5 rounded-xl py-4 px-6 text-white outline-none focus:border-indigo-500/30 font-bold"
                            />
                         </div>
                         <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest pl-2">Overview / Understanding</label>
                            <textarea 
                              rows={3}
                              placeholder="Brief description of this concept..."
                              value={newNote.description}
                              onChange={e => setNewNote({...newNote, description: e.target.value})}
                              className="w-full bg-white/5 border border-white/5 rounded-xl py-4 px-6 text-white outline-none focus:border-indigo-500/30 font-bold resize-none"
                            />
                         </div>
                         
                         <div className="space-y-2 pt-2">
                            <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest pl-2">PDF Document</label>
                            <label className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-white/10 rounded-2xl cursor-pointer hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all">
                               <input type="file" accept=".pdf" className="hidden" onChange={handleFileUpload} />
                               <FileText className={`w-8 h-8 mb-4 ${newNote.fileName ? 'text-indigo-400' : 'text-slate-700'}`} />
                               <span className="text-sm font-bold text-white mb-1">{newNote.fileName || 'Click to Upload PDF'}</span>
                               <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Max 20MB</span>
                            </label>
                         </div>
                      </div>

                      <button 
                         onClick={handleSaveConceptNote}
                         className="w-full btn-prime !py-5"
                      >
                         Deploy Concept Note
                      </button>
                   </motion.div>
                </div>
             )}
          </AnimatePresence>
      }
    >
      <div className="space-y-12">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/5 pb-10">
          <div>
            <div className="flex items-center gap-4 mb-4">
              <span className="text-indigo-400 font-black text-[10px] uppercase tracking-[0.4em]">Resource Library</span>
              <div className="h-px w-10 bg-indigo-500/30" />
            </div>
            <h2 className="text-5xl font-black text-white tracking-tighter uppercase leading-none">Knowledge Bank</h2>
            <p className="text-slate-500 font-bold mt-4 uppercase text-[10px] tracking-widest">Collection of raw baseline Concept Notes for Program Creation</p>
          </div>

          <button 
            onClick={() => setShowUploadModal(true)}
            className="btn-prime !py-4 px-8 overflow-hidden group relative flex items-center gap-2"
          >
            <Upload className="w-5 h-5 mr-1" />
            <span className="relative z-10">Upload Concept Note</span>
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 opacity-0 group-hover:opacity-20 transition-opacity" />
          </button>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
           
           {/* LEFT COLUMN: ACTIVE VIEWER */}
           <div className="xl:col-span-3 space-y-6">
               <div className="flex justify-between items-end">
                  <h3 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                     <Eye className="w-5 h-5 text-indigo-400" /> 
                     {viewingNote ? 'Live Interaction Panel' : 'Viewer Core'}
                  </h3>
                  {viewingNote && (
                     <button onClick={() => setViewingNote(null)} className="text-[10px] text-indigo-400 font-black uppercase tracking-widest hover:text-white transition-colors">
                        Close Preview x
                     </button>
                  )}
               </div>

               {!viewingNote && (
                  <div className="ios-card bg-white/[0.01] border-white/5 py-40 flex flex-col items-center justify-center text-center">
                     <BookOpen className="w-20 h-20 text-slate-800 mb-6" />
                     <h4 className="text-2xl font-black text-white uppercase mb-2">Awaiting Selection</h4>
                     <p className="text-slate-500 font-bold text-xs max-w-sm uppercase tracking-widest leading-relaxed">
                        Select a concept note from your library on the right to read through its raw materials here.
                     </p>
                  </div>
               )}

               {viewingNote && (
                  <div className="space-y-4">
                     <div className="flex items-center gap-4 bg-indigo-500/10 p-5 rounded-2xl border border-indigo-500/20">
                        <FileText className="w-6 h-6 text-indigo-400" />
                        <div>
                           <h4 className="text-white font-black text-lg tracking-tighter uppercase">{viewingNote.title}</h4>
                           <p className="text-slate-400 font-bold text-xs">{viewingNote.description}</p>
                        </div>
                     </div>
                     <div className="ios-card !p-0 overflow-hidden bg-white/5 border border-white/10 relative rounded-[2rem]">
                        <iframe 
                           src={viewingNote.url + "#toolbar=0"} 
                           className="w-full h-[800px] border-none bg-white rounded-[2rem]"
                           title="PDF Concept Note Viewer"
                        />
                     </div>
                  </div>
               )}
           </div>

           {/* RIGHT COLUMN: CONCEPT NOTES LIBRARY */}
           <div className="xl:col-span-1 space-y-6">
               <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-3">
                     <Library className="w-5 h-5 text-slate-500" />
                     <h3 className="text-xl font-black text-white uppercase tracking-tighter">Library</h3>
                  </div>
                  <span className="text-[10px] bg-white/5 text-slate-400 uppercase font-black px-3 py-1 rounded-full">{conceptNotes.length} Notes</span>
               </div>

               <div className="space-y-4 flex flex-col max-h-[850px] overflow-y-auto pr-2 custom-scrollbar">
                  {conceptNotes.length === 0 ? (
                     <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest italic p-6 border border-white/5 rounded-2xl text-center bg-white/[0.01]">
                        No Concept Notes uploaded yet.
                     </p>
                  ) : (
                     conceptNotes.map(note => (
                        <div 
                           key={note.id}
                           onClick={() => setViewingNote(note)}
                           className={`p-6 rounded-2xl border transition-all cursor-pointer group flex flex-col gap-4 ${viewingNote?.id === note.id ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-white/[0.02] border-white/5 hover:border-white/20 hover:bg-white/5'}`}
                        >
                           <div>
                              <p className="text-sm font-black text-white mb-2 leading-tight uppercase relative z-10">{note.title}</p>
                              <p className="text-[10px] font-bold text-slate-500 line-clamp-2">{note.description}</p>
                           </div>
                           
                           <div className="flex justify-between items-end border-t border-white/5 pt-3 mt-auto">
                              <div className="flex items-center gap-1">
                                 <Clock className="w-3 h-3 text-slate-700" />
                                 <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">{note.timestamp.split(',')[0]}</p>
                              </div>
                              <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest group-hover:underline">Preview →</span>
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

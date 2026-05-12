'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { 
  Zap, ArrowLeft, Shield, User, Users, BookOpen, 
  Plus, X, Loader2, Target, Calendar, Briefcase,
  CheckCircle2, AlertCircle, Info, FileText, Upload, Trash2, File
} from 'lucide-react';
import { uploadFile } from '@/lib/storage';
import { useRouter } from 'next/navigation';

/**
 * IMPACTOS MISSION DEPLOYMENT — STRATEGIC CONFIGURATION
 * Handles program initialization, personnel assignment, and resource linking.
 * Integrated with v2_knowledge_bank and Personnel Registry.
 */

export default function NewProgram() {
  const router = useRouter();
  const [isDeploying, setIsDeploying] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [notification, setNotification] = useState(null);

  // DATA REPOSITORY
  const [knowledgeNodes, setKnowledgeNodes] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loadingAssets, setLoadingAssets] = useState(true);

  // FORM STATE
  const [program, setProgram] = useState({
    name: '',
    description: '',
    note_id: '',
    assigned_pm_id: '',
    assigned_assistant_id: '', // Will store JSON array string
    duration_weeks: 4,
    materials: []
  });

  const [selectedAssistants, setSelectedAssistants] = useState([]);

  const toggleAssistant = (cid) => {
    setSelectedAssistants(prev => {
      const next = prev.includes(cid) ? prev.filter(id => id !== cid) : [...prev, cid];
      setProgram(p => ({ ...p, assigned_assistant_id: JSON.stringify(next) }));
      return next;
    });
  };

  const notify = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  useEffect(() => {
    async function loadAssets() {
      setLoadingAssets(true);
      try {
        const [knowRes, staffRes] = await Promise.all([
          fetch('/api/knowledge'),
          fetch('/api/contacts')
        ]);
        
        const knowData = await knowRes.json();
        const staffData = await staffRes.json();

        if (knowData.success) setKnowledgeNodes(knowData.conceptNotes || []);
        // Filter: Only Future Studio Staff (role='staff' or 'admin')
        if (staffData.success) {
          const staffOnly = (staffData.contacts || []).filter(c => 
            c.role === 'staff' || c.role === 'admin' || c.group_name?.toUpperCase() === 'FUTURE STUDIO'
          );
          setStaffList(staffOnly);
        }
      } catch (e) {
        console.error("Asset Load Failure:", e);
        notify('error', 'Failed to synchronize personnel and knowledge assets.');
      } finally {
        setLoadingAssets(false);
      }
    }
    loadAssets();
  }, []);

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setIsUploading(true);
    try {
      const uploadedUrls = [];
      for (const file of files) {
        const path = `concept-notes/${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
        const res = await uploadFile('knowledge', path, file);
        if (res.success) {
          uploadedUrls.push({
            name: file.name,
            url: res.url,
            type: file.type
          });
        } else {
          throw new Error(`Upload failed for ${file.name}: ${res.error}`);
        }
      }
      setProgram(prev => ({
        ...prev,
        materials: [...prev.materials, ...uploadedUrls]
      }));
      notify('success', `${files.length} file(s) attached successfully.`);
    } catch (e) {
      notify('error', e.message);
    } finally {
      setIsUploading(false);
    }
  };

  const removeMaterial = (index) => {
    setProgram(prev => ({
      ...prev,
      materials: prev.materials.filter((_, i) => i !== index)
    }));
  };

  const handleDeploy = async (e) => {
    e.preventDefault();
    if (!program.name || !program.assigned_pm_id) {
      notify('error', 'Critical Parameters Missing: Mission Name and PM are required.');
      return;
    }

    setIsDeploying(true);
    try {
      const res = await fetch('/api/pm/programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(program)
      });
      const data = await res.json();

      if (data.success) {
        notify('success', 'Program Created Successfully.');
        setTimeout(() => router.push('/admin/programs'), 1500);
      } else {
        throw new Error(data.error || "Failed to save program");
      }
    } catch (e) {
      notify('error', e.message);
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <DashboardLayout role="super_admin" activeTab="programs">
      
      {/* NOTIFICATION TOAST */}
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

      <div className="max-w-4xl mx-auto space-y-12 pb-20 animate-in text-left">
        
        {/* HEADER */}
        <header className="space-y-4 border-b border-[var(--border-primary)] pb-10">
          <button 
             onClick={() => router.push('/admin/programs')}
             className="group flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--brand-orange)] transition-all font-bold text-[9px] uppercase tracking-widest"
          >
             <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" /> Program List
          </button>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-[var(--brand-orange)]" />
              <span className="text-[10px] font-bold text-[var(--brand-orange)] uppercase tracking-[0.4em]">Administration</span>
            </div>
            <h1 className="text-6xl font-black tracking-tighter text-[var(--text-primary)]">NEW PROGRAM</h1>
          </div>
        </header>

        <form onSubmit={handleDeploy} className="space-y-10">
          
          {/* SECTION: BASIC IDENTITY */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-2">Program Identity</label>
              <input 
                required
                value={program.name}
                onChange={e => setProgram({...program, name: e.target.value})}
                placeholder="Ex: Entrepreneurship Bootcamp 2024"
                className="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-2xl p-6 text-lg font-bold text-white outline-none focus:border-[var(--brand-orange)] transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-2">Duration (Weeks)</label>
              <input 
                type="number"
                value={program.duration_weeks}
                onChange={e => setProgram({...program, duration_weeks: parseInt(e.target.value)})}
                className="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-2xl p-6 text-lg font-bold text-white outline-none focus:border-[var(--brand-orange)] transition-all"
              />
            </div>
          </div>

          {/* SECTION: CONCEPT OVERVIEW */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-2">Program Description</label>
            <textarea 
              rows={4}
              value={program.description}
              onChange={e => setProgram({...program, description: e.target.value})}
              placeholder="Outline the program objectives and goals..."
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-2xl p-6 font-medium text-white outline-none focus:border-[var(--brand-orange)] transition-all resize-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* SECTION: KNOWLEDGE BANK INTEGRATION */}
            <div className="card space-y-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-5">
                 <BookOpen className="w-16 h-16" />
              </div>
              <div className="flex items-center gap-3">
                 <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500">
                    <BookOpen className="w-5 h-5" />
                 </div>
                  <h3 className="text-sm font-bold uppercase tracking-tight">Select from Knowledge Base</h3>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                   <label className="text-[8px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-1">Knowledge Node Link</label>
                   <select 
                    value={program.note_id}
                    onChange={e => setProgram({...program, note_id: e.target.value})}
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl p-4 text-xs font-bold text-white outline-none focus:border-[var(--brand-orange)] appearance-none cursor-pointer"
                  >
                    <option value="">Link Knowledge Node...</option>
                    {knowledgeNodes.map(node => (
                      <option key={node.id} value={node.id}>{node.title.toUpperCase()}</option>
                    ))}
                  </select>
                </div>

                <div className="relative group">
                  <input 
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                    onChange={handleFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                    disabled={isUploading}
                  />
                  <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-[var(--border-primary)] rounded-xl group-hover:border-[var(--brand-orange)] transition-all bg-[var(--bg-primary)]/50">
                     {isUploading ? (
                       <Loader2 className="w-6 h-6 text-[var(--brand-orange)] animate-spin mb-2" />
                     ) : (
                       <Upload className="w-6 h-6 text-[var(--text-secondary)] group-hover:text-[var(--brand-orange)] mb-2 transition-all" />
                     )}
                     <p className="text-[9px] font-black uppercase tracking-widest text-white/60 group-hover:text-white transition-all">
                       {isUploading ? 'Uploading Assets...' : 'Attach Program Materials (PDF)'}
                     </p>
                  </div>
                </div>

                {program.materials.length > 0 && (
                  <div className="space-y-2">
                    {program.materials.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                          <p className="text-[10px] font-bold text-emerald-100 truncate uppercase">{file.name}</p>
                        </div>
                        <button 
                          type="button"
                          onClick={() => removeMaterial(idx)}
                          className="p-1 hover:bg-rose-500/20 rounded text-rose-400 transition-all"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* SECTION: COMMAND PERSONNEL */}
            <div className="card space-y-6 relative overflow-hidden">
               <div className="absolute top-0 right-0 p-6 opacity-5">
                 <Shield className="w-16 h-16" />
              </div>
              <div className="flex items-center gap-3">
                 <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                    <Shield className="w-5 h-5" />
                 </div>
                 <h3 className="text-sm font-bold uppercase tracking-tight">Assigned Managers</h3>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                   <label className="text-[8px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-1">PROGRAM MANAGER</label>
                   <select 
                    required
                    value={program.assigned_pm_id}
                    onChange={e => setProgram({...program, assigned_pm_id: e.target.value})}
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl p-4 text-xs font-bold text-white outline-none focus:border-[var(--brand-orange)] cursor-pointer"
                  >
                    <option value="">Select Manager...</option>
                    {staffList.map(staff => (
                      <option key={staff.cid} value={staff.cid}>{staff.name.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
 
                <div className="space-y-3">
                   <label className="text-[8px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-1">ASSIGNED TEAM (Collaborators)</label>
                   <div className="flex flex-wrap gap-2 mb-3">
                     {selectedAssistants.map(cid => {
                       const staff = staffList.find(s => s.cid === cid);
                       return (
                         <div key={cid} className="flex items-center gap-2 px-3 py-1.5 bg-[var(--brand-orange)]/10 border border-[var(--brand-orange)]/20 rounded-lg text-[10px] font-bold text-[var(--brand-orange)]">
                           {staff?.name.toUpperCase()}
                           <button type="button" onClick={() => toggleAssistant(cid)}>
                             <X className="w-3 h-3" />
                           </button>
                         </div>
                       );
                     })}
                   </div>
                   <select 
                    value=""
                    onChange={e => {
                      if (e.target.value) toggleAssistant(e.target.value);
                    }}
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl p-4 text-xs font-bold text-white outline-none focus:border-[var(--brand-orange)] cursor-pointer"
                  >
                    <option value="">Select Support...</option>
                    {staffList.filter(s => !selectedAssistants.includes(s.cid)).map(staff => (
                      <option key={staff.cid} value={staff.cid}>{staff.name.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={isDeploying || loadingAssets}
            className="btn btn-primary w-full py-6 text-sm font-black uppercase tracking-[0.3em] shadow-2xl shadow-orange-500/20"
          >
            {isDeploying ? (
              <div className="flex items-center justify-center gap-4">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span>Saving Program...</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-3">
                <Zap className="w-5 h-5" />
                <span>Save Program</span>
              </div>
            )}
          </button>
        </form>
      </div>
    </DashboardLayout>
  );
}

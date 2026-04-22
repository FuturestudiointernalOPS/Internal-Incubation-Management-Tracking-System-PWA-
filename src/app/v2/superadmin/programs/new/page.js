'use client';
import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Briefcase, Plus, Loader2, ArrowLeft,
  CheckCircle, Shield, AlertTriangle, BookOpen, User, Users
} from 'lucide-react';
import { useRouter } from 'next/navigation';

/**
 * CREATE NEW PROGRAM
 * Allows linking course materials and assigning leadership during creation.
 */
export default function CreateProgram() {
  const [form, setForm] = useState({ 
    name: '', 
    description: '', 
    note_id: '',
    assigned_pm_id: '',
    assigned_assistant_id: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState([]);
  const [staff, setStaff] = useState([]);
  const router = useRouter();

  useEffect(() => {
    fetchMetadata();
  }, []);

  const fetchMetadata = async () => {
    try {
      // Fetch knowledge notes
      const notesRes = await fetch('/api/v2/knowledge');
      const notesData = await notesRes.json();
      if (notesData.success) {
        setNotes((notesData.conceptNotes || []).filter(n => !n.is_archived));
      }

      // Fetch staff (Project Managers / Assistants)
      const staffRes = await fetch('/api/v2/contacts/full-state');
      const staffData = await staffRes.json();
      if (staffData.success) {
        const staffList = (staffData.contacts || []).filter(c => c.group_name?.toUpperCase() === 'STAFF');
        setStaff(staffList);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name) return;

    setLoading(true);
    try {
      const res = await fetch('/api/v2/pm/programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (data.success) {
        window.dispatchEvent(new CustomEvent('impactos:notify', { 
           detail: { type: 'success', message: 'Created successfully.' } 
        }));
        // Small delay for the user to see the success state
        setTimeout(() => {
          router.push('/v2/superadmin/programs');
        }, 1000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      // Keep loading true for a split second longer to prevent flickers
      setTimeout(() => setLoading(false), 200);
    }
  };

  return (
    <DashboardLayout role="super_admin" activeTab="create_program">
      <div className="max-w-4xl mx-auto space-y-12 pb-20">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-slate-500 hover:text-white transition-all group font-black text-[10px] uppercase tracking-widest">
           <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back
        </button>

        <header>
          <div className="flex items-center gap-4 mb-4 text-left">
             <span className="text-[#0066FF] font-black text-[10px] uppercase tracking-[0.4em]">Program Setup</span>
             <div className="h-px w-10 bg-[#0066FF]/30" />
          </div>
          <h2 className="text-5xl font-black text-white tracking-tighter uppercase leading-none italic">Create New Program</h2>
          <p className="text-slate-500 font-bold mt-4 uppercase text-[10px] tracking-widest leading-none font-sans opacity-60">Set up a new educational or operational program</p>
        </header>

        <div className="ios-card bg-white/[0.02] border-white/5 !p-12 space-y-10 relative overflow-hidden">
           <form onSubmit={handleCreate} className="space-y-10 relative z-10">
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2 font-sans">Program Name</label>
                 <input 
                    required
                    type="text" 
                    value={form.name} 
                    onChange={e => setForm({...form, name: e.target.value})}
                    placeholder="e.g. Young Leaders Program 2026"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-5 px-8 text-white text-xl outline-none focus:border-[#0066FF]/50 font-bold transition-all"
                 />
              </div>

              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2 font-sans">About this Program</label>
                 <textarea 
                    rows={4}
                    value={form.description} 
                    onChange={e => setForm({...form, description: e.target.value})}
                    placeholder="Describe what this program is about..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-5 px-8 text-white outline-none focus:border-[#0066FF]/50 font-bold transition-all resize-none"
                 />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2 font-sans flex items-center gap-2">
                       <BookOpen className="w-3 h-3" /> Assign Course Material
                    </label>
                    <select 
                       value={form.note_id} 
                       onChange={e => setForm({...form, note_id: e.target.value})}
                       className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white outline-none focus:border-[#0066FF]/50 appearance-none font-bold italic"
                    >
                       <option value="" className="bg-[#080810]">Select from Knowledge Bank...</option>
                       {notes.map(n => <option key={n.id} value={n.id} className="bg-[#080810]">{n.title}</option>)}
                    </select>
                 </div>

                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2 font-sans flex items-center gap-2">
                       <User className="w-3 h-3" /> Project Manager
                    </label>
                    <select 
                       value={form.assigned_pm_id} 
                       onChange={e => setForm({...form, assigned_pm_id: e.target.value})}
                       className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white outline-none focus:border-[#0066FF]/50 appearance-none font-bold"
                    >
                       <option value="" className="bg-[#080810]">Assign a Lead...</option>
                       {staff.map(s => <option key={s.cid} value={s.cid} className="bg-[#080810]">{s.name}</option>)}
                    </select>
                 </div>

                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2 font-sans flex items-center gap-2">
                       <Users className="w-3 h-3" /> Assistant (Optional)
                    </label>
                    <select 
                       value={form.assigned_assistant_id} 
                       onChange={e => setForm({...form, assigned_assistant_id: e.target.value})}
                       className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white outline-none focus:border-[#0066FF]/50 appearance-none font-bold"
                    >
                       <option value="" className="bg-[#080810]">Assign an Assistant...</option>
                       {staff.map(s => <option key={s.cid} value={s.cid} className="bg-[#080810]">{s.name}</option>)}
                    </select>
                 </div>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full btn-strong !py-5 rounded-2xl flex items-center justify-center gap-4 mt-10 transition-all font-black uppercase tracking-widest"
              >
                 {loading ? (
                   <>
                      <Loader2 className="w-5 h-5 animate-spin" /> Creating Program...
                   </>
                 ) : (
                   <>
                      Create Program <Plus className="w-5 h-5" />
                   </>
                 )}
              </button>
           </form>
        </div>
      </div>
    </DashboardLayout>
  );
}

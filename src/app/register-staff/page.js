'use client';

import React, { useState } from 'react';
import { 
  Users, Mail, Calendar, Phone, 
  Image as ImageIcon, CheckCircle, AlertCircle,
  ArrowRight, UserPlus, MapPin, Briefcase, FileText, UserIcon, Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const BG = '#0a0a1a';
const CARD = 'rgba(255,255,255,0.03)';
const BORDER = 'rgba(99,102,241,0.2)';
const ACCENT = '#818cf8';

export default function PublicApplicationRegistration() {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    gender: 'Male',
    homeAddress: '',
    jobTitle: '',
    jobDescription: '',
    image: '',
    role: 'unassigned'
  });

  const [status, setStatus] = useState({ state: 'idle', message: '' });

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, image: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ state: 'loading', message: '' });
 
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const groupParam = searchParams.get('rid') || searchParams.get('group') || 'unassigned';

      // ENFORCEMENT: Ensure all public registrations are set to pending for Super Admin approval

      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
           ...formData, 
           name: formData.fullName, 
           group_name: groupParam,
           status: 'pending'
        })
      });
  
      const data = await res.json();
  
      if (data.success) {
        setStatus({ 
          state: 'success', 
          message: 'Strategic registration complete! Your account is now awaiting Super Admin approval.'
        });
      } else {
        setStatus({ state: 'error', message: data.error || 'Failed to submit application.' });
      }
    } catch (err) {
      console.error(err);
      setStatus({ state: 'error', message: 'Connection to ImpactOS Registry failed.' });
    }
  };

  if (status.state === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-[#0a0a1a] font-sans">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="card max-w-md text-center p-12 space-y-6 border-[var(--brand-orange)]/20"
        >
          <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
            <CheckCircle className="w-10 h-10 text-emerald-400" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight uppercase">MISSION SECURED</h1>
          <p className="text-sm font-medium text-slate-400 leading-relaxed uppercase tracking-widest">{status.message}</p>
          <div className="pt-6">
             <div className="text-[10px] font-bold text-[var(--brand-orange)] uppercase tracking-[0.3em]">Operational Readiness 100%</div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a1a] text-[#f1f5f9] font-sans py-16 px-6 relative overflow-hidden text-left">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(99,102,241,0.08)_0%,transparent_50%)] pointer-events-none" />

      <div className="max-w-3xl mx-auto relative z-10">
        <header className="text-center mb-16 space-y-4">
          <div className="inline-flex items-center gap-3 bg-indigo-500/10 px-6 py-2 rounded-full border border-indigo-500/20 mb-4">
            <UserPlus className="w-4 h-4 text-[var(--brand-orange)]" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--brand-orange)]">Registry Enrollment</span>
          </div>
          <h1 className="text-6xl font-black tracking-tighter text-white">ONBOARDING</h1>
          <p className="text-slate-400 text-sm font-bold uppercase tracking-widest opacity-60">Provision your operational identity below.</p>
        </header>

        <form onSubmit={handleSubmit} className="card bg-[rgba(255,255,255,0.02)] backdrop-blur-3xl border-[var(--border-primary)] rounded-[3rem] p-10 lg:p-16 space-y-12 shadow-2xl">
          
          <div className="space-y-8">
            <h3 className="text-xs font-black uppercase tracking-[0.4em] text-[var(--brand-orange)] flex items-center gap-3">
               <div className="w-2 h-2 rounded-full bg-[var(--brand-orange)] animate-pulse" />
               Core Intelligence
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <InputGroup label="Full Identity Name" icon={Users} placeholder="Ex: Samuel Adebayo" value={formData.fullName} onChange={v => setFormData({...formData, fullName: v})} required />
              <InputGroup label="Secure Email Channel" icon={Mail} placeholder="name@domain.com" type="email" value={formData.email} onChange={v => setFormData({...formData, email: v})} required />
              <InputGroup label="Communication Frequency" icon={Phone} placeholder="+234..." value={formData.phone} onChange={v => setFormData({...formData, phone: v})} required />
              
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Biological Identity</label>
                <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <select 
                    required
                    value={formData.gender} 
                    onChange={e => setFormData({...formData, gender: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white outline-none focus:border-[var(--brand-orange)] appearance-none font-bold text-xs"
                  >
                    <option value="Male" className="bg-slate-900">MALE</option>
                    <option value="Female" className="bg-slate-900">FEMALE</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <h3 className="text-xs font-black uppercase tracking-[0.4em] text-[var(--brand-orange)] flex items-center gap-3 opacity-60">
               Tactical Metadata
            </h3>
            <div className="space-y-8">
              <InputGroup label="Operational Base (Address)" icon={MapPin} placeholder="Current location..." value={formData.homeAddress} onChange={v => setFormData({...formData, homeAddress: v})} />
              <InputGroup label="Strategic Role" icon={Briefcase} placeholder="Ex: Operations Lead" value={formData.jobTitle} onChange={v => setFormData({...formData, jobTitle: v})} />
            </div>
          </div>

          <AnimatePresence>
            {status.state === 'error' && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-4 text-rose-400"
              >
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-[10px] font-black uppercase tracking-widest">{status.message}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <button 
            type="submit" 
            disabled={status.state === 'loading'}
            className="w-full py-6 rounded-[1.5rem] bg-[var(--brand-orange)] text-black font-black text-xs uppercase tracking-[0.4em] shadow-2xl shadow-orange-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-4 group"
          >
            {status.state === 'loading' ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Syncing with Registry...</span>
              </>
            ) : (
              <>
                Complete Enrollment
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

function InputGroup({ label, placeholder, type = 'text', icon: Icon, value, onChange, required }) {
  return (
    <div className="space-y-3">
      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">{label}</label>
      <div className="relative">
        {Icon && <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />}
        <input 
          type={type} placeholder={placeholder} required={required}
          value={value} onChange={e => onChange(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white outline-none focus:border-[var(--brand-orange)] font-bold text-xs uppercase tracking-tighter"
        />
      </div>
    </div>
  );
}

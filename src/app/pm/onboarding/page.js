'use client';

import React, { useState } from 'react';
import { 
  Users, Briefcase, ChevronRight, ChevronLeft, 
  CheckCircle2, Info, User, Target, Zap, 
  Shield, Mail, Phone, DollarSign, BarChart3,
  Rocket, Award, Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout from '@/components/layout/DashboardLayout';

export default function ParticipantOnboarding() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    startupName: '', category: '', stage: '',
    roi: '', revenue: '', funding: ''
  });

  const nextStep = () => setStep(s => s + 1);
  const prevStep = () => setStep(s => s - 1);

  const steps = [
    { n: 1, label: 'Founder Profile', icon: User },
    { n: 2, label: 'Entity Scope', icon: Briefcase },
    { n: 3, label: 'Financial Matrix', icon: Target },
    { n: 4, label: 'Review & Uplink', icon: CheckCircle2 }
  ];

  return (
    <DashboardLayout role="program_manager">
      <div className="max-w-4xl mx-auto space-y-12 pb-24">
        {/* PROGRESS NAV */}
        <div className="flex items-center justify-between mb-16 relative">
            <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-100 dark:bg-slate-800 -translate-y-1/2 z-0" />
            <motion.div 
               className="absolute top-1/2 left-0 h-1 bg-indigo-600 -translate-y-1/2 z-10 transition-all duration-500"
               style={{ width: `${(step - 1) * 33}%` }}
            />
            {steps.map((s, i) => (
               <div key={i} className="relative z-20 flex flex-col items-center">
                  <div className={cn(
                    "w-14 h-14 rounded-2xl flex-center border-4 border-white dark:border-slate-900 transition-all shadow-xl",
                    step >= s.n ? "bg-indigo-600 text-white" : "bg-white text-slate-300 border-slate-50"
                  )}>
                    <s.icon className="w-6 h-6" />
                  </div>
                  <span className={cn(
                    "text-[10px] font-black uppercase tracking-widest mt-4 leading-none",
                    step >= s.n ? "text-indigo-600" : "text-slate-300"
                  )}>{s.label}</span>
               </div>
            ))}
        </div>

        <motion.div 
          key={step} 
          initial={{ opacity: 0, x: 20 }} 
          animate={{ opacity: 1, x: 0 }}
          className="bg-white dark:bg-slate-900 p-16 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-2xl shadow-indigo-100/50"
        >
          {step === 1 && (
            <div className="space-y-12">
               <div className="space-y-2">
                 <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter uppercase leading-none">Founder Intelligence</h3>
                 <p className="text-slate-500 font-bold text-xs uppercase tracking-widest leading-none">Phase 1: Personal Access Cluster</p>
               </div>
               <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-3">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 leading-none">Legal First Name</label>
                     <input className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-5 px-8 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 placeholder:text-slate-200" placeholder="Ex. Sarah" />
                  </div>
                  <div className="space-y-3">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 leading-none">Legal Last Name</label>
                     <input className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-5 px-8 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 placeholder:text-slate-200" placeholder="Ex. Analyst" />
                  </div>
                  <div className="space-y-3">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 leading-none">Universal Email</label>
                     <input className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-5 px-8 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 placeholder:text-slate-200" placeholder="sarah@impact.com" />
                  </div>
                  <div className="space-y-3">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 leading-none">Uplink Phone</label>
                     <input className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-5 px-8 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 placeholder:text-slate-200" placeholder="+234 ..." />
                  </div>
               </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-12">
               <div className="space-y-2 text-indigo-600">
                 <h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">Entity Definition</h3>
                 <p className="text-slate-500 font-bold text-xs uppercase tracking-widest leading-none">Phase 2: Venture Scope Identification</p>
               </div>
               <div className="space-y-8">
                  <div className="space-y-3">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 leading-none">Startup Registered Name</label>
                     <input className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-5 px-8 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10" placeholder="Ex. VortexAI Labs" />
                  </div>
                  <div className="grid grid-cols-2 gap-8">
                     <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 leading-none">Tech Category</label>
                        <select className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-5 px-8 text-sm font-black text-slate-900 outline-none appearance-none">
                            <option>SaaS / Enterprise AI</option>
                            <option>Fintech Core</option>
                            <option>Agritech Cloud</option>
                            <option>Energy Analytics</option>
                        </select>
                     </div>
                     <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 leading-none">Current Development Stage</label>
                        <select className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-5 px-8 text-sm font-black text-slate-900 outline-none appearance-none">
                            <option>MVP Development</option>
                            <option>Early Traction</option>
                            <option>Growth Scaling</option>
                            <option>Series A Ready</option>
                        </select>
                     </div>
                  </div>
               </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-12">
               <div className="space-y-2 text-emerald-600">
                 <h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">Financial Matrix</h3>
                 <p className="text-slate-500 font-bold text-xs uppercase tracking-widest leading-none">Phase 3: Revenue & Funding Telemetry</p>
               </div>
               <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-3">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 leading-none">Current AMR / Revenue</label>
                     <div className="relative">
                        <input className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-5 pl-14 pr-8 text-sm font-bold text-slate-900 outline-none focus:ring-4 focus:ring-emerald-500/10 placeholder:text-slate-200" placeholder="0.00" />
                        <DollarSign className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
                     </div>
                  </div>
                  <div className="space-y-3">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 leading-none">External Capital Raised</label>
                     <div className="relative">
                        <input className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-5 pl-14 pr-8 text-sm font-bold text-slate-900 outline-none focus:ring-4 focus:ring-emerald-500/10 placeholder:text-slate-200" placeholder="0.00" />
                        <Zap className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
                     </div>
                  </div>
               </div>
               <div className="ios-card bg-emerald-50/50 border-emerald-100 border-dashed p-10 flex items-center justify-between">
                  <div className="flex items-center gap-6">
                     <div className="w-16 h-16 rounded-full bg-white flex-center shadow-xl shadow-emerald-100/50">
                        <TrendingUp className="w-8 h-8 text-emerald-600" />
                     </div>
                     <div className="space-y-1">
                        <h5 className="font-extrabold text-slate-800 leading-none mb-1">AI Valuation Bridge</h5>
                        <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest leading-none">Predictive Model Enabled</p>
                     </div>
                  </div>
                  <button className="px-8 py-3 bg-white border border-emerald-100 rounded-xl text-[10px] font-black text-emerald-600 uppercase tracking-widest shadow-lg shadow-emerald-100/30 hover:bg-emerald-600 hover:text-white transition-all">Calculate Delta</button>
               </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-12 text-center py-10">
               <div className="w-32 h-32 rounded-full bg-indigo-50 border-8 border-indigo-100 flex-center mx-auto mb-10 text-indigo-600 shadow-2xl animate-pulse">
                  <Rocket className="w-12 h-12" />
               </div>
               <div className="space-y-4">
                 <h3 className="text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">Ready for Uplink</h3>
                 <p className="text-slate-500 font-bold text-xs uppercase tracking-widest leading-none max-w-sm mx-auto">VortexAI Labs data is calibrated. This action will initialize Phase 1 program cycles and grant founder access.</p>
               </div>
               <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <Award className="w-5 h-5 text-indigo-400 mx-auto mb-2" />
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Compliance Validated</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <Clock className="w-5 h-5 text-indigo-400 mx-auto mb-2" />
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Instant Deployment</p>
                    </div>
               </div>
            </div>
          )}

          <div className="flex items-center justify-between mt-20 pt-12 border-t border-slate-100 dark:border-slate-800">
             <button 
                onClick={prevStep} 
                disabled={step === 1}
                className="flex items-center gap-3 px-8 py-4 text-slate-400 font-black text-xs uppercase tracking-widest hover:text-slate-900 disabled:opacity-0 transition-all"
             >
                <ChevronLeft className="w-4 h-4" /> Shift Back
             </button>
             {step < 4 ? (
                <button 
                   onClick={nextStep}
                   className="flex items-center gap-3 px-10 py-4.5 bg-indigo-600 rounded-2xl text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all"
                >
                   Continue Phase {step + 1} <ChevronRight className="w-4 h-4" />
                </button>
             ) : (
                <button 
                   onClick={() => router.push('/pm/dashboard')}
                   className="flex items-center gap-3 px-12 py-4.5 bg-slate-900 rounded-2xl text-white font-black text-xs uppercase tracking-widest shadow-2xl shadow-slate-300 hover:bg-black active:scale-95 transition-all"
                >
                   Execute Final Onboarding <Shield className="w-4 h-4 ml-2" />
                </button>
             )}
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}

function cn(...inputs) {
  return inputs.filter(Boolean).join(' ');
}

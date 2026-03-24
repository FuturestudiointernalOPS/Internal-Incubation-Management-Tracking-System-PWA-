'use client';
import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react';
export default function PublicFormView() {
  const params = useParams();
  const searchParams = useSearchParams();
  const form_id = params.form_id;
  const cid = searchParams.get('cid');

  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [answers, setAnswers] = useState({});
  const [publicData, setPublicData] = useState({ name: '', email: '', phone: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetchForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form_id]);

  const fetchForm = async () => {
    try {
      const res = await fetch(`/api/forms/${form_id}`);
      const data = await res.json();
      if (data.success) {
        setForm(data.form);
      } else {
        setError(data.error || 'Form not found');
      }
    } catch (err) {
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (id, val) => {
    setAnswers(prev => ({ ...prev, [id]: val }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!cid && (!publicData.name || !publicData.email)) {
      return alert("Public forms require Name and Email to process correctly.");
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ form_id, cid: cid || null, answers, publicData: cid ? null : publicData })
      });
      const data = await res.json();
      if (data.success) {
        setSubmitted(true);
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert('Error submitting form');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#080810] flex items-center justify-center">
       <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
    </div>
  );

  if (error || !form) return (
    <div className="min-h-screen bg-[#080810] flex items-center justify-center p-6">
       <div className="text-center max-w-sm">
         <h1 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">Form Not Found</h1>
         <p className="text-slate-400 font-bold">{error || "This form may have been disabled or deleted."}</p>
       </div>
    </div>
  );

  if (submitted) return (
    <div className="min-h-screen bg-[#080810] flex items-center justify-center p-6 bg-mesh">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="ios-card text-center max-w-md w-full !p-12 !rounded-[3rem] border border-emerald-500/20 shadow-[0_0_50px_rgba(16,185,129,0.1)]">
        <CheckCircle className="w-20 h-20 text-emerald-500 mx-auto mb-6 drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
        <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-4">Response Captured</h2>
        <p className="text-slate-400 font-bold tracking-tight">Thank you for submitting your response. Your data has been securely recorded.</p>
      </motion.div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#080810] flex p-6 bg-mesh selection:bg-indigo-500/30 overflow-y-auto">
       <div className="max-w-2xl w-full mx-auto my-auto animation-reveal py-10">
          <header className="mb-10 text-center">
             <h1 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter mb-4 leading-none">{form.name}</h1>
             <p className="text-slate-400 font-bold tracking-tight">Please complete the required details below.</p>
          </header>

          <form onSubmit={handleSubmit} className="space-y-6">
            {!cid && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="ios-card bg-[#0d0d18] shadow-2xl space-y-4 mb-8 border border-amber-500/20">
                 <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/5">
                    <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500"><AlertCircle className="w-5 h-5" /></div>
                    <div>
                      <h3 className="text-white font-black uppercase text-sm">Public Identity Required</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">You accessed this without a tracking ID.</p>
                    </div>
                 </div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Full Name <span className="text-rose-500">*</span></label>
                      <input required type="text" value={publicData.name} onChange={e => setPublicData({...publicData, name: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500/50" />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Email <span className="text-rose-500">*</span></label>
                      <input required type="email" value={publicData.email} onChange={e => setPublicData({...publicData, email: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500/50" />
                    </div>
                 </div>
                 <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Phone</label>
                    <input type="tel" value={publicData.phone} onChange={e => setPublicData({...publicData, phone: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500/50" />
                 </div>
              </motion.div>
            )}

            {form.schema.map((field, idx) => (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }} key={field.id} className="ios-card bg-[#0d0d18] shadow-2xl space-y-4">
                 <label className="block text-lg font-black text-white">
                   {field.label} {field.required && <span className="text-rose-500 ml-1">*</span>}
                 </label>
                 
                 {field.type === 'text' ? (
                   <textarea
                     required={field.required}
                     rows={3}
                     value={answers[field.id] || ''}
                     onChange={e => handleChange(field.id, e.target.value)}
                     placeholder="Type your answer here..."
                     className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-indigo-500/50 focus:bg-white/10 transition-colors font-bold custom-scrollbar resize-none"
                   />
                 ) : field.type === 'yes_no' ? (
                   <div className="flex items-center gap-4">
                     <label className={`flex-1 flex items-center justify-center py-4 rounded-xl border cursor-pointer font-black uppercase text-sm tracking-widest transition-all ${answers[field.id] === 'Yes' ? 'bg-indigo-500/20 border-indigo-500 text-indigo-400' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}>
                       <input type="radio" name={field.id} value="Yes" required={field.required} checked={answers[field.id] === 'Yes'} onChange={() => handleChange(field.id, 'Yes')} className="hidden" />
                       Yes
                     </label>
                     <label className={`flex-1 flex items-center justify-center py-4 rounded-xl border cursor-pointer font-black uppercase text-sm tracking-widest transition-all ${answers[field.id] === 'No' ? 'bg-rose-500/20 border-rose-500 text-rose-400' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}>
                       <input type="radio" name={field.id} value="No" required={field.required} checked={answers[field.id] === 'No'} onChange={() => handleChange(field.id, 'No')} className="hidden" />
                       No
                     </label>
                   </div>
                 ) : null}
              </motion.div>
            ))}

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: form.schema.length * 0.1 + 0.2 }} className="pt-8">
              <button disabled={submitting} type="submit" className="w-full btn-prime !py-5 shadow-[0_10px_40px_rgba(99,102,241,0.2)] text-lg disabled:opacity-50 flex items-center justify-center gap-3">
                 {submitting ? <Loader2 className="w-6 h-6 animate-spin" /> : <CheckCircle className="w-6 h-6" />}
                 {submitting ? 'Authenticating...' : 'Submit Final Response'}
              </button>
            </motion.div>
          </form>
       </div>
    </div>
  );
}

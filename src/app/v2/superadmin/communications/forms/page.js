'use client';
import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Plus, CheckSquare, AlignLeft, CheckCircle, Search, Save, X, Link as LinkIcon, Loader2, Copy, Edit3 } from 'lucide-react';
import { IMPACT_CACHE } from '@/utils/impactCache';

export default function FormsPage() {
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modals & UI State
  const [view, setView] = useState('list'); // list, builder, responses
  const [selectedForm, setSelectedForm] = useState(null);
  const [responses, setResponses] = useState([]);
  const [selectedResponse, setSelectedResponse] = useState(null);
  const [showResponseDetails, setShowResponseDetails] = useState(false);
  const [searchForms, setSearchForms] = useState('');
  const [families, setFamilies] = useState([]);
  const [schema, setSchema] = useState([]);
  const [formName, setFormName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editFormId, setEditFormId] = useState(null);
  const [copiedLink, setCopiedLink] = useState('');
  const [selectedGroupName, setSelectedGroupName] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [showNewGroupInput, setShowNewGroupInput] = useState(false);

  useEffect(() => { 
    // Instant-Load from cache
    const cachedForms = IMPACT_CACHE.get('forms');
    if (cachedForms) {
      setForms(cachedForms);
      setLoading(false);
    }
    fetchForms(); 
    fetchFamilies();
  }, []);

  const fetchFamilies = async () => {
    try {
      const res = await fetch('/api/families');
      const data = await res.json();
      if (data.success) setFamilies(data.families || []);
    } catch (e) { console.error(e); }
  };

  const fetchForms = async () => {
    try {
      if (!IMPACT_CACHE.get('forms')) setLoading(true);
      const res = await fetch('/api/forms');
      const data = await res.json();
      if (data.success) {
        setForms(data.forms || []);
        IMPACT_CACHE.set('forms', data.forms);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const addField = (type) => {
    const newField = { 
      id: Date.now().toString(), 
      type, 
      label: type === 'text' ? 'Enter question text...' : 'Yes/No choice...',
      required: true
    };
    setSchema([...schema, newField]);
  };

  const updateField = (id, key, value) => {
    setSchema(schema.map(f => f.id === id ? { ...f, [key]: value } : f));
  };

  const removeField = (id) => {
    setSchema(schema.filter(f => f.id !== id));
  };

  const submitForm = async () => {
    if (!formName) {
      window.dispatchEvent(new CustomEvent('impactos:notify', { 
         detail: { type: 'error', message: 'Form needs a name.' } 
      }));
      return;
    }
    if (schema.length === 0) {
      window.dispatchEvent(new CustomEvent('impactos:notify', { 
         detail: { type: 'error', message: 'Add at least one question.' } 
      }));
      return;
    }
    
    setIsSubmitting(true);
    try {
      let finalGroupName = selectedGroupName;
      if (showNewGroupInput && newGroupName) {
         // Create new family/group
         await fetch('/api/families', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newGroupName })
         });
         finalGroupName = newGroupName;
         fetchFamilies();
      }

      const res = await fetch('/api/forms', {
        method: editFormId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
           form_id: editFormId,
           name: formName, 
           schema,
           group_name: finalGroupName || null
        })
      });
      const data = await res.json();
      if (data.success) {
        setView('list');
        setEditFormId(null);
        setFormName('');
        setSchema([]);
        setSelectedGroupName('');
        setNewGroupName('');
        setShowNewGroupInput(false);
        fetchForms();
        window.dispatchEvent(new CustomEvent('impactos:notify', { 
           detail: { type: 'success', message: `Form ${editFormId ? 'updated' : 'saved'} successfully.` } 
        }));
      } else {
        window.dispatchEvent(new CustomEvent('impactos:notify', { 
           detail: { type: 'error', message: data.error } 
        }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchResponses = async (formId) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/responses?form_id=${formId}`);
      const data = await res.json();
      if (data.success) {
        const filtered = data.detailedResponses.filter(r => r.form_id === formId);
        setResponses(filtered);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const openResponses = (f) => {
    setSelectedForm(f);
    fetchResponses(f.form_id);
    setView('responses');
  };

  const handleEdit = (f) => {
     setEditFormId(f.form_id);
     setFormName(f.name);
     setSchema(f.schema);
     setSelectedGroupName(f.group_name || '');
     setView('builder');
  };

  const copyLink = (formId) => {
    const url = `${window.location.origin}/form/${formId}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(formId);
    window.dispatchEvent(new CustomEvent('impactos:notify', { 
       detail: { type: 'success', message: 'Public link copied.' } 
    }));
    setTimeout(() => setCopiedLink(''), 2000);
  };

  const filteredForms = forms.filter(f => 
    f.name.toLowerCase().includes(searchForms.toLowerCase()) ||
    f.form_id.toLowerCase().includes(searchForms.toLowerCase())
  );

  return (
    <DashboardLayout role="super_admin">
      <div className="space-y-8 min-h-[60vh]">
        <header className="flex flex-col lg:flex-row justify-between items-start gap-6">
          <div>
            <h2 className="text-4xl font-black text-white tracking-tighter uppercase mb-2">Forms</h2>
            <p className="text-slate-400 font-bold tracking-tight">Create forms to collect information from people.</p>
          </div>
          <div className="flex gap-4">
            <button 
              onClick={() => { setEditFormId(null); setFormName(''); setSchema([]); setView('builder'); }} 
              className="btn-prime !py-4 shadow-[#FF6600]/10"
            >
              <Plus className="w-5 h-5 mr-2" /> New Form
            </button>
          </div>
        </header>

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Search forms..." 
              value={searchForms}
              onChange={(e) => setSearchForms(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-14 pr-6 text-white outline-none focus:border-[#FF6600]/80/30 transition-colors font-bold placeholder:text-slate-600"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-20">
            <Loader2 className="w-10 h-10 text-[#FF6600]/80 animate-spin" />
          </div>
        ) : forms.length === 0 ? (
          <div className="p-20 text-center bg-white/5 border border-dashed border-white/10 rounded-[3rem]">
            <CheckSquare className="w-16 h-16 text-slate-500 mx-auto mb-6 opacity-50" />
            <h4 className="text-xl font-black text-white uppercase tracking-tighter mb-2">No Forms</h4>
            <p className="text-slate-400 text-sm font-bold">Build your first form to start collecting responses.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredForms.map(f => (
              <div key={f.form_id} className="ios-card group hover:border-[#FF6600]/30 transition-all duration-300">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-2">
                     <button onClick={() => handleEdit(f)} className="p-2 rounded-lg bg-white/5 border border-white/5 text-slate-500 hover:text-[#FF6600] transition-all" title="Edit Structure">
                        <Edit3 className="w-4 h-4" />
                     </button>
                     <span className="badge badge-glow-success uppercase text-[8px] font-black h-fit">ACTIVE</span>
                  </div>
                </div>
                
                <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-1 truncate">{f.name}</h3>
                <p className="text-xs text-slate-500 font-bold mb-6 italic">ID: {f.form_id}</p>
                
                <div className="grid grid-cols-2 gap-4 mb-6">
                   <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex flex-col">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Questions</p>
                      <p className="text-lg font-black text-white">{f.schema.length}</p>
                   </div>
                   <button 
                      onClick={() => openResponses(f)}
                      className="bg-[#FF6600]/10 border border-[#FF6600]/20 rounded-2xl p-4 flex flex-col hover:bg-[#FF6600]/20 transition-all group/resp"
                   >
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 group-hover/resp:text-[#FF6600]">Responses</p>
                      <p className="text-lg font-black text-white">View List</p>
                   </button>
                </div>

                <button 
                  onClick={() => copyLink(f.form_id)}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-white/5 hover:bg-white/10 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-colors border border-white/10"
                >
                  {copiedLink === f.form_id ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  {copiedLink === f.form_id ? 'Link Copied' : 'Copy Form Link'}
                </button>
              </div>
            ))}
          </div>
        )}

        {view === 'responses' && selectedForm && (
           <div className="ios-card !p-0 overflow-hidden border-white/5 shadow-2xl bg-white/[0.01] animation-reveal">
              <header className="px-8 py-6 border-b border-white/5 flex items-center justify-between bg-[#0d0d18]/50">
                 <div className="flex items-center gap-4">
                    <button onClick={() => setView('list')} className="p-2 rounded-xl bg-white/5 text-slate-400 hover:text-white transition-all"><X className="w-5 h-5" /></button>
                    <div>
                       <h3 className="text-xl font-black text-white uppercase tracking-tighter">{selectedForm.name} — Responses</h3>
                       <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">{responses.length} Submissions Found</p>
                    </div>
                 </div>
              </header>
              
              <div className="overflow-x-auto custom-scrollbar">
                 <table className="executive-table w-full">
                    <thead>
                       <tr className="border-b border-white/5 bg-white/[0.02]">
                          <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-left">Respondent</th>
                          <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-left">Origin Group</th>
                          <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-left">Submission Date</th>
                          <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Action</th>
                       </tr>
                    </thead>
                    <tbody>
                       {responses.map(r => (
                          <tr key={r.id} className="group hover:bg-white/[0.01] border-b border-white/[0.02]">
                             <td className="px-8 py-6">
                                <p className="font-black text-white uppercase italic">{r.name || 'Anonymous'}</p>
                                <p className="text-[10px] font-bold text-slate-500 font-mono">{r.email || r.cid || 'N/A'}</p>
                             </td>
                             <td className="px-8 py-6">
                                <p className="text-[10px] font-black text-white uppercase italic">{r.group_name || 'Individual'}</p>
                             </td>
                             <td className="px-8 py-6">
                                <p className="text-xs font-bold text-slate-400">{new Date(r.created_at).toLocaleString()}</p>
                             </td>
                             <td className="px-8 py-6 text-right">
                                <button 
                                   onClick={() => { setSelectedResponse(r); setShowResponseDetails(true); }}
                                   className="px-4 py-2 bg-white/5 hover:bg-[#FF6600]/10 rounded-lg text-slate-400 hover:text-[#FF6600] transition-all border border-white/5 text-[10px] font-black uppercase tracking-widest"
                                >
                                   View Details
                                </button>
                             </td>
                          </tr>
                       ))}
                       {responses.length === 0 && (
                          <tr>
                             <td colSpan="3" className="px-8 py-20 text-center text-slate-500 font-bold uppercase text-sm tracking-widest">No responses yet for this form.</td>
                          </tr>
                       )}
                    </tbody>
                 </table>
              </div>
           </div>
        )}

        {showResponseDetails && selectedResponse && (
           <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
              <div onClick={() => setShowResponseDetails(false)} className="absolute inset-0 bg-black/90 backdrop-blur-sm" />
              <div className="relative w-full max-w-2xl bg-[#0d0d18] border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden animation-pop">
                 <header className="px-8 py-6 border-b border-white/5 flex items-center justify-between">
                    <div>
                       <h4 className="text-xl font-black text-white uppercase italic">Response Details</h4>
                       <p className="text-[10px] font-bold text-[#FF6600] uppercase tracking-widest">{selectedResponse.name || 'Anonymous Respondent'}</p>
                    </div>
                    <button onClick={() => setShowResponseDetails(false)} className="text-slate-500 hover:text-white"><X className="w-6 h-6" /></button>
                 </header>
                 <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    {Object.entries(selectedResponse.answers).map(([key, val], idx) => (
                       <div key={idx} className="space-y-2">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Question {idx + 1}</p>
                          <div className="p-4 bg-white/5 border border-white/5 rounded-2xl">
                             <p className="text-sm font-bold text-white leading-relaxed">{val}</p>
                          </div>
                       </div>
                    ))}
                 </div>
              </div>
           </div>
        )}

        {view === 'builder' && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center pointer-events-auto">
            <div onClick={() => setView('list')} className="absolute inset-0 bg-black/80" />
            <div className="relative w-full max-w-4xl h-[85vh] flex flex-col ios-card !p-0 shadow-2xl bg-[#080810] border border-white/10 m-4 overflow-hidden text-left">
              <header className="px-8 py-6 border-b border-white/5 flex items-center justify-between bg-[#0d0d18] flex-shrink-0">
                <div>
                  <h3 className="text-2xl font-black text-white uppercase tracking-tighter">{editFormId ? 'Modify Form' : 'New Form'}</h3>
                  <p className="text-sm text-slate-400 font-bold">{editFormId ? 'Update question nodes and logic.' : 'Add questions to your new form.'}</p>
                </div>
                 <button onClick={() => setView('list')} className="text-slate-500 hover:text-white transition-colors"><X className="w-6 h-6" /></button>
              </header>

              <div className="flex-1 overflow-auto p-8 custom-scrollbar">
                <div className="max-w-2xl mx-auto space-y-8">
                  <div>
                    <label className="block text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-3">Form Name</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Feedback Form..."
                      value={formName} 
                      onChange={e => setFormName(e.target.value)} 
                      className="w-full bg-transparent border-b-2 border-white/10 py-2 text-3xl font-black text-white outline-none focus:border-[#FF6600]/80/50 transition-colors placeholder:text-slate-700 mb-6" 
                    />
                  </div>

                  <div className="space-y-4">
                    <label className="block text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">Deployment Context (Target Group)</label>
                    <div className="flex gap-4">
                       <select 
                          className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white outline-none font-bold appearance-none cursor-pointer"
                          value={showNewGroupInput ? 'NEW' : selectedGroupName}
                          onChange={e => {
                             if (e.target.value === 'NEW') {
                                setShowNewGroupInput(true);
                             } else {
                                setShowNewGroupInput(false);
                                setSelectedGroupName(e.target.value);
                             }
                          }}
                       >
                          <option value="" className="bg-[#0f0f1a]">General / No Specific Group</option>
                          {families.map(f => <option key={f.id} value={f.name} className="bg-[#0f0f1a]">{f.name.toUpperCase()}</option>)}
                          <option value="NEW" className="bg-[#0f0f1a] text-[#FF6600] font-black">+ Create New Group</option>
                       </select>
                       
                       {showNewGroupInput && (
                          <input 
                             placeholder="Enter new group name..."
                             className="flex-1 bg-[#FF6600]/5 border border-[#FF6600]/20 rounded-2xl px-6 py-4 text-white outline-none font-bold"
                             value={newGroupName}
                             onChange={e => setNewGroupName(e.target.value)}
                             autoFocus
                          />
                       )}
                    </div>
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest italic opacity-60">Linking a form to a group will automatically tag all submissions from that group.</p>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                       <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Questions</h4>
                       <span className="badge bg-white/5 text-white">{schema.length} Total</span>
                    </div>

                    <div className="space-y-4">
                      {schema.length === 0 && (
                         <div className="p-10 border border-dashed border-white/10 rounded-2xl text-center">
                           <p className="text-slate-500 font-bold text-sm">No questions yet. Use the buttons below to add some.</p>
                         </div>
                      )}
                      {schema.map((field, index) => (
                        <div key={field.id} className="ios-card bg-white/[0.02] border-white/5 p-6 space-y-4">
                           <div className="flex items-center justify-between gap-4">
                              <div className="flex items-center gap-3 flex-1">
                                 <div className="w-8 h-8 rounded-lg bg-[#FF6600]/80/10 border border-[#FF6600]/80/20 flex items-center justify-center text-indigo-400 font-black text-xs">
                                    {index + 1}
                                 </div>
                                 <input 
                                   type="text" 
                                   value={field.label} 
                                   onChange={e => updateField(field.id, 'label', e.target.value)} 
                                   className="flex-1 bg-transparent border-none text-lg font-bold text-white outline-none placeholder:text-slate-600 focus:ring-0" 
                                 />
                              </div>
                              <div className="flex items-center gap-4">
                                 <span className="text-[10px] uppercase font-black tracking-widest text-slate-500 bg-white/5 px-2 py-1 rounded">
                                    {field.type === 'text' ? 'Free Text' : 'Yes/No'}
                                 </span>
                                 <button onClick={() => removeField(field.id)} className="text-rose-500 hover:text-rose-400 transition-colors"><X className="w-5 h-5" /></button>
                              </div>
                           </div>
                           <div className="pl-11">
                             <label className="flex items-center gap-2 text-xs font-bold text-slate-400 cursor-pointer w-fit">
                                <input 
                                   type="checkbox" 
                                   checked={field.required}
                                   onChange={e => updateField(field.id, 'required', e.target.checked)} 
                                   className="accent-[#FF6600]/80"
                                />
                                Required Field
                             </label>
                           </div>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                      <button onClick={() => addField('text')} className="flex items-center justify-center gap-2 py-4 bg-[#FF6600]/80/10 hover:bg-[#FF6600]/80 text-indigo-400 rounded-2xl font-black text-xs uppercase tracking-widest transition-colors border border-[#FF6600]/80/20">
                         <AlignLeft className="w-4 h-4" /> Add Text Question
                      </button>
                      <button onClick={() => addField('yes_no')} className="flex items-center justify-center gap-2 py-4 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 rounded-2xl font-black text-xs uppercase tracking-widest transition-colors border border-emerald-500/20">
                         <CheckSquare className="w-4 h-4" /> Add Yes/No Question
                      </button>
                    </div>
                  </div>
                </div>
              </div>

               <div className="p-6 bg-[#0d0d18] border-t border-white/5 flex justify-end gap-3 flex-shrink-0">
                  <button onClick={() => setView('list')} className="btn-ghost !px-8 text-sm">Discard</button>
                 <button onClick={submitForm} disabled={isSubmitting} className="btn-prime !px-8 text-sm shadow-[#FF6600]/20 disabled:opacity-50 flex items-center gap-2">
                   {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                   {isSubmitting ? 'Saving...' : 'Save Form'}
                 </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

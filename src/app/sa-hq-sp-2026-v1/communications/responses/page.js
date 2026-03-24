'use client';
import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Filter, Rocket, Search, CheckCircle, XCircle, Clock, Loader2, X, BarChart3, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { IMPACT_CACHE } from '@/utils/impactCache';

export default function ResponsesPage() {
  const router = useRouter();
  const [data, setData] = useState({ campaignStats: [], detailedResponses: [], contactsDetailed: [], flaggedResponses: [] });
  const [globalContacts, setGlobalContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [view, setView] = useState('analytics'); // analytics | review
  const [activeCampaign, setActiveCampaign] = useState(null);
  const [filterMode, setFilterMode] = useState('all'); // all | yes | no | pending_response
  const [search, setSearch] = useState('');

  // Retargeting
  const [showRetargetModal, setShowRetargetModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState('');

  useEffect(() => { 
    // Instant-Load from cache
    const cachedData = IMPACT_CACHE.get('responses');
    if (cachedData) {
      setData(cachedData);
      setLoading(false);
    }
    fetchData(); 
  }, []);

  const fetchData = async () => {
    try {
      if (!IMPACT_CACHE.get('responses')) setLoading(true);
      const [res, contactsRes] = await Promise.all([
        fetch('/api/responses'),
        fetch('/api/contacts')
      ]);
      const json = await res.json();
      const contactsJson = await contactsRes.json();
      if (json.success) {
        setData(json);
        IMPACT_CACHE.set('responses', json);
      }
      if (contactsJson.success) setGlobalContacts(contactsJson.contacts);
      if (json.campaignStats?.length > 0) setActiveCampaign(json.campaignStats[0].id);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const resolveMatch = async (response_id, cid) => {
    if (!cid) return;
    try {
      const res = await fetch('/api/responses/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response_id, cid })
      });
      const data = await res.json();
      if (data.success) {
        window.dispatchEvent(new CustomEvent('impactos:notify', { 
           detail: { type: 'success', message: 'Person matched successfully.' } 
        }));
        fetchData();
      } else {
        window.dispatchEvent(new CustomEvent('impactos:notify', { 
           detail: { type: 'error', message: data.error } 
        }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getFilteredContacts = () => {
    if (!activeCampaign) return [];
    let list = data.contactsDetailed.filter(c => c.campaign_id === activeCampaign);
    if (filterMode !== 'all') {
      list = list.filter(c => c.status === filterMode || (filterMode === 'pending_response' && c.status === 'sent'));
    }
    if (search) {
      list = list.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase()));
    }
    return list;
  };

  const executeRetarget = async (e) => {
    e.preventDefault();
    const targets = getFilteredContacts().map(c => c.cid);
    if (targets.length === 0) {
      window.dispatchEvent(new CustomEvent('impactos:notify', { 
         detail: { type: 'error', message: 'No one to follow up with.' } 
      }));
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCampaignName, form_id: '', cids: targets })
      });
      const json = await res.json();
      if (json.success) {
        window.dispatchEvent(new CustomEvent('impactos:notify', { 
           detail: { type: 'success', message: 'Follow-up campaign started.' } 
        }));
        setShowRetargetModal(false);
        router.push('/sa-hq-sp-2026-v1/communications/campaigns');
      } else {
        window.dispatchEvent(new CustomEvent('impactos:notify', { 
           detail: { type: 'error', message: json.error } 
        }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeStats = data.campaignStats.find(c => c.id === activeCampaign);
  const filteredList = getFilteredContacts();

  return (
    <DashboardLayout role="super_admin">
      <div className="space-y-8 min-h-[60vh]">
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div>
            <h2 className="text-4xl font-black text-white tracking-tighter uppercase mb-2">Responses</h2>
            <p className="text-slate-400 font-bold tracking-tight">Track how people are responding to your campaigns.</p>
          </div>
          <div className="flex gap-4">
             <button onClick={() => setView('analytics')} className={`font-black text-[10px] tracking-widest uppercase px-6 py-3 rounded-xl transition-all ${view === 'analytics' ? 'bg-indigo-500 text-white shadow-indigo-600/20 shadow-lg' : 'bg-white/5 text-slate-400 hover:text-white'}`}>Charts</button>
             <button onClick={() => setView('review')} className={`font-black text-[10px] tracking-widest uppercase px-6 py-3 rounded-xl transition-all flex items-center gap-2 ${view === 'review' ? 'bg-rose-500 text-white shadow-rose-600/20 shadow-lg' : 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'}`}>
                Fix Matches
                {data.flaggedResponses?.length > 0 && <span className="bg-rose-900 border border-rose-500 px-2 rounded-full text-[10px]">{data.flaggedResponses.length}</span>}
             </button>
          </div>
        </header>

        {loading ? (
          <div className="flex items-center justify-center p-20">
            <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
          </div>
        ) : view === 'review' ? (
          <div className="space-y-4 text-left">
             {data.flaggedResponses?.length === 0 ? (
                <div className="p-20 text-center bg-white/5 border border-dashed border-emerald-500/30 rounded-[3rem]">
                   <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-6 shadow-[0_0_30px_rgba(16,185,129,0.2)] rounded-full" />
                   <h4 className="text-xl font-black text-white uppercase tracking-tighter mb-2">All Matches are Correct</h4>
                   <p className="text-slate-400 text-sm font-bold">No people need matching right now.</p>
                </div>
             ) : (
                data.flaggedResponses?.map(f => (
                   <div key={f.response_id} className="ios-card bg-rose-500/5 border border-rose-500/10 flex flex-col md:flex-row gap-6 justify-between items-start md:items-center p-6">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                           <span className="badge bg-rose-500 text-white uppercase font-black text-[9px]">Needs Match</span>
                           <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Similarity: {f.confidence_score}%</span>
                        </div>
                        <p className="font-extrabold text-white text-lg">Input: {(f.answers && (f.answers.name || f.answers.email)) || 'Unknown'}</p>
                        <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black inline-flex items-center gap-2">Data Found: <span className="text-white border px-1.5 rounded bg-white/5">{JSON.stringify(f.answers)}</span></p>
                      </div>
                      <div className="flex flex-col md:items-end gap-2 w-full md:w-auto">
                         <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Match with Person</label>
                         <select onChange={(e) => resolveMatch(f.response_id, e.target.value)} defaultValue="" className="w-full md:w-[300px] bg-[#0d0d18] border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500/50 appearance-none font-bold">
                            <option value="" disabled>Choose a person...</option>
                            {globalContacts.map(gc => (
                              <option key={gc.cid} value={gc.cid}>{gc.name} ({gc.email})</option>
                            ))}
                         </select>
                      </div>
                   </div>
                ))
             )}
          </div>
        ) : data.campaignStats.length === 0 ? (
          <div className="p-20 text-center bg-white/5 border border-dashed border-white/10 rounded-[3rem]">
            <BarChart3 className="w-16 h-16 text-slate-500 mx-auto mb-6 opacity-50" />
            <h4 className="text-xl font-black text-white uppercase tracking-tighter mb-2">No Data Yet</h4>
            <p className="text-slate-400 text-sm font-bold">Start a campaign to see how people respond.</p>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-8 text-left">
            <div className="w-full lg:w-1/3 xl:w-1/4 space-y-4">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Select Campaign</h3>
              <div className="space-y-2">
                {data.campaignStats.map(c => (
                  <button 
                    key={c.id}
                    onClick={() => { setActiveCampaign(c.id); setFilterMode('all'); }}
                    className={`w-full text-left p-4 rounded-2xl border transition-all ${activeCampaign === c.id ? 'bg-indigo-500/10 border-indigo-500 text-white' : 'bg-white/5 border-white/5 hover:bg-white/10 text-slate-400'}`}
                  >
                    <p className="font-black uppercase tracking-tighter text-sm truncate mb-1">{c.name}</p>
                    <p className="text-[10px] font-bold opacity-70 border-t border-white/10 pt-2 flex items-center justify-between">
                       <span>Total: {c.total}</span>
                       {activeCampaign === c.id && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,1)]" />}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 space-y-6">
              {activeStats && (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div onClick={() => setFilterMode('all')} className={`ios-card !p-5 cursor-pointer transition-all border-2 ${filterMode === 'all' ? 'border-white !bg-white/10 shadow-lg' : 'border-transparent'}`}>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total</p>
                       <p className="text-3xl font-black text-white">{activeStats.total}</p>
                    </div>
                    <div onClick={() => setFilterMode('yes')} className={`ios-card !p-5 cursor-pointer transition-all border-2 ${filterMode === 'yes' ? 'border-emerald-500 !bg-emerald-500/10 shadow-lg' : 'border-transparent'}`}>
                       <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1 flex items-center gap-1 font-black">Yes / Approved</p>
                       <p className="text-3xl font-black text-white">{activeStats.yes_count}</p>
                    </div>
                    <div onClick={() => setFilterMode('no')} className={`ios-card !p-5 cursor-pointer transition-all border-2 ${filterMode === 'no' ? 'border-rose-500 !bg-rose-500/10 shadow-lg' : 'border-transparent'}`}>
                       <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1 flex items-center gap-1 font-black">No / Declined</p>
                       <p className="text-3xl font-black text-white">{activeStats.no_count}</p>
                    </div>
                    <div onClick={() => setFilterMode('pending_response')} className={`ios-card !p-5 cursor-pointer transition-all border-2 ${filterMode === 'pending_response' ? 'border-amber-500 !bg-amber-500/10 shadow-lg' : 'border-transparent'}`}>
                       <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1 flex items-center gap-1 font-black">Waiting</p>
                       <p className="text-3xl font-black text-white">{activeStats.pending_response}</p>
                    </div>
                  </div>

                  <div className="ios-card bg-transparent border-white/5 space-y-6 !p-0 overflow-hidden">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 border-b border-white/5">
                      <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                        <input 
                          type="text" 
                          placeholder="Search list..." 
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-12 pr-4 text-sm text-white outline-none focus:border-indigo-500/50 transition-colors font-bold"
                        />
                      </div>
                      <button 
                         onClick={() => setShowRetargetModal(true)}
                         className="flex items-center justify-center gap-2 py-3 px-6 bg-indigo-500 text-white rounded-xl font-black text-[10px] uppercase tracking-[0.2em] shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:scale-105 transition-all w-full md:w-auto"
                      >
                         <Rocket className="w-4 h-4" /> Send Follow-up
                      </button>
                    </div>
                    <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
                       <table className="w-full text-left">
                          <thead className="bg-[#0d0d18]">
                             <tr>
                               <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Name</th>
                               <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Status</th>
                             </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                             {filteredList.map(c => (
                               <tr key={c.cid} className="hover:bg-white/[0.02] transition-colors">
                                  <td className="px-6 py-5">
                                     <p className="font-black text-white text-sm uppercase -tracking-wider mb-0.5">{c.name}</p>
                                     <p className="text-[10px] text-slate-400 font-bold">{c.email}</p>
                                  </td>
                                  <td className="px-6 py-5">
                                     {c.status === 'yes' && <span className="text-[10px] font-black px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">Approved</span>}
                                     {c.status === 'no' && <span className="text-[10px] font-black px-2 py-1 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 uppercase">Declined</span>}
                                     {c.status === 'sent' && <span className="text-[10px] font-black px-2 py-1 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 uppercase">Waiting</span>}
                                     {(!['yes','no','sent'].includes(c.status)) && <span className="text-[10px] font-black px-2 py-1 rounded bg-white/10 text-slate-400 border border-white/20 uppercase">{c.status}</span>}
                                  </td>
                               </tr>
                             ))}
                          </tbody>
                       </table>
                       {filteredList.length === 0 && (
                          <div className="py-20 text-center text-slate-500 font-bold text-sm">No results found for this filter.</div>
                       )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {showRetargetModal && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center pointer-events-auto">
            <div onClick={() => setShowRetargetModal(false)} className="absolute inset-0 bg-black/80" />
            <div className="relative w-full max-w-md ios-card !p-8 shadow-2xl bg-[#080810] border border-white/10 m-4 text-left">
              <button onClick={() => setShowRetargetModal(false)} className="absolute top-6 right-6 text-slate-500 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
              <div className="mb-8">
                <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">Follow-up</h3>
                <p className="text-sm text-slate-400 font-bold">Start a new campaign for these <span className="text-white font-black">{filteredList.length}</span> people.</p>
              </div>
              <form onSubmit={executeRetarget} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Campaign Name</label>
                  <input required autoFocus type="text" value={newCampaignName} onChange={e => setNewCampaignName(e.target.value)} placeholder="e.g. Second Outreach" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pb-2 text-white outline-none focus:border-indigo-500/50 focus:bg-white/10 transition-colors font-bold" />
                </div>
                <div className="pt-4">
                  <button type="submit" disabled={isSubmitting} className="w-full btn-prime !py-4 shadow-indigo-600/20 text-sm disabled:opacity-50">
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (
                      <div className="flex items-center justify-center gap-2">
                        <Rocket className="w-4 h-4" /> 
                        <span>Start Follow-up List</span>
                      </div>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

'use client';
import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { motion, AnimatePresence } from 'framer-motion';
import { Filter, Users, Rocket, Save, X, Search, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SegmentsPage() {
  const router = useRouter();
  const [segments, setSegments] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // State for segment builder
  const [showBuilder, setShowBuilder] = useState(false);
  const [filters, setFilters] = useState({ campaign_id: '', status: '' });
  const [segmentName, setSegmentName] = useState('');
  const [previewContacts, setPreviewContacts] = useState([]);
  const [isPreviewing, setIsPreviewing] = useState(false);

  // State for Campaign Launcher
  const [showLauncher, setShowLauncher] = useState(false);
  const [activeSegment, setActiveSegment] = useState(null);
  const [forms, setForms] = useState([]);
  const [campaignConfig, setCampaignConfig] = useState({ name: '', form_id: '' });
  const [isLaunching, setIsLaunching] = useState(false);

  useEffect(() => { 
    fetchData(); 
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [segRes, campRes, formRes] = await Promise.all([
        fetch('/api/segments'),
        fetch('/api/campaigns'),
        fetch('/api/forms').catch(() => ({ json: () => ({ forms: [] }) }))
      ]);
      const [segs, camps, fms] = await Promise.all([segRes.json(), campRes.json(), formRes.json()]);
      
      if (segs.success) setSegments(segs.segments || []);
      if (camps.success) setCampaigns(camps.campaigns || []);
      if (fms.success) setForms(fms.forms || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const runPreview = async (currentFilters) => {
    setIsPreviewing(true);
    try {
      const res = await fetch('/api/segments/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filters: currentFilters })
      });
      const data = await res.json();
      if (data.success) {
        setPreviewContacts(data.contacts);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleFilterChange = (key, val) => {
    const nextFilters = { ...filters, [key]: val };
    setFilters(nextFilters);
    runPreview(nextFilters);
  };

  const saveSegment = async () => {
    if (!segmentName) return alert('Name your segment first.');
    if (previewContacts.length === 0) return alert('Cannot save an empty segment.');
    
    try {
      const res = await fetch('/api/segments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: segmentName, filters })
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
        setShowBuilder(false);
        setFilters({ campaign_id: '', status: '' });
        setSegmentName('');
        setPreviewContacts([]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const openLauncher = async (segment) => {
    setActiveSegment(segment);
    // Pre-load the contacts for this segment
    const res = await fetch('/api/segments/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filters: segment.filters })
    });
    const data = await res.json();
    if (data.success) {
      setPreviewContacts(data.contacts);
      setShowLauncher(true);
    }
  };

  const launchCampaign = async (e) => {
    e.preventDefault();
    if (!campaignConfig.name || previewContacts.length === 0) return alert('Requires name and non-empty segment');
    setIsLaunching(true);
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: campaignConfig.name, 
          form_id: campaignConfig.form_id, 
          cids: previewContacts.map(c => c.cid),
          segment_id: activeSegment.id
        })
      });
      const data = await res.json();
      if (data.success) {
        alert('Campaign Generated Successfully.');
        router.push('/sa-hq-sp-2026-v1/communications/campaigns');
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLaunching(false);
    }
  };

  return (
    <DashboardLayout role="super_admin">
      <div className="animation-reveal space-y-8 min-h-[60vh]">
        <header className="flex flex-col lg:flex-row justify-between items-start gap-6">
          <div>
            <h2 className="text-4xl font-black text-white tracking-tighter uppercase mb-2">Segmentation Engine</h2>
            <p className="text-slate-400 font-bold tracking-tight">Define, save, and launch targeted intelligence audiences.</p>
          </div>
          <button 
            onClick={() => { setShowBuilder(true); runPreview(filters); }} 
            className="btn-prime !py-4 shadow-indigo-600/10"
          >
            <Plus className="w-5 h-5 mr-2" /> Program New Segment
          </button>
        </header>

        {loading ? (
          <div className="flex items-center justify-center p-20">
            <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
          </div>
        ) : segments.length === 0 ? (
          <div className="p-20 text-center bg-white/5 border border-dashed border-white/10 rounded-[3rem]">
            <Filter className="w-16 h-16 text-slate-500 mx-auto mb-6 opacity-50" />
            <h4 className="text-xl font-black text-white uppercase tracking-tighter mb-2">No Saved Segments</h4>
            <p className="text-slate-400 text-sm font-bold">You haven't programmed any reusable cohorts yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {segments.map(s => (
              <div key={s.id} className="ios-card group hover:border-indigo-500/30 transition-all duration-500 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-6">
                    <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                      <Filter className="w-6 h-6" />
                    </div>
                  </div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-2 group-hover:text-indigo-400 transition-colors">{s.name}</h3>
                  
                  <div className="text-xs text-slate-400 font-bold flex flex-wrap gap-2 mb-6">
                    {Object.entries(s.filters).map(([k, v]) => v && (
                      <span key={k} className="px-2 py-1 bg-white/5 rounded-md border border-white/10 uppercase tracking-widest">{k}: {v}</span>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5 mt-auto">
                  <button 
                    onClick={() => openLauncher(s)}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-500/10 hover:bg-indigo-500 text-indigo-400 hover:text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all border border-indigo-500/20 group-hover:border-indigo-500/50"
                  >
                    <Rocket className="w-4 h-4" /> Execute Campaign
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Builder Modal */}
        <AnimatePresence>
          {showBuilder && (
            <div className="fixed inset-0 z-[300] flex items-center justify-center pointer-events-auto">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowBuilder(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
              <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-4xl max-h-[90vh] flex flex-col ios-card !p-0 shadow-2xl bg-[#080810] border border-white/10 m-4 overflow-hidden">
                <header className="px-8 py-6 border-b border-white/5 flex items-center justify-between bg-[#0d0d18]">
                  <div>
                    <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Cohort Sequencer</h3>
                    <p className="text-sm text-slate-400 font-bold">Filter contacts dynamically & preview targets.</p>
                  </div>
                  <button onClick={() => setShowBuilder(false)} className="text-slate-500 hover:text-white transition-colors"><X className="w-6 h-6" /></button>
                </header>

                <div className="flex-1 overflow-auto flex flex-col md:flex-row h-full">
                   {/* Editor */}
                   <div className="w-full md:w-1/2 p-8 border-b md:border-b-0 md:border-r border-white/5 space-y-6">
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Segment Reference Alias</label>
                        <input type="text" value={segmentName} onChange={e => setSegmentName(e.target.value)} placeholder="e.g. VIP Responders..." className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500/50 font-bold" />
                      </div>

                      <div className="space-y-4">
                        <label className="block text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] pt-4 border-t border-white/5">Logic Filters</label>
                        
                        <div>
                          <label className="block text-xs font-bold text-slate-400 mb-1">Source Campaign Participation</label>
                          <select value={filters.campaign_id} onChange={e => handleFilterChange('campaign_id', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500/50 appearance-none font-bold">
                             <option value="" className="bg-[#080810]">Any or None</option>
                             {campaigns.map(c => <option key={c.id} value={c.id} className="bg-[#080810]">{c.name}</option>)}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-400 mb-1">Response Signal Status</label>
                          <select value={filters.status} onChange={e => handleFilterChange('status', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500/50 appearance-none font-bold">
                             <option value="" className="bg-[#080810]">All Targets</option>
                             <option value="yes" className="bg-[#080810]">Approved (YES)</option>
                             <option value="no" className="bg-[#080810]">Declined (NO)</option>
                             <option value="NOT_RESPONDED" className="bg-[#080810]">Did Not Respond</option>
                          </select>
                        </div>
                      </div>

                      <div className="pt-6 mt-auto">
                        <button onClick={saveSegment} className="w-full btn-prime !py-4 shadow-indigo-600/20 text-sm flex items-center justify-center gap-2">
                          <Save className="w-4 h-4" /> Finalize Segment Map
                        </button>
                      </div>
                   </div>

                   {/* Preview Window */}
                   <div className="w-full md:w-1/2 p-8 bg-white/[0.02]">
                      <div className="flex items-center justify-between mb-6">
                         <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Live Audience Render</h4>
                         <span className="badge badge-glow-success bg-indigo-500/20 text-indigo-400">{previewContacts.length} Yields</span>
                      </div>

                      {isPreviewing ? (
                        <div className="flex items-center justify-center p-10"><Loader2 className="w-8 h-8 text-indigo-500 animate-spin" /></div>
                      ) : (
                        <div className="max-h-[300px] overflow-y-auto custom-scrollbar space-y-2 pr-2">
                           {previewContacts.length === 0 ? (
                             <p className="text-xs text-slate-500 font-bold text-center py-10">No targets align with this matrix.</p>
                           ) : previewContacts.map(c => (
                             <div key={c.cid} className="p-3 bg-white/5 border border-white/5 rounded-xl flex items-center justify-between">
                                <span className="font-bold text-sm text-white">{c.name}</span>
                                <span className="text-[10px] text-slate-400 uppercase tracking-widest">{c.email}</span>
                             </div>
                           ))}
                        </div>
                      )}
                   </div>
                </div>
              </motion.div>
            </div>
          )}

          {/* Campaign Launcher Modal */}
          {showLauncher && (
            <div className="fixed inset-0 z-[400] flex items-center justify-center pointer-events-auto">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowLauncher(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
              <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-md ios-card !p-8 shadow-2xl bg-[#080810] border border-white/10 m-4">
                <button onClick={() => setShowLauncher(false)} className="absolute top-6 right-6 text-slate-500 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
                <div className="mb-8">
                  <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">Segment Launcher</h3>
                  <p className="text-sm text-slate-400 font-bold">Inject <span className="text-white font-black">{previewContacts.length}</span> targets immediately into a new pipeline.</p>
                </div>
                <form onSubmit={launchCampaign} className="space-y-4">
                  <div>
                     <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Campaign Sub-Reference</label>
                     <input required autoFocus type="text" value={campaignConfig.name} onChange={e => setCampaignConfig({...campaignConfig, name: e.target.value})} placeholder="e.g. VIP Phase 2 Ops" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pb-2 text-white outline-none focus:border-indigo-500/50 focus:bg-white/10 transition-colors font-bold" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Payload Schema (Optional)</label>
                    <select value={campaignConfig.form_id} onChange={e => setCampaignConfig({...campaignConfig, form_id: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pb-2 text-white outline-none focus:border-indigo-500/50 focus:bg-white/10 transition-colors font-bold appearance-none">
                       <option value="" className="bg-[#080810]">None (Direct Email Focus)</option>
                       {forms.map(f => <option key={f.form_id} value={f.form_id} className="bg-[#080810]">{f.name}</option>)}
                    </select>
                  </div>
                  <div className="pt-4">
                     <button type="submit" disabled={isLaunching} className="w-full btn-prime !py-4 shadow-indigo-600/20 text-sm disabled:opacity-50 flex justify-center items-center">
                        {isLaunching ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Rocket className="w-4 h-4 mr-2" />}
                        {isLaunching ? 'Firing Pipeline...' : 'Fire Pipeline Now'}
                     </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}

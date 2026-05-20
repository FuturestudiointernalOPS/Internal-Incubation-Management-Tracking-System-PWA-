const fs = require('fs');
const filepath = 'src/app/v2/superadmin/programs/[id]/page.js';
let content = fs.readFileSync(filepath, 'utf8');

// Add Lucide imports
content = content.replace('AlertCircle, Send', 'AlertCircle, Send, Trash2, Plus, X');

// Add states
const stateInjection = `  const [kpis, setKpis] = useState([]);
  const [showKPIModal, setShowKPIModal] = useState(false);
  const [newKPI, setNewKPI] = useState({ title: '', target_value: 80 });
  const [toast, notify] = useState(null); // Simple local notify for SA`;

content = content.replace('const [isSubmitting, setIsSubmitting] = useState(false);', `const [isSubmitting, setIsSubmitting] = useState(false);\n${stateInjection}`);

// Add fetch KPIs logic inside fetchData
const fetchKPIs = `
      // 4. KPIs
      const kpiRes = await fetch(\`/api/v2/kpis?program_id=\${id}\`);
      const kpiData = await kpiRes.json();
      if (kpiData.success) setKpis(kpiData.kpis || []);
`;
content = content.replace('setIsLoaded(true);', `${fetchKPIs}\n      setIsLoaded(true);`);

// Add addKPI and removeKPI functions
const kpiFunctions = `
  const showToast = (msg, type='success') => {
    notify({ msg, type });
    setTimeout(() => notify(null), 3000);
  };

  const addKPI = async () => {
    if (!newKPI.title.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/v2/kpis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newKPI, program_id: id })
      });
      const data = await res.json();
      if (data.success) { 
        showToast('KPI defined.'); 
        setShowKPIModal(false); 
        setNewKPI({ title: '', target_value: 80 }); 
        fetchData(); 
      }
      else showToast(data.error || 'Failed.', 'error');
    } catch (e) { showToast('Network error.', 'error'); }
    finally { setIsSubmitting(false); }
  };

  const removeKPI = async (kpiId) => {
    if (!confirm('Decommission this KPI?')) return;
    try {
      const res = await fetch('/api/v2/kpis', { 
        method: 'DELETE', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: kpiId }) 
      });
      if ((await res.json()).success) {
        showToast('KPI removed.');
        fetchData();
      }
    } catch (e) { showToast('Network error.', 'error'); }
  };
`;
content = content.replace('const handleAddFollowup = async (wn, sid = null) => {', `${kpiFunctions}\n  const handleAddFollowup = async (wn, sid = null) => {`);

// Add KPI UI between metrics and timeline
const kpiUI = `
        {/* STRATEGIC KPIs */}
        <div className="space-y-6">
           <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                 <Target className="w-5 h-5 text-[#FF6600]" />
                 <h3 className="text-xl font-black text-white uppercase tracking-widest italic">Strategic KPIs</h3>
              </div>
              <button onClick={() => setShowKPIModal(true)} className="px-6 py-2 rounded-xl border border-dashed border-white/20 text-[9px] font-black uppercase tracking-widest text-white hover:border-[#FF6600] hover:text-[#FF6600] transition-all flex items-center gap-2">
                 <Plus className="w-3 h-3" /> Define KPI Target
              </button>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {kpis.map(kpi => (
                <div key={kpi.id} className="ios-card bg-white/[0.02] border-white/5 !p-6 flex items-center justify-between group">
                  <div>
                    <h4 className="font-bold text-sm text-white uppercase tracking-tight">{kpi.title}</h4>
                    <p className="text-[9px] font-black text-[#FF6600] uppercase tracking-widest mt-1 italic">Target: {kpi.target_value}%</p>
                  </div>
                  <button onClick={() => removeKPI(kpi.id)} className="p-2 rounded-lg text-white/20 hover:bg-rose-500/10 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {kpis.length === 0 && (
                <div className="col-span-full py-10 border border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center text-center opacity-50">
                  <Target className="w-8 h-8 text-white mb-3" />
                  <p className="text-xs font-black uppercase tracking-widest text-white">No KPIs Defined</p>
                  <p className="text-[9px] text-white/50 mt-1 max-w-xs leading-relaxed uppercase">Define strategic key performance indicators to align curriculum execution.</p>
                </div>
              )}
           </div>
        </div>
`;
content = content.replace('{/* STRATEGIC TIMELINE */}', `${kpiUI}\n        {/* STRATEGIC TIMELINE */}`);

// Add KPI Modal at the very end before </DashboardLayout>
const kpiModalUI = `
      {/* DEFINE KPI MODAL */}
      {showKPIModal && (
        <div className="fixed inset-0 z-[400] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setShowKPIModal(false)}>
          <div className="card w-full max-w-md space-y-6 bg-[#080810] border border-white/10 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
              <div className="space-y-1">
                <h3 className="text-base font-black uppercase tracking-tight text-white">Define KPI Target</h3>
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Establish a new strategic performance metric.</p>
              </div>
              <button onClick={() => setShowKPIModal(false)} className="text-slate-500 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">KPI Title</label>
                <input 
                  value={newKPI.title} 
                  onChange={e => setNewKPI(p => ({...p, title: e.target.value}))} 
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none font-bold bg-white/5 border border-white/10 text-white focus:border-[#FF6600]/50 transition-colors" 
                  placeholder="e.g. Weekly Engagement" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Target Value (%)</label>
                <input 
                  type="number" min="0" max="100" 
                  value={newKPI.target_value} 
                  onChange={e => setNewKPI(p => ({...p, target_value: parseInt(e.target.value) || 0}))} 
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none font-bold bg-white/5 border border-white/10 text-white focus:border-[#FF6600]/50 transition-colors" 
                />
              </div>
            </div>

            <div className="flex gap-4 pt-4 border-t border-white/10">
              <button onClick={() => setShowKPIModal(false)} className="flex-1 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white text-[10px] font-black uppercase tracking-widest transition-colors">Cancel</button>
              <button onClick={addKPI} disabled={isSubmitting || !newKPI.title.trim()} className="flex-1 px-4 py-3 rounded-xl bg-[#FF6600] hover:bg-white text-black text-[10px] font-black uppercase tracking-widest transition-colors disabled:opacity-50">
                {isSubmitting ? 'Defining...' : 'Define KPI'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div className={\`fixed bottom-6 right-6 z-[500] px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border \${
          toast.type === 'error'
            ? 'bg-rose-500/10 text-rose-500 border-rose-500/20'
            : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
        }\`}>{toast.msg}</div>
      )}
`;
content = content.replace('</DashboardLayout>', `${kpiModalUI}\n    </DashboardLayout>`);

fs.writeFileSync(filepath, content);
console.log('Super Admin KPI modifications complete.');

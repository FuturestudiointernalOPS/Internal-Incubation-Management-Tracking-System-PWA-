'use client';

import React, { useState } from 'react';
import { Upload, FileText, Check, AlertCircle, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function BulkParticipantImporter({ programId, onComplete }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target.result;
      const lines = content.split('\n').filter(l => l.trim() !== '');
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      const parsed = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        const obj = {};
        headers.forEach((h, i) => obj[h] = values[i]);
        return obj;
      }).filter(p => p.email && p.name);

      setData(parsed);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    setLoading(true);
    let successCount = 0;
    try {
      for (const p of data) {
         const res = await fetch('/api/v2/participants', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
             ...p,
             program_id: programId,
             screening_status: 'accepted' // Default for mass upload
           })
         });
         const resJson = await res.json();
         if (resJson.success) successCount++;
      }
      alert(`Successfully synchronized ${successCount} node identities.`);
      onComplete();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
       {data.length === 0 ? (
          <div className="ios-card bg-white/[0.02] border-dashed border-white/10 py-16 text-center group transition-all hover:bg-white/[0.04]">
             <Upload className="w-12 h-12 text-slate-700 mx-auto mb-6 group-hover:text-indigo-400" />
             <p className="text-slate-500 font-black uppercase text-[10px] tracking-widest mb-6">Select Comma Separated Identity Ledger (CSV)</p>
             <input 
                type="file" 
                accept=".csv" 
                onChange={handleFile}
                className="hidden" 
                id="csv-upload" 
             />
             <label 
                htmlFor="csv-upload"
                className="btn-prime !py-3 !px-10 cursor-pointer"
             >
                Locate File
             </label>
             <p className="text-[9px] text-slate-800 font-bold mt-10">REQUIRED FIELDS: name, email</p>
          </div>
       ) : (
          <div className="space-y-6">
             <div className="ios-card !p-0 max-h-[300px] overflow-y-auto">
                <table className="executive-table text-left">
                   <thead className="sticky top-0 bg-[#0d0d18] z-20">
                      <tr>
                         <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-500">Name Node</th>
                         <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-500">Mail Vector</th>
                      </tr>
                   </thead>
                   <tbody>
                      {data.map((p, i) => (
                         <tr key={i}>
                            <td className="px-6 py-3 text-[10px] font-bold text-white uppercase">{p.name}</td>
                            <td className="px-6 py-3 text-[10px] font-bold text-slate-500">{p.email}</td>
                         </tr>
                      ))}
                   </tbody>
                </table>
             </div>
             
             <div className="flex gap-4">
                <button 
                  onClick={() => setData([])}
                  disabled={loading}
                  className="flex-1 btn-ghost !py-4"
                >
                   Flush Buffer
                </button>
                <button 
                  onClick={handleImport}
                  disabled={loading}
                  className="flex-1 btn-prime !py-4"
                >
                   {loading ? 'Synchronizing...' : `Deploy ${data.length} Nodes`}
                </button>
             </div>
          </div>
       )}
    </div>
  );
}

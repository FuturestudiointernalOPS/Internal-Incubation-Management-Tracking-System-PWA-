const fs = require('fs');
const filepath = 'src/app/pm/programs/[id]/page.js';
let lines = fs.readFileSync(filepath, 'utf8').split('\n');

// === FIX 1: Materials mapping (lines 1093-1097, 0-indexed: 1092-1096) ===
// Replace the old materials.map block that doesn't handle stringified JSON or uppercase NAME
const mapStart = lines.findIndex(l => l.includes('...materials.map(m =>'));
if (mapStart === -1) { console.error('Could not find materials.map'); process.exit(1); }
const mapEnd = lines.findIndex((l, i) => i > mapStart && l.trim().startsWith('...kbAssets.map'));
if (mapEnd === -1) { console.error('Could not find kbAssets.map'); process.exit(1); }

const newMapBlock = [
  '                             ...materials.map(m => {',
  '                                let item = m;',
  '                                // Handle stringified JSON inside array items',
  '                                if (typeof item === \'string\') {',
  '                                   try {',
  '                                      let p = JSON.parse(item);',
  '                                      if (typeof p === \'string\') p = JSON.parse(p);',
  '                                      if (Array.isArray(p)) item = p[0];',
  '                                      else item = p;',
  '                                   } catch(e) {}',
  '                                }',
  '                                if (Array.isArray(item)) item = item[0];',
  '                                if (item && typeof item === \'object\') {',
  '                                   return {',
  '                                      name: item.name || item.NAME || item.title || item.TITLE || \'Program Document\',',
  '                                      url: item.url || item.URL || item.path || item.PATH || \'\',',
  '                                      source: \'curriculum\'',
  '                                   };',
  '                                }',
  '                                if (typeof m === \'string\' && m.trim()) return { url: m, name: m.split(\'/\').pop(), source: \'curriculum\' };',
  '                                return null;',
  '                             }),'
];
lines.splice(mapStart, mapEnd - mapStart, ...newMapBlock);

// === FIX 2: Fix the filter to NOT remove items where url is empty/# but name exists ===
const filterIdx = lines.findIndex(l => l.includes('.filter(item => item && (item.url || item.path) && item.url !== "#"'));
if (filterIdx !== -1) {
  lines[filterIdx] = '                           ].filter(item => item && (item.name || item.url || item.path));';
}

// === FIX 3: Fix rawName to check uppercase NAME and TITLE ===
const rawNameIdx = lines.findIndex(l => l.includes("const rawName = typeof file === 'object'"));
if (rawNameIdx !== -1) {
  lines[rawNameIdx] = "                             const rawName = typeof file === 'object' ? (file.name || file.NAME || file.title || file.TITLE || (typeof (file.url || file.URL) === 'string' ? (file.url || file.URL).split('/').pop() : 'Program Document')) : (typeof file === 'string' ? file.split('/').pop() : 'Program Document');";
}

// === FIX 4: Fix the url extraction to check uppercase URL ===
const urlIdx = lines.findIndex(l => l.includes("const url = typeof file === 'object' ? (file.url || file.path)"));
if (urlIdx !== -1) {
  lines[urlIdx] = "                             const url = typeof file === 'object' ? (file.url || file.URL || file.path || '') : (typeof file === 'string' ? file : '');";
}

// === FIX 5: Don't filter out items with url="#" or empty url — just show the name ===
const filterNullIdx = lines.findIndex(l => l.includes('if (!url || url === "#") return null;'));
if (filterNullIdx !== -1) {
  lines[filterNullIdx] = '                             // Items without valid URL will still show name, OPEN will use in-app viewer';
}

// === FIX 6: Replace the entire button+OPEN block to make OPEN actually clickable ===
// Find the <button line and the closing </button> line
const btnOpenIdx = lines.findIndex(l => l.includes('<button') && l.includes('key={idx}'));
if (btnOpenIdx !== -1) {
  // Find closing </button> after it
  let btnCloseIdx = -1;
  for (let i = btnOpenIdx; i < lines.length; i++) {
    if (lines[i].includes('</button>')) { btnCloseIdx = i; break; }
  }
  if (btnCloseIdx !== -1) {
    const newRenderBlock = [
      '                               <div ',
      '                                 key={idx} ',
      '                                 className={`w-full flex items-center justify-between p-4 bg-[var(--bg-tertiary)] rounded-xl border transition-all group text-left ${isKB ? \'border-emerald-500/30 hover:border-emerald-500\' : \'border-[var(--border-primary)] hover:border-blue-500/50\'}`}',
      '                               >',
      '                                 <div className="flex items-center gap-3">',
      '                                   <div className={`p-2 rounded-lg ${isKB ? \'bg-emerald-500/10 text-emerald-500\' : \'bg-blue-500/10 text-blue-500\'}`}>',
      '                                     <FileText className="w-4 h-4" />',
      '                                   </div>',
      '                                   <div>',
      '                                     <span className="font-bold text-xs uppercase tracking-tight truncate max-w-[250px] block">',
      '                                       {name}',
      '                                     </span>',
      '                                     <span className={`text-[8px] font-black uppercase tracking-widest ${isKB ? \'text-emerald-500\' : \'text-blue-500\'}`}>',
      '                                       {isKB ? \'Knowledge Asset\' : \'Program Material\'}',
      '                                     </span>',
      '                                   </div>',
      '                                 </div>',
      '                                 <button',
      '                                   onClick={(e) => {',
      '                                      e.preventDefault();',
      '                                      e.stopPropagation();',
      '                                      if (url && url !== \'#\' && url !== \'\') {',
      '                                         window.open(url, \'_blank\');',
      '                                      } else {',
      '                                         setActivePDF({ url: url || \'#\', name });',
      '                                      }',
      '                                   }}',
      '                                   className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer ${isKB ? \'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-black border border-emerald-500/20\' : \'bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-black border border-blue-500/20\'}`}',
      '                                 >',
      '                                   OPEN',
      '                                 </button>',
      '                               </div>'
    ];
    lines.splice(btnOpenIdx, btnCloseIdx - btnOpenIdx + 1, ...newRenderBlock);
  }
}

fs.writeFileSync(filepath, lines.join('\n'));
console.log('All fixes applied successfully.');

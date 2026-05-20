const fs = require('fs');
const file = 'src/app/pm/programs/[id]/page.js';
let content = fs.readFileSync(file, 'utf8');

// 1. Title change
content = content.replace(/Strategic Materials\s*<\/h3>/g, 'Assigned Materials\n                    </h3>');

// 2. Change Chevron to OPEN button
content = content.replace(/<ChevronRight className=\{\`w-4 h-4 transition-colors[^\}]+\}\`\} \/>/g, '<div className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${isKB ? \\\'bg-emerald-500/10 text-emerald-500 group-hover:bg-emerald-500 group-hover:text-black border border-emerald-500/20\\\' : \\\'bg-blue-500/10 text-blue-500 group-hover:bg-blue-500 group-hover:text-black border border-blue-500/20\\\'}`}>OPEN</div>');

// 3. Fix JSON parsing for arrays that are stringified, and parse NAME as name
const mapRegex = /\.\.\.materials\.map\(m => \{\s*if \(typeof m === 'object' && m !== null\)[^}]*return null;\s*\}\),/g;
const replacement = `...materials.map(m => {
                                if (typeof m === 'string') {
                                   try { 
                                      let temp = JSON.parse(m);
                                      if (typeof temp === 'string') temp = JSON.parse(temp);
                                      if (Array.isArray(temp)) m = temp[0];
                                      else m = temp;
                                   } catch(e) {}
                                }
                                if (Array.isArray(m)) m = m[0];
                                if (typeof m === 'object' && m !== null) return { name: m.name || m.NAME || m.title || 'Document', url: m.url || m.URL || '#', source: 'curriculum' };
                                if (typeof m === 'string' && m.trim()) return { url: m, name: m.split('/').pop(), source: 'curriculum' };
                                return null;
                             }),`;
content = content.replace(mapRegex, replacement);

fs.writeFileSync(file, content);
console.log('Done');

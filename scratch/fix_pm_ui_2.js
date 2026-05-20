const fs = require('fs');
const file = 'src/app/pm/programs/[id]/page.js';
let content = fs.readFileSync(file, 'utf8');

const mapRegex = /\.\.\.materials\.map\(m => \{\s*if \(typeof m === 'object' && m !== null\) return \{ \.\.\.m, source: 'curriculum' \};\s*if \(typeof m === 'string' && m\.trim\(\)\) return \{ url: m, name: m\.split\('\/'\)\.pop\(\), source: 'curriculum' \};\s*return null;\s*\}\),/s;
const mapReplacement = `...materials.map(m => {
                                let item = m;
                                if (typeof m === 'string') {
                                   try {
                                      let parsed = JSON.parse(m);
                                      if (typeof parsed === 'string') parsed = JSON.parse(parsed);
                                      if (Array.isArray(parsed)) item = parsed[0];
                                      else item = parsed;
                                   } catch(e) {}
                                }
                                if (Array.isArray(item)) item = item[0];
                                if (item && typeof item === 'object') {
                                   return {
                                      name: item.name || item.NAME || item.title || 'Program Document',
                                      url: item.url || item.URL || '#',
                                      source: 'curriculum'
                                   };
                                }
                                if (typeof m === 'string' && m.trim()) return { url: m, name: m.split('/').pop(), source: 'curriculum' };
                                return null;
                             }),`;
content = content.replace(mapRegex, mapReplacement);

const buttonRegex = /<button \n\s*key=\{idx\} \n\s*onClick=\{\(e\) => \{\n\s*e\.preventDefault\(\);\n\s*setActivePDF\(\{ url, name \}\);\n\s*\}\}\n\s*className=\{\`w-full flex items-center justify-between p-4 bg-\[var\(--bg-tertiary\)\] rounded-xl border transition-all group text-left \$\{isKB \? 'border-emerald-500\/30 hover:border-emerald-500' : 'border-\[var\(--border-primary\)\] hover:border-blue-500\/50'\}\`\}\n\s*>/;
const buttonReplacement = `<div 
                                 key={idx} 
                                 className={\`w-full flex items-center justify-between p-4 bg-[var(--bg-tertiary)] rounded-xl border transition-all group text-left \${isKB ? 'border-emerald-500/30 hover:border-emerald-500' : 'border-[var(--border-primary)] hover:border-blue-500/50'}\`}
                               >`;
content = content.replace(buttonRegex, buttonReplacement);

const chevronRegex = /<div className=\{\`px-4 py-2 rounded-xl text-\[9px\] font-black uppercase tracking-widest transition-all \$\{isKB \? 'bg-emerald-500\/10 text-emerald-500 group-hover:bg-emerald-500 group-hover:text-black border border-emerald-500\/20' : 'bg-blue-500\/10 text-blue-500 group-hover:bg-blue-500 group-hover:text-black border border-blue-500\/20'\}\`\}>OPEN<\/div>\n\s*<\/button>/;
const openReplacement = `<button 
                                    onClick={(e) => {
                                       e.preventDefault();
                                       e.stopPropagation();
                                       setActivePDF({ url, name });
                                    }}
                                    className={\`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer \${isKB ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-black border border-emerald-500/20' : 'bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-black border border-blue-500/20'}\`}
                                 >
                                    OPEN
                                 </button>
                               </div>`;
content = content.replace(chevronRegex, openReplacement);

fs.writeFileSync(file, content);
console.log('Done');

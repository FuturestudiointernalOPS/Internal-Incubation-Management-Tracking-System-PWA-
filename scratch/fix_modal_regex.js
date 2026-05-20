const fs = require('fs');
const filepath = 'src/app/pm/programs/[id]/page.js';
let content = fs.readFileSync(filepath, 'utf8');

const replacement = `<div 
                                 key={idx} 
                                 className={\`w-full flex items-center justify-between p-4 bg-[var(--bg-tertiary)] rounded-xl border transition-all group text-left \${isKB ? 'border-emerald-500/30 hover:border-emerald-500' : 'border-[var(--border-primary)] hover:border-blue-500/50'}\`}
                               >
                                 <div className="flex items-center gap-3">
                                   <div className={\`p-2 rounded-lg \${isKB ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-500'}\`}>
                                     <FileText className="w-4 h-4" />
                                   </div>
                                   <div>
                                     <span className="font-bold text-xs uppercase tracking-tight truncate max-w-[200px] block">
                                       {name}
                                     </span>
                                     <span className={\`text-[8px] font-black uppercase tracking-widest \${isKB ? 'text-emerald-500' : 'text-blue-500'}\`}>
                                       {isKB ? 'Knowledge Asset' : 'Program Material'}
                                     </span>
                                   </div>
                                 </div>
                                 <button 
                                   onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setActivePDF({ url: url || '#', name });
                                   }}
                                   className={\`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer \${isKB ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-black border border-emerald-500/20' : 'bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-black border border-blue-500/20'}\`}
                                 >
                                   OPEN
                                 </button>
                               </div>`;

const regex = /<button\s*key={idx}\s*onClick={\(e\)\s*=>\s*{\s*e\.preventDefault\(\);\s*setActivePDF\({ url, name }\);\s*}}[\s\S]*?OPEN<\/div>\s*<\/button>/m;

if (regex.test(content)) {
    content = content.replace(regex, replacement);
    fs.writeFileSync(filepath, content);
    console.log('Replaced via regex.');
} else {
    console.log('Regex did not match. Looking for the button block...');
    const startIdx = content.indexOf('<button \n                                 key={idx}');
    if (startIdx !== -1) {
        const endStr = 'OPEN</div>\n                               </button>';
        const endIdx = content.indexOf(endStr, startIdx);
        if (endIdx !== -1) {
            const finalContent = content.substring(0, startIdx) + replacement + content.substring(endIdx + endStr.length);
            fs.writeFileSync(filepath, finalContent);
            console.log('Replaced via indexOf match.');
        } else {
            console.log('Could not find end string.');
        }
    } else {
        console.log('Could not find start string.');
    }
}

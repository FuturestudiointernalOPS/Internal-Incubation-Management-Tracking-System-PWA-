const fs = require('fs');
const filepath = 'src/app/pm/programs/[id]/page.js';
let content = fs.readFileSync(filepath, 'utf8');

// Find the start of the button block
const buttonStart = content.indexOf('<button \n                                 key={idx} \n                                 onClick={(e) => {\n                                    e.preventDefault();\n                                    setActivePDF({ url, name });\n                                 }}');

if (buttonStart !== -1) {
    // We replace the outer <button with <div
    let replaced = content.replace(
        '<button \n                                 key={idx} \n                                 onClick={(e) => {\n                                    e.preventDefault();\n                                    setActivePDF({ url, name });\n                                 }}',
        '<div \n                                 key={idx} '
    );
    // Replace the closing </button> with </div>
    // We only want to replace the first </button> after the buttonStart
    const buttonEnd = replaced.indexOf('</button>', buttonStart);
    if (buttonEnd !== -1) {
        replaced = replaced.substring(0, buttonEnd) + '</div>' + replaced.substring(buttonEnd + 9);
    }
    
    // Now replace the OPEN div with a proper button
    const openDivStr = '<div className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${isKB ? \'bg-emerald-500/10 text-emerald-500 group-hover:bg-emerald-500 group-hover:text-black border border-emerald-500/20\' : \'bg-blue-500/10 text-blue-500 group-hover:bg-blue-500 group-hover:text-black border border-blue-500/20\'}`}>OPEN</div>';
    
    const openBtnStr = `<button 
                                   onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setActivePDF({ url: url || '#', name });
                                   }}
                                   className={\`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer \${isKB ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-black border border-emerald-500/20' : 'bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-black border border-blue-500/20'}\`}
                                 >
                                   OPEN
                                 </button>`;
                                 
    replaced = replaced.replace(openDivStr, openBtnStr);
    
    fs.writeFileSync(filepath, replaced);
    console.log("Replaced successfully using exact string match.");
} else {
    console.log("Could not find the button wrapper string. Trying regex...");
    
    // Fallback if formatting differs slightly
    let modified = false;
    let lines = content.split('\\n');
    let inButton = false;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('<button') && lines[i+1] && lines[i+1].includes('key={idx}')) {
            lines[i] = lines[i].replace('<button', '<div');
            // Remove the onClick lines
            lines.splice(i+2, 4); 
            inButton = true;
            break;
        }
    }
    if (inButton) {
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('OPEN</div>')) {
                const isKBStr = lines[i].includes('isKB ?') ? lines[i].match(/\\\$\\{isKB[^}]+\\}/)[0] : '';
                lines[i] = `                                 <button 
                                   onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setActivePDF({ url: url || '#', name });
                                   }}
                                   className={\`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer \${isKB ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-black border border-emerald-500/20' : 'bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-black border border-blue-500/20'}\`}
                                 >
                                   OPEN
                                 </button>`;
                
                // Find closing button
                for (let j = i + 1; j < lines.length; j++) {
                    if (lines[j].includes('</button>')) {
                        lines[j] = lines[j].replace('</button>', '</div>');
                        break;
                    }
                }
                modified = true;
                break;
            }
        }
    }
    
    if (modified) {
        fs.writeFileSync(filepath, lines.join('\\n'));
        console.log("Replaced using lines fallback.");
    } else {
        console.log("Failed to replace.");
    }
}

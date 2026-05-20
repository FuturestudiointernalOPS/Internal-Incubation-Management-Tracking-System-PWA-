const fs = require('fs');
const filepath = 'src/app/pm/programs/[id]/page.js';
let lines = fs.readFileSync(filepath, 'utf8').split('\n');

// Find the activePDF block start
let startIdx = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('{activePDF && (') && lines[i-1] && lines[i-1].includes('</div>')) {
    startIdx = i;
    break;
  }
}

if (startIdx !== -1) {
  // Find the end of activePDF block
  let endIdx = -1;
  let bracketCount = 0;
  for (let i = startIdx; i < lines.length; i++) {
    if (lines[i].includes('}')) {
      // Very naive, but we know it ends with `)}` at the same indentation level
      if (lines[i].trim() === ')}') {
        endIdx = i;
        break;
      }
    }
  }

  if (endIdx === -1) {
    // Manually find the end of the block since the naive way might fail
    for (let i = startIdx; i < startIdx + 50; i++) {
       if (lines[i].trim() === ')}' && lines[i-1].includes('</div>')) {
          endIdx = i;
          break;
       }
    }
  }

  if (endIdx !== -1) {
    // Extract the block
    const pdfBlock = lines.splice(startIdx, endIdx - startIdx + 1);

    // Now find the TOAST comment to insert before it
    let toastIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('{/* TOAST */}')) {
        toastIdx = i;
        break;
      }
    }

    if (toastIdx !== -1) {
      // Modify the pdfBlock to be a fixed full-screen modal instead of inline since it was inline in reports
      const modalBlock = [
        '      {/* PDF VIEWER MODAL */}',
        '      {activePDF && (',
        '        <div className="fixed inset-0 z-[600] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in">',
        '          <div className="card w-full max-w-5xl h-[90vh] flex flex-col space-y-4 shadow-2xl border-[var(--border-primary)]" onClick={e => e.stopPropagation()}>',
        '            <div className="flex items-center justify-between border-b border-[var(--border-primary)] pb-4">',
        '              <div className="flex items-center gap-3">',
        '                <div className="p-2 rounded-lg bg-[var(--brand-orange)]/10 text-[var(--brand-orange)]">',
        '                  <FileText className="w-5 h-5" />',
        '                </div>',
        '                <div>',
        '                  <h3 className="text-base font-black uppercase text-[var(--text-primary)]">{activePDF.name}</h3>',
        '                  <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">Document Preview</p>',
        '                </div>',
        '              </div>',
        '              <div className="flex gap-2">',
        '                 <a href={activePDF.url} target="_blank" rel="noreferrer" className="btn btn-secondary !py-2 text-[10px] gap-2">',
        '                    <ExternalLink className="w-4 h-4" /> Open in New Tab',
        '                 </a>',
        '                 <button onClick={() => setActivePDF(null)} className="btn btn-secondary !py-2 hover:bg-rose-500/10 hover:text-rose-500 border-none">',
        '                    <X className="w-5 h-5" />',
        '                 </button>',
        '              </div>',
        '            </div>',
        '            <div className="flex-1 bg-[var(--bg-tertiary)] rounded-xl overflow-hidden border border-[var(--border-primary)]">',
        '               <iframe src={`${activePDF.url}#toolbar=0`} className="w-full h-full" title="PDF Viewer" />',
        '            </div>',
        '          </div>',
        '        </div>',
        '      )}',
        ''
      ];

      lines.splice(toastIdx, 0, ...modalBlock);
      fs.writeFileSync(filepath, lines.join('\\n'));
      console.log('Moved activePDF block successfully.');
    } else {
      console.log('Could not find TOAST comment.');
    }
  } else {
    console.log('Could not find end of activePDF block.');
  }
} else {
  console.log('Could not find activePDF block.');
}

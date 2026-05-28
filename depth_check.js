const fs = require('fs');
const lines = fs.readFileSync('src/app/pm/programs/[id]/page.js', 'utf8').split('\n');

// Track JSX element depth from the return statement
let depth = 0;
let returnFound = false;
const log = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const lineNum = i + 1;
  
  if (!returnFound && line.includes('return (')) {
    returnFound = true;
  }
  if (!returnFound) continue;
  
  // Count opening and closing tags (simple heuristic, not perfect)
  // Count <div, <section, <main, <header, <footer, <article, <aside, <nav, <span, <p, <table, <thead, <tbody, <tr, <td, <th, <ul, <ol, <li, <button, <input, <select, <option, <textarea, <form, <label
  const opens = (line.match(/<(?:div|section|main|header|footer|article|aside|nav|table|thead|tbody|tr|td|th|ul|ol|li|form)[\s>]/g) || []).length;
  const closes = (line.match(/<\/(?:div|section|main|header|footer|article|aside|nav|table|thead|tbody|tr|td|th|ul|ol|li|form)>/g) || []).length;
  const selfClose = (line.match(/<(?:div|section)[^>]*\/>/g) || []).length;
  
  const net = opens - closes - selfClose;
  if (net !== 0) {
    depth += net;
    log.push(`Line ${lineNum} (depth=${depth}): [+${opens}/-${closes}] ${line.trim().substring(0, 80)}`);
  }
  
  // Stop a bit past the error
  if (lineNum > 2280) break;
}

// Print last 50 entries
const start = Math.max(0, log.length - 60);
log.slice(start).forEach(l => console.log(l));
console.log('\nFinal depth at line 2280:', depth);

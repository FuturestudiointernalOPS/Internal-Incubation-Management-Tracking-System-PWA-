const fs = require('fs');
let content = fs.readFileSync('src/app/pm/programs/[id]/page.js', 'utf-8');
let depth = 0;
let inStr = false, chr = '';
let line = 1;

for (let i = 0; i < content.length; i++) {
  const c = content[i];
  const p = i > 0 ? content[i-1] : '';
  if (c === '\n') line++;
  
  if (inStr) {
    if (c === chr && p !== '\\') inStr = false;
  } else {
    if (c === '"' || c === "'") { inStr = true; chr = c; }
    else if (c === '{') depth++;
    else if (c === '}') depth--;
  }
  
  if (i > content.length - 2000 && (c === '{' || c === '}')) {
    // Track depth in the last 2000 chars
  }
}
console.log('Final depth (outside strings):', depth);

// Find the extra unclosed brace
depth = 0; inStr = false; chr = ''; line = 1;
let lastUnclosed = -1;
let lastUnclosedLine = 0;
for (let i = 0; i < content.length; i++) {
  const c = content[i];
  const p = i > 0 ? content[i-1] : '';
  if (c === '\n') line++;
  
  if (inStr) {
    if (c === chr && p !== '\\') inStr = false;
  } else {
    if (c === '"' || c === "'") { inStr = true; chr = c; }
    else if (c === '{') {
      depth++;
      if (depth > 0) { lastUnclosed = i; lastUnclosedLine = line; }
    }
    else if (c === '}') depth--;
  }
}
console.log('Last unclosed { at line:', lastUnclosedLine);

const fs = require('fs');
const content = fs.readFileSync('src/app/pm/programs/[id]/page.js', 'utf-8');
let depth = 0;
let inStr = false, chr = '';
let result = '';

for (let i = 0; i < content.length; i++) {
  const c = content[i];
  const p = i > 0 ? content[i-1] : '';
  
  if (inStr) {
    result += c;
    if (c === chr && p !== '\\') inStr = false;
  } else {
    if (c === '"' || c === "'") { inStr = true; chr = c; result += c; }
    else if (c === '{') {
      // Check if removing this { would make the rest of the file balance
      const rest = content.substring(i+1);
      const depthAfter = depth;
      let restDepth = depthAfter;
      let inStr2 = false, chr2 = '';
      for (let j = 0; j < rest.length; j++) {
        const rc = rest[j];
        const rp = j > 0 ? rest[j-1] : '';
        if (inStr2) { if (rc === chr2 && rp !== '\\') inStr2 = false; }
        else {
          if (rc === '"' || rc === "'") { inStr2 = true; chr2 = rc; }
          else if (rc === '{') restDepth++;
          else if (rc === '}') restDepth--;
        }
      }
      // If removing this { would make the final depth 0, remove it
      if (restDepth === 0) {
        // Skip this character - remove the extra {
        console.log('Removed extra { at position', i, 'line', content.substring(0,i).split('\n').length);
        continue;
      }
      depth++;
      result += c;
    } else {
      if (c === '}') depth--;
      result += c;
    }
  }
}

const finalContent = result;
const newDepth = (finalContent.match(/\{/g)||[]).length - (finalContent.match(/\}/g)||[]).length;
console.log('New depth:', newDepth);

if (newDepth === 0) {
  fs.writeFileSync('src/app/pm/programs/[id]/page.js', finalContent);
  console.log('File fixed and saved!');
} else if (newDepth < 0) {
  console.log('Too many removals, restoring original');
} else {
  console.log('Could not fix automatically');
}

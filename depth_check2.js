const fs = require('fs');
const lines = fs.readFileSync('src/app/pm/programs/[id]/page.js', 'utf8').split('\n');

// From the return at line 746, track ALL JSX open/close tags  
let depth = 0;
let returnFound = false;

for (let i = 745; i < Math.min(lines.length, 2270); i++) {
  const line = lines[i];
  const lineNum = i + 1;
  
  // Count ALL opening JSX tags (but skip self-closing ones)
  const openMatches = line.match(/<[A-Za-z][A-Za-z0-9.]*/g) || [];
  const closeMatches = line.match(/<\/[A-Za-z][A-Za-z0-9.]*/g) || [];
  const selfCloseCount = (line.match(/\/>/g) || []).length;
  
  // Filter out things inside strings/attributes by checking if < is likely a comparison
  // Simple approach: count them all
  const opens = openMatches.length - selfCloseCount;
  const closes = closeMatches.length;
  
  const prevDepth = depth;
  depth += opens - closes;
  
  if (opens > 0 || closes > 0) {
    if (lineNum >= 2240 || depth <= 3) {
      console.log(`L${lineNum} depth: ${prevDepth} -> ${depth} (open=${openMatches.length}, close=${closes}, selfClose=${selfCloseCount}) | ${line.trim().substring(0, 90)}`);
    }
  }
}

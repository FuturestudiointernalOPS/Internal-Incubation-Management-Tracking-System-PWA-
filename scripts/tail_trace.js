const fs = require('fs');
const content = fs.readFileSync('src/app/pm/programs/[id]/page.js', 'utf-8');
let depth = 0;
const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
  const opens = (lines[i].match(/\{/g) || []).length;
  const closes = (lines[i].match(/\}/g) || []).length;
  depth += opens - closes;
  if (i >= lines.length - 30) {
    console.log('L' + (i+1) + ' depth=' + depth + ' ' + lines[i].trim().substring(0, 80));
  }
}

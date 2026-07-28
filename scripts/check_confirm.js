const cp = require('child_process');
const diff = cp.execSync('git diff 5c6d83d HEAD -- "src/app/pm/programs/[id]/page.js"', {encoding:'utf-8'});
const lines = diff.split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++')).map(l => l.substring(1));
let inConfirm = false;
let first = true;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('Confirmation Modal')) inConfirm = true;
  if (inConfirm) {
    const opens = (lines[i].match(/\{/g) || []).length;
    const closes = (lines[i].match(/\}/g) || []).length;
    if (opens !== closes) {
      console.log(`L${i} opens=${opens} closes=${closes}: ${lines[i].substring(0,100)}`);
    }
  }
}

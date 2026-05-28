const fs = require('fs');
const path = require('path');

const parserPath = path.join(__dirname, 'node_modules', '@babel', 'parser');
let parse;
try {
  parse = require(parserPath).parse;
} catch(e) {
  try {
    parse = require('node_modules/next/node_modules/@babel/parser').parse;
  } catch(e2) {
    console.error('Cannot find babel parser:', e2.message);
    process.exit(1);
  }
}

const src = fs.readFileSync('src/app/pm/programs/[id]/page.js', 'utf8');

try {
  parse(src, {
    sourceType: 'module',
    plugins: ['jsx', 'optionalChaining', 'nullishCoalescingOperator', 'classProperties', 'dynamicImport'],
    errorRecovery: true,
  });
  console.log('No fatal parse errors');
} catch(err) {
  console.log('Parse error at line', err.loc?.line, 'col', err.loc?.column);
  console.log('Message:', err.message);
  const lines = src.split('\n');
  const errLine = err.loc?.line;
  if (errLine) {
    for (let i = Math.max(0, errLine - 5); i < Math.min(lines.length, errLine + 5); i++) {
      console.log((i+1) + ': ' + lines[i]);
    }
  }
}

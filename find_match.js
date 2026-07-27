const fs = require("fs");
const code = fs.readFileSync(
  "src/app/pm/programs/[id]/page.js",
  "utf8"
);
const lines = code.split("\n");

// Find lines 5245-5247 content
console.log("Line 5244:", lines[5243]);
console.log("Line 5245:", lines[5244]);
console.log("Line 5246:", lines[5245]);
console.log("Line 5247:", lines[5246]);

// Walk backwards from 5244 to find matching opens
let depth = 0;
let depth2 = 0;
let depth3 = 0;

// First, find what ")}" at 5246 closes
for (let i = 5245; i >= 0; i--) {
  const line = lines[i];
  for (let j = line.length - 1; j >= 0; j--) {
    const ch = line[j];
    if (ch === ")") depth++;
    if (ch === "(") {
      depth--;
      if (depth === -1) {
        // Found the opening (
        // Now look for the accompanying {
        let braceDepth = 0;
        for (let k = line.length - 1; k >= 0; k--) {
          if (line[k] === "}") braceDepth++;
          if (line[k] === "{") {
            braceDepth--;
            if (braceDepth === -1) {
              console.log(
                `Line 5246 ")}" closes JSX expression at line ${i + 1}: ${line.trim().substring(0, 80)}`
              );
              depth = 999999;
              break;
            }
          }
        }
        break;
      }
    }
  }
  if (depth === 999999) break;
}

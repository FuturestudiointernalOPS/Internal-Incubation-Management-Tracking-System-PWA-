/**
 * Replace Tailwind arbitrary value CSS variable patterns with custom utility classes.
 *
 * bg-[var(--bg-primary)]   → bg-primary
 * bg-[var(--bg-secondary)] → bg-secondary
 * bg-[var(--bg-tertiary)]  → bg-tertiary
 *
 * Run: node scripts/replace_bg_vars.mjs
 */
import fs from "fs";
import path from "path";

const root = process.cwd();
const srcDir = path.join(root, "src");

const replacements = [
  { from: /bg-\[var\(--bg-primary\)\]/g, to: "bg-primary" },
  { from: /bg-\[var\(--bg-secondary\)\]/g, to: "bg-secondary" },
  { from: /bg-\[var\(--bg-tertiary\)\]/g, to: "bg-tertiary" },
];

function walkDir(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (
      entry.isDirectory() &&
      !entry.name.startsWith(".") &&
      entry.name !== "node_modules" &&
      entry.name !== ".next"
    ) {
      files.push(...walkDir(fullPath));
    } else if (
      entry.isFile() &&
      (fullPath.endsWith(".js") || fullPath.endsWith(".jsx"))
    ) {
      files.push(fullPath);
    }
  }
  return files;
}

const files = walkDir(srcDir);
let totalChanges = 0;

for (const file of files) {
  let content = fs.readFileSync(file, "utf8");
  let changed = false;

  for (const { from, to } of replacements) {
    const newContent = content.replace(from, to);
    if (newContent !== content) {
      content = newContent;
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(file, content, "utf8");
    const changes = replacements.reduce((count, { from }) => {
      return count + (content.match(from) || []).length;
    }, 0);
    totalChanges++;
    const relativePath = path.relative(root, file);
    console.log(`  ✓ ${relativePath}`);
  }
}

console.log(
  `\n✅ Updated ${totalChanges} files with bg-primary/secondary/tertiary utility classes.`,
);
console.log(
  "   Run the build to verify the Turbopack CSS parsing issue is resolved.",
);

#!/usr/bin/env node
/**
 * Line Limit Guardrail
 *
 * Enforces file size limits, source AND test files alike:
 * - Hard ceiling: 600 lines (error)
 * - Soft target: 500 lines (warning)
 *
 * Test files are held to the same limits: a suite that outgrows the budget is
 * split by concern and shares its fixtures through `src/__tests__/helpers/`,
 * exactly like a source file.
 *
 * Usage:
 *   node scripts/check-line-limits.mjs           # warning mode (default)
 *   node scripts/check-line-limits.mjs --block   # blocking mode
 *   node scripts/check-line-limits.mjs --update  # update debt list
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { globSync } from "glob";
import { resolve } from "path";

const DEBT_FILE = resolve(process.cwd(), "scripts/line-limit-debt.json");
const HARD_LIMIT = 600;
const SOFT_LIMIT = 500;

const EXTENSIONS = ["js", "jsx", "ts", "tsx"];
const IGNORE_PATTERNS = [
  "**/*.db",
  "**/migrations/**",
  "**/*.config.js",
];

function getTrackedFiles() {
  const files = [];
  for (const ext of EXTENSIONS) {
    const matches = globSync(`src/**/*.${ext}`, { ignore: IGNORE_PATTERNS });
    files.push(...matches);
  }
  return [...new Set(files)].sort();
}

function countLines(filePath) {
  const content = readFileSync(filePath, "utf-8");
  return content.split("\n").length;
}

function loadDebtList() {
  if (existsSync(DEBT_FILE)) {
    return JSON.parse(readFileSync(DEBT_FILE, "utf-8"));
  }
  return [];
}

function saveDebtList(debtList) {
  writeFileSync(DEBT_FILE, JSON.stringify(debtList, null, 2));
}

function main() {
  const args = process.argv.slice(2);
  const blockMode = args.includes("--block");
  const updateMode = args.includes("--update");

  const files = getTrackedFiles();
  const debtList = loadDebtList();
  const currentOverHard = [];
  const currentOverSoft = [];
  let errors = 0;
  let warnings = 0;

  console.log(`\n📏 Line Limit Guardrail (${blockMode ? "BLOCKING" : "WARNING"} mode)`);
  console.log(`   Hard limit: ${HARD_LIMIT} lines | Soft limit: ${SOFT_LIMIT} lines`);
  console.log(`   Scanning ${files.length} files (source + tests)...\n`);

  for (const file of files) {
    const lines = countLines(file);
    const relPath = file.replace(process.cwd() + "/", "");

    if (lines > HARD_LIMIT) {
      currentOverHard.push({ file: relPath, lines });
      errors++;
      console.log(`❌ ${relPath}: ${lines} lines (OVER HARD LIMIT ${HARD_LIMIT})`);
    } else if (lines > SOFT_LIMIT) {
      currentOverSoft.push({ file: relPath, lines });
      warnings++;
      console.log(`⚠️  ${relPath}: ${lines} lines (over soft limit ${SOFT_LIMIT})`);
    }
  }

  // Update debt list if requested
  if (updateMode) {
    const newDebt = currentOverHard.map((d) => d.file).sort();
    saveDebtList(newDebt);
    console.log(`\n📝 Updated debt list: ${newDebt.length} files over ${HARD_LIMIT} lines`);
  }

  // Check for new violations (files not in debt list but over hard limit)
  const debtSet = new Set(debtList);
  const newViolations = currentOverHard.filter((d) => !debtSet.has(d.file));
  if (newViolations.length > 0) {
    console.log(`\n🚨 NEW VIOLATIONS (not in debt list):`);
    for (const v of newViolations) {
      console.log(`   ${v.file}: ${v.lines} lines`);
    }
    errors += newViolations.length;
  }

  // Check for resolved debts
  const resolved = debtList.filter((f) => !currentOverHard.some((d) => d.file === f));
  if (resolved.length > 0) {
    console.log(`\n✅ RESOLVED (now under ${HARD_LIMIT} lines):`);
    for (const f of resolved) {
      console.log(`   ${f}`);
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Files over ${HARD_LIMIT}: ${currentOverHard.length} (${newViolations.length} new)`);
  console.log(`   Files over ${SOFT_LIMIT}: ${currentOverSoft.length}`);
  console.log(`   Debt list size: ${debtList.length}`);
  console.log(`   Errors: ${errors} | Warnings: ${warnings}`);

  if (blockMode && errors > 0) {
    console.log(`\n💥 BLOCKING: ${errors} error(s) - fix files over ${HARD_LIMIT} lines`);
    process.exit(1);
  }

  if (warnings > 0 && !blockMode) {
    console.log(`\n⚠️  ${warnings} file(s) over soft limit (${SOFT_LIMIT} lines)`);
  }

  if (errors === 0 && warnings === 0) {
    console.log(`\n✅ All files within limits!`);
  }
}

main();
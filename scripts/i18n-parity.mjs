#!/usr/bin/env node
/**
 * i18n parity checker — compares src/locales/en/ against src/locales/fr/.
 *
 * Reports:
 *   ❌ MISSING   — key exists in EN but not in FR (silently falls back to English)
 *   ⚠️  IDENTICAL — key exists in FR but value equals EN (likely untranslated)
 *   🗑  OBSOLETE  — key exists in FR but not in EN (dead key)
 *
 * Usage:
 *   node scripts/i18n-parity.mjs          # human-readable report
 *   node scripts/i18n-parity.mjs --fix    # remove obsolete keys from fr/*.json
 *   node scripts/i18n-parity.mjs --json   # machine-readable output (for CI)
 *
 * Exit code: 1 if any MISSING keys found (safe to use in CI / pre-commit).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = path.resolve(__dirname, "../src/locales");
const EN_DIR = path.join(LOCALES_DIR, "en");
const FR_DIR = path.join(LOCALES_DIR, "fr");

const args = process.argv.slice(2);
const doFix = args.includes("--fix");
const asJson = args.includes("--json");

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch (error) {
    console.error(`⚠️  Could not read ${file}: ${error.message}`);
    return null;
  }
}

// Flatten nested object into { "a.b.c": value }
function flatten(obj, prefix = "", out = {}) {
  for (const [key, value] of Object.entries(obj || {})) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      flatten(value, full, out);
    } else {
      out[full] = value;
    }
  }
  return out;
}

// Rebuild nested object from a flat map (used by --fix to rewrite files)
function nest(flat) {
  const root = {};
  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split(".");
    let current = root;
    for (let index = 0; index < parts.length - 1; index++) {
      current[parts[index]] = current[parts[index]] || {};
      current = current[parts[index]];
    }
    current[parts[parts.length - 1]] = value;
  }
  return root;
}

const report = { files: {}, missing: 0, identical: 0, obsolete: 0 };

for (const file of fs.readdirSync(EN_DIR).filter((fileName) => fileName.endsWith(".json"))) {
  const enPath = path.join(EN_DIR, file);
  const frPath = path.join(FR_DIR, file);
  const en = readJson(enPath);
  if (!en) continue;
  const fr = readJson(frPath);
  if (!fr) {
    const count = Object.keys(flatten(en)).length;
    report.files[file] = { missing: count, identical: 0, obsolete: 0 };
    report.missing += count;
    continue;
  }

  const enFlat = flatten(en);
  const frFlat = flatten(fr);
  const frKeys = new Set(Object.keys(frFlat));

  const missing = Object.keys(enFlat).filter((key) => !frKeys.has(key));
  const identical = Object.keys(enFlat).filter(
    (key) =>
      frKeys.has(key) &&
      String(frFlat[key]) === String(enFlat[key]) &&
      String(enFlat[key]).trim() !== "",
  );
  const obsolete = Object.keys(frFlat).filter((key) => !(key in enFlat));

  report.files[file] = { missing, identical, obsolete };
  report.missing += missing.length;
  report.identical += identical.length;
  report.obsolete += obsolete.length;

  if (doFix && obsolete.length > 0) {
    for (const key of obsolete) delete frFlat[key];
    fs.writeFileSync(
      frPath,
      JSON.stringify(nest(frFlat), null, 2) + "\n",
      "utf-8",
    );
    console.log(`🧹 ${file}: removed ${obsolete.length} obsolete key(s)`);
  }
}

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  for (const [file, fileReport] of Object.entries(report.files)) {
    const lines = [];
    for (const key of fileReport.missing || []) lines.push(`  ❌ MISSING   ${key}`);
    for (const key of fileReport.identical || []) lines.push(`  ⚠️  IDENTICAL ${key}`);
    for (const key of fileReport.obsolete || []) lines.push(`  🗑  OBSOLETE  ${key}`);
    if (lines.length) {
      console.log(`\n📄 ${file}`);
      console.log(lines.join("\n"));
    }
  }
  console.log(`\n═══ SUMMARY ═══`);
  console.log(`  ❌ Missing:   ${report.missing}`);
  console.log(`  ⚠️  Identical: ${report.identical}`);
  console.log(`  🗑  Obsolete:  ${report.obsolete}`);
  if (doFix) console.log("  (--fix applied for obsolete keys)");
}

process.exit(report.missing > 0 ? 1 : 0);

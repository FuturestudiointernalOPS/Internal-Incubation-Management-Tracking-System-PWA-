// Verification for the RFC 4180-aware CSV parser used by the import flow.
import { parseCSVRows, rowsToCsv } from "../src/lib/csv.js";

let failed = 0;
function check(label, got, expect) {
  const ok = JSON.stringify(got) === JSON.stringify(expect);
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"} — ${label}`);
  if (!ok) {
    console.log("      got:    ", JSON.stringify(got));
    console.log("      expect: ", JSON.stringify(expect));
  }
}

// 1. Simple file
check(
  "simple 2-row file",
  parseCSVRows("Name,Email\nAlice,a@x.com\nBob,b@x.com\n"),
  [
    ["Name", "Email"],
    ["Alice", "a@x.com"],
    ["Bob", "b@x.com"],
  ]
);

// 2. THE BUG: multi-line cell must stay ONE row, not explode into phantom rows
const multiLine = 'Name,Answer\n"Alice","Line one\nLine two\nLine three"\n"Bob","Short"\n';
const multiParsed = parseCSVRows(multiLine);
check(
  "multi-line cells do not create phantom rows (3 logical rows)",
  multiParsed.length,
  3
);
check(
  "multi-line cell keeps its newlines",
  multiParsed[1][1],
  "Line one\nLine two\nLine three"
);

// 3. Escaped quotes inside a cell
check(
  'escaped quotes ("")',
  parseCSVRows('"A","He said ""hi"""\n')[0],
  ["A", 'He said "hi"']
);

// 4. Commas inside quotes stay in the cell
check(
  "commas inside quotes",
  parseCSVRows('"A","one, two, three"\n')[0],
  ["A", "one, two, three"]
);

// 5. CRLF endings
check(
  "CRLF endings",
  parseCSVRows("Name,Email\r\nAlice,a@x.com\r\n"),
  [
    ["Name", "Email"],
    ["Alice", "a@x.com"],
  ]
);

// 6. Trailing empty row dropped
check(
  "trailing newline does not create an empty row",
  parseCSVRows("Name,Email\nAlice,a@x.com\n").length,
  2
);

// 7. rowsToCsv round trip preserves multi-line cells
const grid = [
  ["Name", "Answer"],
  ["Alice", "Line one\nLine two"],
  ["Bob", "one, two"],
];
const roundTrip = parseCSVRows(rowsToCsv(grid));
check("rowsToCsv round trip", roundTrip, grid);

// 8. 548-row scenario: rows with embedded newlines still count as 548
{
  const header = "Name,Email,Answer";
  const rowText = '"Person X","x@y.com","First line\nsecond line\nthird line"';
  const big = [header, ...Array(548).fill(rowText)].join("\n") + "\n";
  const parsed = parseCSVRows(big);
  check("548 logical rows (with multi-line cells) parse as 548 rows", parsed.length, 549);
}

console.log(failed === 0 ? "\nALL TESTS PASSED" : `\n${failed} TEST(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);

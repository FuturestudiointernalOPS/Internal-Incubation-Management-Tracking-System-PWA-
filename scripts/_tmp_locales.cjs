const fs = require("fs");
const nl = "\r\n";

// EN
const en = "src/locales/en/platformMisc.json";
let s = fs.readFileSync(en, "utf8");
if (!s.includes('"submissionsForRun"')) {
  s = s.replace(
    '"submissionsAcrossRuns": "{count} submissions across {runs} runs",',
    '"submissionsAcrossRuns": "{count} submissions across {runs} runs",' +
      nl +
      '      "submissionsForRun": "{count} submissions for \\"{name}\\"",' +
      nl +
      '      "back": "Back",',
  );
  fs.writeFileSync(en, s);
}

// FR
const fr = "src/locales/fr/platformMisc.json";
let f = fs.readFileSync(fr, "utf8");
if (!f.includes('"submissionsForRun"')) {
  f = f.replace(
    '"submissionsAcrossRuns": "{count} soumissions sur {runs} exécutions",',
    '"submissionsAcrossRuns": "{count} soumissions sur {runs} exécutions",' +
      nl +
      '      "submissionsForRun": "{count} soumissions pour \\"{name}\\"",' +
      nl +
      '      "back": "Retour",',
  );
  fs.writeFileSync(fr, f);
}

const v1 = JSON.parse(fs.readFileSync(en, "utf8"));
const v2 = JSON.parse(fs.readFileSync(fr, "utf8"));
console.log("EN:", v1.platformMisc.responses.submissionsForRun, "|", v1.platformMisc.responses.back);
console.log("FR:", v2.platformMisc.responses.submissionsForRun, "|", v2.platformMisc.responses.back);

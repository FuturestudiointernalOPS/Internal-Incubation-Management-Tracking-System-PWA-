/**
 * Country data — complete ISO 3166-1 alpha-2 list.
 *
 * Flags are derived from the alpha-2 code (regional-indicator emoji), so no
 * per-country image assets are needed. Names come from Intl.DisplayNames
 * (full standard names in the browser locale) with a compact fallback map so
 * legacy values never disappear when Intl is unavailable.
 */

// Complete ISO 3166-1 alpha-2 codes.
const CODES_STRING =
  "AD,AE,AF,AG,AI,AL,AM,AO,AQ,AR,AS,AT,AU,AW,AX,AZ," +
  "BA,BB,BD,BE,BF,BG,BH,BI,BJ,BL,BM,BN,BO,BQ,BR,BS,BT,BV,BW,BY,BZ," +
  "CA,CC,CD,CF,CG,CH,CI,CK,CL,CM,CN,CO,CR,CU,CV,CW,CX,CY,CZ," +
  "DE,DJ,DK,DM,DO,DZ," +
  "EC,EE,EG,EH,ER,ES,ET," +
  "FI,FJ,FK,FM,FO,FR," +
  "GA,GB,GD,GE,GF,GG,GH,GI,GL,GM,GN,GP,GQ,GR,GS,GT,GU,GW,GY," +
  "HK,HM,HN,HR,HT,HU," +
  "ID,IE,IL,IM,IN,IO,IQ,IR,IS,IT," +
  "JE,JM,JO,JP," +
  "KE,KG,KH,KI,KM,KN,KP,KR,KW,KY,KZ," +
  "LA,LB,LC,LI,LK,LR,LS,LT,LU,LV,LY," +
  "MA,MC,MD,ME,MF,MG,MH,MK,ML,MM,MN,MO,MP,MQ,MR,MS,MT,MU,MV,MW,MX,MY,MZ," +
  "NA,NC,NE,NF,NG,NI,NL,NO,NP,NR,NU,NZ," +
  "OM," +
  "PA,PE,PF,PG,PH,PK,PL,PM,PN,PR,PS,PT,PW,PY," +
  "QA," +
  "RE,RO,RS,RU,RW," +
  "SA,SB,SC,SD,SE,SG,SH,SI,SJ,SK,SL,SM,SN,SO,SR,SS,ST,SV,SX,SY,SZ," +
  "TC,TD,TF,TG,TH,TJ,TK,TL,TM,TN,TO,TR,TT,TV,TW,TZ," +
  "UA,UG,UM,US,UY,UZ," +
  "VA,VC,VE,VG,VI,VN,VU," +
  "WF,WS," +
  "YE,YT," +
  "ZA,ZM,ZW";

export const COUNTRY_CODES = CODES_STRING.split(",").filter(Boolean);

// Compact fallback for the most common values (used only when Intl is absent).
const FALLBACK_NAMES = {
  BJ: "Benin", NG: "Nigeria", GH: "Ghana", KE: "Kenya", ZA: "South Africa",
  US: "United States", GB: "United Kingdom", FR: "France", DE: "Germany",
  CA: "Canada", AU: "Australia", CN: "China", IN: "India", BR: "Brazil",
  TG: "Togo", CI: "Côte d'Ivoire", SN: "Senegal", CM: "Cameroon",
  ET: "Ethiopia", EG: "Egypt", MA: "Morocco", RW: "Rwanda", UG: "Uganda",
  TZ: "Tanzania", ZM: "Zambia", ZW: "Zimbabwe", ML: "Mali", BF: "Burkina Faso",
  NE: "Niger", TD: "Chad", CD: "DR Congo", CG: "Congo", GA: "Gabon",
  NL: "Netherlands", BE: "Belgium", CH: "Switzerland", IT: "Italy", ES: "Spain",
  PT: "Portugal", SE: "Sweden", NO: "Norway", DK: "Denmark", IE: "Ireland",
  JP: "Japan", KR: "South Korea", MX: "Mexico", AR: "Argentina", CO: "Colombia",
};

/** Flag emoji derived from the ISO alpha-2 code. */
export function countryFlag(code) {
  if (!code || code.length !== 2) return "";
  const base = 0x1f1e6;
  return String.fromCodePoint(base + code.charCodeAt(0) - 65, base + code.charCodeAt(1) - 65);
}

let cachedNames = null;
function buildNames() {
  if (cachedNames) return cachedNames;
  cachedNames = {};
  let display = null;
  try {
    if (typeof Intl !== "undefined" && Intl.DisplayNames) {
      display = new Intl.DisplayNames(["en"], { type: "region" });
    }
  } catch (_) {
    display = null;
  }
  for (const code of COUNTRY_CODES) {
    let name = "";
    if (display) {
      try {
        name = display.of(code) || "";
      } catch (_) {
        name = "";
      }
    }
    cachedNames[code] = name || FALLBACK_NAMES[code] || code;
  }
  return cachedNames;
}

/** Human-readable English country name for a code (or for legacy text values). */
export function countryName(codeOrName) {
  if (!codeOrName) return "";
  const v = String(codeOrName).trim();
  if (v.length === 2 && COUNTRY_CODES.includes(v.toUpperCase())) {
    return buildNames()[v.toUpperCase()];
  }
  // Legacy free-text values (e.g. "Benin") — return as-is so nothing breaks.
  return v;
}

/** Country display label: "🇧🇯 Benin" — code-aware, falls back to legacy text. */
export function countryLabel(codeOrName) {
  const v = String(codeOrName || "").trim();
  if (!v) return "";
  if (v.length === 2 && COUNTRY_CODES.includes(v.toUpperCase())) {
    const code = v.toUpperCase();
    return `${countryFlag(code)} ${buildNames()[code]}`;
  }
  return v;
}

/** All countries with resolved names + flags, sorted by name. */
export function allCountries() {
  const names = buildNames();
  return COUNTRY_CODES.map((code) => ({
    code,
    name: names[code],
    flag: countryFlag(code),
  })).sort((a, b) => a.name.localeCompare(b.name));
}

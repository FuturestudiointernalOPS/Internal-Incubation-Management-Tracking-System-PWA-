"use client";

/**
 * Industry-standard, localized dropdown options for profile fields.
 *
 * We store STABLE ISO codes in the database:
 *   - Country  -> ISO 3166-1 alpha-2 (e.g. "BJ", "FR", "US")
 *   - Language -> ISO 639-1 alpha-2   (e.g. "en", "fr", "es")
 *
 * Display names are generated at runtime via the browser's built-in CLDR data
 * (Intl.DisplayNames), so the same code renders correctly in English, French,
 * or any other locale without maintaining a duplicate hand-written list.
 */

// ISO 3166-1 alpha-2 country codes (all assigned codes).
export const COUNTRY_CODES = [
  "AD","AE","AF","AG","AI","AL","AM","AO","AQ","AR","AS","AT","AU","AW","AX","AZ",
  "BA","BB","BD","BE","BF","BG","BH","BI","BJ","BL","BM","BN","BO","BQ","BR","BS","BT","BV","BW","BY","BZ",
  "CA","CC","CD","CF","CG","CH","CI","CK","CL","CM","CN","CO","CR","CU","CV","CW","CX","CY","CZ",
  "DE","DJ","DK","DM","DO","DZ",
  "EC","EE","EG","EH","ER","ES","ET",
  "FI","FJ","FK","FM","FO","FR",
  "GA","GB","GD","GE","GF","GG","GH","GI","GL","GM","GN","GP","GQ","GR","GS","GT","GU","GW","GY",
  "HK","HM","HN","HR","HT","HU",
  "ID","IE","IL","IM","IN","IO","IQ","IR","IS","IT",
  "JE","JM","JO","JP",
  "KE","KG","KH","KI","KM","KN","KP","KR","KW","KY","KZ",
  "LA","LB","LC","LI","LK","LR","LS","LT","LU","LV","LY",
  "MA","MC","MD","ME","MF","MG","MH","MK","ML","MM","MN","MO","MP","MQ","MR","MS","MT","MU","MV","MW","MX","MY","MZ",
  "NA","NC","NE","NF","NG","NI","NL","NO","NP","NR","NU","NZ",
  "OM",
  "PA","PE","PF","PG","PH","PK","PL","PM","PN","PR","PS","PT","PW","PY",
  "QA",
  "RE","RO","RS","RU","RW",
  "SA","SB","SC","SD","SE","SG","SH","SI","SJ","SK","SL","SM","SN","SO","SR","SS","ST","SV","SX","SY","SZ",
  "TC","TD","TF","TG","TH","TJ","TK","TL","TM","TN","TO","TR","TT","TV","TW","TZ",
  "UA","UG","UM","US","UY","UZ",
  "VA","VC","VE","VG","VI","VN","VU",
  "WF","WS",
  "YE","YT",
  "ZA","ZM","ZW",
];

// ISO 639-1 alpha-2 language codes (all assigned codes).
export const LANGUAGE_CODES = [
  "aa","ab","ae","af","ak","am","an","ar","as","av","ay","az",
  "ba","be","bg","bh","bi","bm","bn","bo","br","bs",
  "ca","ce","ch","co","cr","cs","cu","cv","cy",
  "da","de","dv","dz",
  "ee","el","en","eo","es","et","eu",
  "fa","ff","fi","fj","fo","fr","fy",
  "ga","gd","gl","gn","gu","gv",
  "ha","he","hi","ho","hr","ht","hu","hy","hz",
  "ia","id","ie","ig","ii","ik","io","is","it","iu",
  "ja","jv",
  "ka","kg","ki","kj","kk","kl","km","kn","ko","kr","ks","ku","kv","kw","ky",
  "la","lb","lg","li","ln","lo","lt","lu","lv",
  "mg","mh","mi","mk","ml","mn","mr","ms","mt","my",
  "na","nb","nd","ne","ng","nl","nn","no","nr","nv","ny",
  "oc","oj","om","or","os",
  "pa","pi","pl","ps","pt",
  "qu",
  "rm","rn","ro","ru","rw",
  "sa","sc","sd","se","sg","si","sk","sl","sm","sn","so","sq","sr","ss","st","su","sv","sw",
  "ta","te","tg","th","ti","tk","tl","tn","to","tr","ts","tt","tw","ty",
  "ug","uk","ur","uz",
  "ve","vi","vo",
  "wa","wo",
  "xh",
  "yi","yo",
  "za","zh","zu",
];

function makeDisplayNames(locale, type) {
  if (typeof Intl === "undefined" || !Intl.DisplayNames) return null;
  try {
    return new Intl.DisplayNames([locale, "en"], { type });
  } catch (_) {
    return null;
  }
}

/**
 * Return sorted [{ value, label }] country options localized for `locale`.
 * The value is the ISO 3166-1 alpha-2 code.
 */
export function getCountries(locale = "en") {
  const names = makeDisplayNames(locale, "region");
  const options = COUNTRY_CODES.map((code) => {
    let label;
    try {
      label = names ? names.of(code) : code;
    } catch (_) {
      label = code;
    }
    if (!label || label === code) return null;
    return { value: code, label };
  }).filter(Boolean);

  return options.sort((a, b) => a.label.localeCompare(b.label, locale));
}

/**
 * Return sorted [{ value, label }] language options localized for `locale`.
 * The value is the ISO 639-1 alpha-2 code.
 */
export function getLanguages(locale = "en") {
  const names = makeDisplayNames(locale, "language");
  const options = LANGUAGE_CODES.map((code) => {
    let label;
    try {
      label = names ? names.of(code) : code;
    } catch (_) {
      label = code;
    }
    if (!label || label === code) return null;
    return { value: code, label };
  }).filter(Boolean);

  return options.sort((a, b) => a.label.localeCompare(b.label, locale));
}

/**
 * Best-effort resolve a legacy free-text country name (or existing code)
 * back to an ISO 3166-1 alpha-2 code. Used to migrate previously-typed values
 * without forcing users to re-pick their country.
 */
export function resolveCountryCode(name) {
  if (!name) return "";
  const raw = String(name).trim();
  if (!raw) return "";
  const upper = raw.toUpperCase();
  if (COUNTRY_CODES.includes(upper)) return upper;

  const target = raw.toLowerCase();
  for (const locale of ["en", "fr"]) {
    const found = getCountries(locale).find(
      (c) => c.label.toLowerCase() === target,
    );
    if (found) return found.value;
  }
  return "";
}

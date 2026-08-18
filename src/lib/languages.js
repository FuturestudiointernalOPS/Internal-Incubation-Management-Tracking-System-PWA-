/**
 * Standardized language list.
 *
 * - `code` : ISO 639-1 language code (the stable value we store in the DB)
 * - `en`   : English name
 * - `fr`   : French name
 * - `native`: native name for display
 */

export const LANGUAGES = [
  { code: "en", en: "English", fr: "Anglais", native: "English" },
  { code: "fr", en: "French", fr: "Français", native: "Français" },
  { code: "es", en: "Spanish", fr: "Espagnol", native: "Español" },
  { code: "pt", en: "Portuguese", fr: "Portugais", native: "Português" },
  { code: "ar", en: "Arabic", fr: "Arabe", native: "العربية" },
  { code: "zh", en: "Chinese", fr: "Chinois", native: "中文" },
  { code: "de", en: "German", fr: "Allemand", native: "Deutsch" },
  { code: "ja", en: "Japanese", fr: "Japonais", native: "日本語" },
  { code: "sw", en: "Swahili", fr: "Swahili", native: "Kiswahili" },
  { code: "ha", en: "Hausa", fr: "Haoussa", native: "Hausa" },
  { code: "yo", en: "Yoruba", fr: "Yoruba", native: "Yorùbá" },
  { code: "ig", en: "Igbo", fr: "Igbo", native: "Igbo" },
  { code: "nl", en: "Dutch", fr: "Néerlandais", native: "Nederlands" },
  { code: "it", en: "Italian", fr: "Italien", native: "Italiano" },
  { code: "ru", en: "Russian", fr: "Russe", native: "Русский" },
];

const languageMap = new Map(LANGUAGES.map((l) => [l.code, l]));

export function getLanguage(code) {
  return languageMap.get(code) || null;
}

export function getLanguageName(code, locale = "en") {
  const lang = getLanguage(code);
  if (!lang) return code || "";
  if (locale === "fr") return lang.fr;
  return lang.en;
}

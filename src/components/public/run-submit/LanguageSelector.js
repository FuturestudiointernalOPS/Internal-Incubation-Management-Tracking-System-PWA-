import { Loader2, Globe } from "lucide-react";

/**
 * LANGUAGE SELECTOR — the interface language, with a spinner while the form is
 * being translated into it.
 *
 * Extracted from the public submit page. The two actions (choose a language, ask
 * whether a translation is owed) stay with the screen; this renders the control.
 */
export default function LanguageSelector({ t, lang, translating, onLangChange }) {
  return (
    <div className="flex justify-center">
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 border border-slate-600">
        {translating ? (
          <Loader2 className="w-3.5 h-3.5 text-orange-400 animate-spin" />
        ) : (
          <Globe className="w-3.5 h-3.5 text-orange-400" />
        )}
        <span className="text-[10px] font-black text-slate-300 uppercase tracking-wider">
          {translating ? "Translating..." : t("common.language")}
        </span>
        <select
          value={lang}
          onChange={(event) => onLangChange(event.target.value)}
          disabled={translating}
          className="bg-slate-700 text-[10px] font-black text-white uppercase outline-none cursor-pointer px-2 py-1 rounded border border-slate-500 disabled:opacity-50"
        >
          <option value="en">{t("common.english")}</option>
          <option value="fr">{t("common.french")}</option>
        </select>
      </div>
    </div>
  );
}
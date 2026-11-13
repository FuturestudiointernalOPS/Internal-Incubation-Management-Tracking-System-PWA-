import { Mail } from "lucide-react";

/**
 * The contact line that closes a public run screen.
 *
 * Extracted from the public submit page.
 */
export default function ContactFooter({ className = "text-center pt-8 border-t border-slate-800" }) {
  return (
    <div className={className}>
      <a
        href="mailto:info@futurestudio.bj"
        className="inline-flex items-center gap-1.5 text-[10px] font-medium text-slate-500 hover:text-orange-400 transition-colors"
      >
        <Mail className="w-3 h-3" /> info@futurestudio.bj
      </a>
    </div>
  );
}
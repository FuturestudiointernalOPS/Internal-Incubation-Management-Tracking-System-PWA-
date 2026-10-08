"use client";

import { FileText, ChevronDown, ChevronUp } from "lucide-react";

export default function ApplicationSection({
  sectionsWithFields,
  getFieldValue,
  formatValue,
  collapsedSections,
  setCollapsedSections,
  t,
}) {
  return (
    <div className="rounded-2xl bg-secondary border border-[var(--border-primary)] overflow-hidden">
      <div className="px-6 py-4 border-b border-[var(--border-primary)] flex items-center gap-3">
        <FileText className="w-5 h-5 text-[var(--text-secondary)]" />
        <h2 className="text-sm font-black uppercase text-[var(--text-primary)] flex-1">{t("platformMisc.runReview.application")}</h2>
        {sectionsWithFields.filter(section => section.fields.some(field => formatValue(getFieldValue(field)))).length > 2 && (
          <button
            onClick={() => {
              const allIds = {};
              const hasCollapsed = Object.values(collapsedSections).some(isCollapsed => isCollapsed);
              sectionsWithFields.forEach(section => { allIds[section.id] = !hasCollapsed; });
              setCollapsedSections(hasCollapsed ? {} : allIds);
            }}
            className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            {Object.values(collapsedSections).some(isCollapsed => isCollapsed) ? t("platformMisc.runReview.expandAll") : t("platformMisc.runReview.collapseAll")}
          </button>
        )}
      </div>
      <div className="divide-y divide-[var(--border-primary)]">
        {sectionsWithFields.map(section => {
          const answered = section.fields.filter(field => formatValue(getFieldValue(field)));
          if (answered.length === 0) return null;
          return (
            <div key={section.id} className="px-6 py-4">
              <button
                onClick={() => setCollapsedSections(previousCollapsed => ({ ...previousCollapsed, [section.id]: !previousCollapsed[section.id] }))}
                className="flex items-center gap-2 w-full text-left"
              >
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--brand-orange)] flex-1">{section.title}</h3>
                <span className="text-[10px] font-medium text-[var(--text-secondary)]">{t("platformMisc.runReview.answered", { count: answered.length })}</span>
                {collapsedSections[section.id] ? <ChevronDown className="w-3.5 h-3.5 text-[var(--text-secondary)]" /> : <ChevronUp className="w-3.5 h-3.5 text-[var(--text-secondary)]" />}
              </button>
              {!collapsedSections[section.id] && (
                <div className="mt-3 space-y-3">
                  {answered.map(field => {
                    const value = formatValue(getFieldValue(field));
                    return (
                      <div key={field.id}>
                        <p className="text-[10px] font-bold text-[var(--text-secondary)] mb-1">{field.label}</p>
                        <p className="text-xs text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">{value}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

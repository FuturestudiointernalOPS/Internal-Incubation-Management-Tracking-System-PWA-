"use client";

import { Copy, Link as LinkIcon, Paperclip, Trash2 } from "lucide-react";

/**
 * The resource links attached to one task.
 *
 * Renders nothing when the task has no resources, so it never adds a node to
 * the row's own DOM.
 */
export default function TaskRowResources({
  task,
  isSub,
  notify,
  readOnly,
  handleDeleteResource,
}) {
  return (
    <>
      {/* Resources Section */}
      {task.resources && task.resources.length > 0 && (
        <div
          className={`mt-1 flex flex-col gap-1 ${isSub ? "ml-10" : "ml-8"}`}
        >
          {task.resources.map((resource) => (
            <div key={resource.id} className="flex items-center gap-2 group">
              <a
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-[var(--brand-orange)] hover:underline flex items-center gap-1 max-w-[200px] truncate"
              >
                {resource.type === "file" ? (
                  <Paperclip className="w-2.5 h-2.5 shrink-0" />
                ) : (
                  <LinkIcon className="w-2.5 h-2.5 shrink-0" />
                )}
                {resource.name || resource.url}
              </a>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(resource.url);
                  notify('info', "URL copied!");
                }}
                className="text-slate-500 opacity-0 group-hover:opacity-100 hover:text-emerald-400 transition-opacity"
                title="Copy URL"
              >
                <Copy className="w-2.5 h-2.5" />
              </button>
              {!readOnly && (
                <button
                  onClick={() => handleDeleteResource(resource.id)}
                  className="text-slate-400 hover:text-rose-400 transition-colors"
                  title="Remove resource"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

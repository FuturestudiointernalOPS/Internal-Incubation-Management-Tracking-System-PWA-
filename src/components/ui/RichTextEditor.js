"use client";

import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Italic,
  Strikethrough,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code2,
  Undo2,
  Redo2,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { isRichTextEmpty, toEditorHtml } from "@/lib/lms/richText";

/**
 * RICH TEXT EDITOR — the single authoring surface for every LMS description.
 *
 * Controlled and format-stable: what it hands back through `onChange` is what
 * `RichTextContent` renders, so a description keeps its shape between the field
 * and the page. It also opens a LEGACY plain-text value without flattening it:
 * the value is first shaped into paragraphs (see `toEditorHtml`), and the
 * database is only rewritten when the author actually saves.
 *
 * `immediatelyRender: false` keeps the editor out of the server render (Tiptap
 * would otherwise need a browser document on the first paint).
 */

const HEADING_LEVELS = [2, 3];

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "",
  minHeight = 128,
}) {
  const { t } = useI18n();

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: [StarterKit.configure({ heading: { levels: HEADING_LEVELS } })],
    content: toEditorHtml(value),
    editorProps: {
      attributes: {
        class: "rich-text px-4 py-3 text-sm font-medium outline-none",
        style: `min-height:${Number(minHeight) || 0}px`,
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(isRichTextEmpty(html) ? "" : html);
    },
  });

  // Adopt an external value (the same editor body is reused when the record
  // being edited changes, or when a parent form is reset). The comparison keeps
  // the author's own typing from being rewritten on every keystroke.
  useEffect(() => {
    if (!editor) return;
    const next = toEditorHtml(value);
    const current = editor.getHTML();
    if (isRichTextEmpty(current) && isRichTextEmpty(next)) return;
    if (next !== current) {
      editor.commands.setContent(next || "", { emitUpdate: false });
    }
  }, [editor, value]);

  const chain = () => editor.chain().focus();

  const tools = [
    {
      key: "bold",
      icon: Bold,
      active: "bold",
      run: () => chain().toggleBold().run(),
    },
    {
      key: "italic",
      icon: Italic,
      active: "italic",
      run: () => chain().toggleItalic().run(),
    },
    {
      key: "strike",
      icon: Strikethrough,
      active: "strike",
      run: () => chain().toggleStrike().run(),
    },
    {
      key: "heading2",
      icon: Heading2,
      active: { heading: { level: 2 } },
      run: () => chain().toggleHeading({ level: 2 }).run(),
    },
    {
      key: "heading3",
      icon: Heading3,
      active: { heading: { level: 3 } },
      run: () => chain().toggleHeading({ level: 3 }).run(),
    },
    {
      key: "bulletList",
      icon: List,
      active: "bulletList",
      run: () => chain().toggleBulletList().run(),
    },
    {
      key: "orderedList",
      icon: ListOrdered,
      active: "orderedList",
      run: () => chain().toggleOrderedList().run(),
    },
    {
      key: "blockquote",
      icon: Quote,
      active: "blockquote",
      run: () => chain().toggleBlockquote().run(),
    },
    {
      key: "codeBlock",
      icon: Code2,
      active: "codeBlock",
      run: () => chain().toggleCodeBlock().run(),
    },
  ];

  return (
    <div
      className="rounded-md border overflow-hidden"
      style={{ background: "var(--bg-primary)", borderColor: "var(--border-primary)" }}
    >
      <div
        className="flex flex-wrap items-center gap-0.5 border-b px-1.5 py-1"
        style={{ borderColor: "var(--border-primary)", background: "var(--surface-2)" }}
      >
        {tools.map(({ key, icon, active, run }) => (
          <ToolbarButton
            key={key}
            icon={icon}
            label={t(`lms.richText.${key}`)}
            pressed={editor ? editor.isActive(active) : false}
            disabled={!editor}
            onClick={run}
          />
        ))}
        <span
          className="mx-1 w-px self-stretch"
          style={{ background: "var(--border-primary)" }}
        />
        <ToolbarButton
          icon={Undo2}
          label={t("lms.richText.undo")}
          pressed={false}
          disabled={!editor || !editor.can().undo()}
          onClick={() => chain().undo().run()}
        />
        <ToolbarButton
          icon={Redo2}
          label={t("lms.richText.redo")}
          pressed={false}
          disabled={!editor || !editor.can().redo()}
          onClick={() => chain().redo().run()}
        />
      </div>

      <div className="relative">
        {editor ? (
          <EditorContent editor={editor} />
        ) : (
          <div style={{ minHeight: `${Number(minHeight) || 0}px` }} />
        )}
        {editor && editor.isEmpty && placeholder ? (
          <span
            className="pointer-events-none absolute left-4 top-3 text-sm font-medium"
            style={{ color: "var(--text-tertiary)" }}
          >
            {placeholder}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function ToolbarButton({ icon: Icon, label, pressed, disabled, onClick }) {
  return (
    <button
      type="button"
      // Keep the caret in the editor: without this the click blurs it first and
      // some commands run against a lost selection.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={pressed || undefined}
      className="p-1.5 rounded-md transition-colors disabled:opacity-30"
      style={{
        color: pressed ? "var(--brand-orange)" : "var(--text-secondary)",
        background: pressed ? "var(--surface-3)" : "transparent",
      }}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  );
}

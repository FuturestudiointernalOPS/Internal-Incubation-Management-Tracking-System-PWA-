import FieldControl from "@/components/public/run-submit/FieldControl";

/**
 * FIELD BLOCK — label, help text, control and error, as one step of the form.
 *
 * Extracted from the public submit page; it renders one field from the props it is
 * handed, so the draft and the validation stay with the screen.
 */
export default function FieldBlock({
  field,
  value,
  error,
  disabled,
  onFieldChange,
  t,
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-bold text-slate-200 flex items-center gap-1">
        {field.label} {field.required && <span className="text-red-400">*</span>}
      </label>
      {field.help_text && <p className="text-xs text-slate-500">{field.help_text}</p>}
      <FieldControl
        field={field}
        value={value}
        hasError={error}
        isDisabled={disabled}
        onChange={onFieldChange}
        t={t}
      />
      {error && <p className="text-xs text-red-400 font-bold">{error}</p>}
    </div>
  );
}
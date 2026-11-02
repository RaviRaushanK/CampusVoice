import { useId, useRef, useState } from "react";
import AlertMessage from "../common/AlertMessage";
import LoadingSpinner from "../common/LoadingSpinner";
export const TextField = ({ label, wide = false, ...props }) => {
  const id = useId();
  return <div className={wide ? "col-12" : "col-sm-6"}><label htmlFor={id} className="form-label">{label}</label><input id={id} className="form-control" {...props} /></div>;
};
export const SelectField = ({ label, children, ...props }) => {
  const id = useId();
  return <div className="col-sm-6"><label htmlFor={id} className="form-label">{label}</label><select id={id} className="form-select" {...props}>{children}</select></div>;
};
export const SemesterField = ({ value, onChange }) => <SelectField label="Semester" value={value} onChange={event => onChange(Number(event.target.value))} required>{[1, 2, 3, 4].map(number => <option key={number} value={number}>{number}</option>)}</SelectField>;
export const StatusField = ({ value, onChange }) => <SelectField label="Status" value={String(value)} onChange={event => onChange(event.target.value === "true")}><option value="true">Active</option><option value="false">Inactive</option></SelectField>;
export const failureMessage = err => [400, 403, 404, 409].includes(err.status) ? err.message : "Unable to save changes. Please try again.";
const validationMessage = field => {
  const label = field.labels?.[0]?.textContent?.trim() || field.getAttribute("aria-label") || "Field";
  if (field.required && !field.value.trim()) return `${label} is required.`;
  const length = field.type === "password" ? field.value.length : field.value.trim().length;
  if (field.value && field.minLength > 0 && length < field.minLength) return `${label} must contain at least ${field.minLength} characters.`;
  if (field.maxLength > 0 && field.value.length > field.maxLength) return `${label} must contain at most ${field.maxLength} characters.`;
  if (field.validity.typeMismatch && field.type === "email") return "Enter a valid email address.";
  if (field.validity.patternMismatch) return `${label}: use the required format shown in the field.`;
  if (!field.validity.valid) return `${label}: ${field.validationMessage || "Please check this value."}`;
  return "";
};
export const AcademicForm = ({ title, children, onSave, onCancel, values, onValuesChange }) => {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const save = async event => {
    event.preventDefault();
    if (pending.current) return;
    const form = event.currentTarget;
    const submitted = { ...values };
    // Password managers can fill controls without firing React change events.
    for (const key of Object.keys(submitted)) {
      const field = form.elements.namedItem(key);
      if (field && typeof submitted[key] === "string") submitted[key] = field.value;
    }
    for (const field of [...form.elements].filter(element => element.willValidate && "value" in element)) {
      const message = validationMessage(field);
      if (message) { setError(message); field.focus(); return; }
    }
    if (submitted.name !== undefined && submitted.name.trim().length < 2) { setError("Name must contain at least 2 characters."); return; }
    onValuesChange?.(submitted);
    pending.current = true; setSaving(true); setError("");
    try { await onSave(submitted); }
    catch (err) { setError(failureMessage(err)); }
    finally { pending.current = false; setSaving(false); }
  };
  return <section className="panel mb-3" aria-label={title}>
    <h3 className="h5 mb-3">{title}</h3>
    <AlertMessage type="danger" message={error} />
    <form aria-label={title} onSubmit={save} onChange={() => setError("")} noValidate><fieldset disabled={saving}>
      <div className="row g-3">{children}</div>
      <div className="d-flex flex-wrap gap-2 mt-3"><button type="button" className="btn btn-outline-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? <LoadingSpinner label="Saving..." /> : "Save Changes"}</button></div>
    </fieldset></form>
  </section>;
};

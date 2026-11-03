import { useEffect, useState } from "react";
import { listAcademic } from "../../services/academicService";
import { SelectField } from "../../components/academic/AcademicFields";
import AlertMessage from "../../components/common/AlertMessage";

const optionsFor = (classes, field, current) => [...new Set([
  ...classes.map(group => group[field]).filter(Boolean), ...(current ? [current] : []),
])].sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));

export default function StudentCohortFields({ values, onChange }) {
  const [classes, setClasses] = useState([]), [loading, setLoading] = useState(true);
  const [error, setError] = useState(""), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true; const controller = new AbortController();
    setLoading(true); setError(""); setClasses([]);
    (async () => {
      const items = []; let page = 1, more = true;
      while (active && more) {
        const { data } = await listAcademic("classes", { page, limit: 100, status: "active" }, { signal: controller.signal });
        items.push(...data.items.filter(group => group.isActive !== false));
        more = data.pagination.hasNextPage; page++;
      }
      if (active) setClasses(items);
    })().catch(err => { if (active && err.name !== "AbortError") setError("Unable to load admission batches and sections. Please refresh the options."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [attempt]);
  const batches = optionsFor(classes, "batch", values.batch), sections = optionsFor(classes, "section", values.section);
  return <>
    <SelectField label="Admission batch" name="batch" value={values.batch} disabled={loading} onChange={event => onChange("batch", event.target.value)}>
      <option value="">{loading ? "Loading batches..." : "Not provided"}</option>
      {batches.map(batch => <option key={batch} value={batch}>{batch}</option>)}
    </SelectField>
    <SelectField label="Section" name="section" value={values.section} disabled={loading} onChange={event => onChange("section", event.target.value)}>
      <option value="">{loading ? "Loading sections..." : "Not assigned"}</option>
      {sections.map(section => <option key={section} value={section}>{section}</option>)}
    </SelectField>
    <div className="col-12">
      <AlertMessage type="danger" message={error} />
      {!loading && !error && (!batches.length || !sections.length) && <p className="form-text mb-2">No {batches.length ? "sections" : sections.length ? "admission batches" : "admission batches or sections"} have been configured yet.</p>}
      <p className="form-text mb-2">Create admission batches and sections (A, B, C, etc.) in your department's active class groups. Existing student values are preserved when editing.</p>
      <div className="d-flex flex-wrap align-items-center gap-2">
        <a className="btn btn-outline-secondary btn-sm" href="/classes" target="_blank" rel="noopener noreferrer">Manage batches &amp; sections<i className="bi bi-box-arrow-up-right ms-2" aria-hidden="true" /><span className="visually-hidden"> (opens in a new tab)</span></a>
        <button type="button" className="btn btn-outline-primary btn-sm" disabled={loading} onClick={() => setAttempt(value => value + 1)}>Refresh batch and section options</button>
      </div>
    </div>
  </>;
}

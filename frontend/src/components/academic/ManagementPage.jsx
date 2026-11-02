import { useEffect, useRef, useState } from "react";
import * as api from "../../services/academicService";
import PageHeader from "../common/PageHeader";
import AlertMessage from "../common/AlertMessage";
import LoadingSpinner from "../common/LoadingSpinner";
import EmptyState from "../common/EmptyState";
import { failureMessage } from "./AcademicFields";

const ManagementPage = ({ title, singular, resource, columns, Editor, semesterFilter = false, sectionFilter = false, classFilters = false, yearFilter = false, searchable = true, readOnly = false }) => {
  const [query, setQuery] = useState({ page: 1, limit: 20, search: "", status: "all" });
  const [search, setSearch] = useState("");
  const [semester, setSemester] = useState("");
  const [section, setSection] = useState("");
  const [year, setYear] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editor, setEditor] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const pending = useRef(false);
  useEffect(() => {
    let active = true; const controller = new AbortController(); setLoading(true); setResult(null); setError("");
    api.listAcademic(resource, query, { signal: controller.signal }).then(response => {
      if (!active) return;
      if (!Array.isArray(response?.data?.items) || !response.data.pagination) throw new Error("Unavailable list");
      if (query.page > Math.max(1, response.data.pagination.totalPages)) { setQuery(previous => ({ ...previous, page: Math.max(1, response.data.pagination.totalPages) })); return; }
      setResult(response.data);
    }).catch(err => { if (active && err.name !== "AbortError") setError([403, 404].includes(err.status) ? err.message : "Unable to load academic records. Please try again."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [resource, query, attempt]);
  const save = async values => {
    if (pending.current) return;
    pending.current = true; setSaving(true);
    try {
      const fields = editor?.record ? Object.fromEntries(Object.entries(values).filter(([key, value]) => (value ?? "") !== (editor.record[key] ?? ""))) : values;
      if (Object.keys(fields).length) {
        if (editor.record) await api.updateAcademic(resource, editor.record.id, fields); else await api.createAcademic(resource, fields);
        setSuccess(`${singular} saved successfully.`); setAttempt(number => number + 1);
      } else setSuccess("No changes to save.");
      setEditor(null);
    } finally { pending.current = false; setSaving(false); }
  };
  const toggle = async record => {
    if (pending.current) return;
    pending.current = true; setSaving(true); setError("");
    try { await api.updateAcademic(resource, record.id, { isActive: !record.isActive }); setConfirmation(null); setSuccess(`${singular} ${record.isActive ? "deactivated" : "activated"}.`); setAttempt(number => number + 1); }
    catch (err) { setError(failureMessage(err)); }
    finally { pending.current = false; setSaving(false); }
  };
  return <div className="academic-page">
    <PageHeader title={title} description={readOnly ? "View your teaching assignments and retained history." : "Manage academic records within your authorized scope."} />
    <AlertMessage type="success" message={success} />
    {!readOnly && !editor && <button className="btn btn-primary mb-3" type="button" onClick={() => { setEditor({ record: null }); setSuccess(""); setConfirmation(null); }}>Add {singular}</button>}
    {editor && <Editor record={editor.record} onSave={save} onCancel={() => setEditor(null)} />}
    <form className="row g-2 mb-3" aria-label="Search academic records" onSubmit={event => { event.preventDefault(); setQuery(previous => ({ ...previous, page: 1, ...(searchable ? { search } : {}), ...(semesterFilter ? { semester } : {}), ...(classFilters || sectionFilter ? { section } : {}), ...(classFilters || yearFilter ? { academicYear: year } : {}) })); }}>
      {searchable && <div className="col-sm"><label className="form-label" htmlFor={`${resource}-search`}>Search</label><input id={`${resource}-search`} className="form-control" value={search} onChange={event => setSearch(event.target.value)} maxLength={100} /></div>}
      {semesterFilter && <div className="col-sm"><label className="form-label" htmlFor={`${resource}-semester`}>Semester filter</label><select id={`${resource}-semester`} className="form-select" value={semester} onChange={event => setSemester(event.target.value)}><option value="">All semesters</option>{[1, 2, 3, 4].map(value => <option key={value}>{value}</option>)}</select></div>}
      {(classFilters || sectionFilter) && <div className="col-sm"><label className="form-label" htmlFor={`${resource}-section`}>Section filter</label><input id={`${resource}-section`} className="form-control" value={section} maxLength={10} onChange={event => setSection(event.target.value)} /></div>}
      {(classFilters || yearFilter) && <div className="col-sm"><label className="form-label" htmlFor={`${resource}-year`}>Academic year filter</label><input id={`${resource}-year`} className="form-control" value={year} placeholder="2026-2027" onChange={event => setYear(event.target.value)} /></div>}
      <div className="col-sm"><label className="form-label" htmlFor={`${resource}-status`}>Status filter</label><select id={`${resource}-status`} className="form-select" value={query.status} onChange={event => setQuery(previous => ({ ...previous, page: 1, status: event.target.value }))}><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
      <div className="col-sm-auto align-self-end"><button className="btn btn-outline-primary" type="submit">Search</button></div>
    </form>
    {confirmation && <section className="panel mb-3" aria-label="Confirm deactivation"><p>Deactivate this {singular.toLowerCase()}? History is retained; account access or new academic use will be restricted.</p><div className="d-flex flex-wrap gap-2"><button type="button" className="btn btn-danger" disabled={saving} onClick={() => toggle(confirmation)}>Confirm deactivation</button><button type="button" className="btn btn-outline-secondary" disabled={saving} onClick={() => setConfirmation(null)}>Cancel deactivation</button></div></section>}
    <AlertMessage type="danger" message={error} />
    {loading || (!result && !error) ? <LoadingSpinner label={`Loading ${title.toLowerCase()}`} /> : result?.items.length ? <>
      <p className="text-muted small">{result.pagination.total} records. Tables can scroll horizontally on small screens.</p>
      <div className="table-responsive academic-table-container" tabIndex="0" role="region" aria-label={`${title} table`}><table className="table academic-table align-middle"><thead><tr>{columns.map(column => <th scope="col" key={column.label}>{column.label}</th>)}<th scope="col">Status</th>{!readOnly && <th scope="col">Actions</th>}</tr></thead><tbody>
        {result.items.map(record => <tr key={record.id}>{columns.map(column => <td key={column.label}>{column.render(record) ?? "Not provided"}</td>)}<td><span className={`badge ${record.isActive ? "text-bg-success" : "text-bg-secondary"}`}>{record.isActive ? "Active" : "Inactive"}</span>{record.isActive && record.isUsable === false && <span className="d-block small">Inactive source</span>}</td>{!readOnly && <td><div className="d-flex flex-wrap gap-2"><button type="button" className="btn btn-outline-primary btn-sm" disabled={saving} onClick={() => { setEditor({ record }); setSuccess(""); setConfirmation(null); }}>Edit</button><button type="button" className="btn btn-outline-secondary btn-sm" disabled={saving} onClick={() => record.isActive ? setConfirmation(record) : toggle(record)}>{record.isActive ? "Deactivate" : "Activate"}</button></div></td>}</tr>)}
      </tbody></table></div>
    </> : !error && <EmptyState title={`No ${title.toLowerCase()} yet`} message={readOnly ? "Your HOD will assign your teaching responsibilities." : `Add a ${singular.toLowerCase()} to get started.`} />}
    {error && !loading && <button type="button" className="btn btn-outline-secondary" onClick={() => setAttempt(number => number + 1)}>Try again</button>}
    {result?.pagination && <nav className="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-3" aria-label="Academic pagination"><button type="button" className="btn btn-outline-secondary" disabled={loading || !result.pagination.hasPreviousPage} onClick={() => setQuery(previous => ({ ...previous, page: previous.page - 1 }))}>Previous</button><span>{result.pagination.totalPages ? `Page ${query.page} of ${result.pagination.totalPages}` : "No pages to display"}</span><button type="button" className="btn btn-outline-secondary" disabled={loading || !result.pagination.hasNextPage} onClick={() => setQuery(previous => ({ ...previous, page: previous.page + 1 }))}>Next</button></nav>}
  </div>;
};
export default ManagementPage;

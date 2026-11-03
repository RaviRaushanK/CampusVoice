import "../../styles/audit.css";
import { useEffect, useState } from "react";
import { getAuditLogs } from "../../services/auditService";
import PageHeader from "../../components/common/PageHeader";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import AlertMessage from "../../components/common/AlertMessage";
import EmptyState from "../../components/common/EmptyState";
import { label } from "../../components/complaints/complaintLabels";
import StatusBadge from "../../components/common/StatusBadge";
const AuditLogs = () => {
  const [data, setData] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState(""), [page, setPage] = useState(1), [attempt, setAttempt] = useState(0);
  const [draft, setDraft] = useState({ action: "", resourceType: "", dateFrom: "", dateTo: "" }), [filters, setFilters] = useState({});
  const [choices, setChoices] = useState({ actions: [], resourceTypes: [] });
  useEffect(() => { let active = true; const controller = new AbortController(); setLoading(true); setError(""); setData(null);
    getAuditLogs({ page, limit: 20, ...filters }, { signal: controller.signal }).then(result => { if (active) { setData(result.data); setChoices(result.data.filters); } }).catch(err => { if (active && err.name !== "AbortError") setError(err.message || "Unable to load audit logs."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [page, filters, attempt]);
  return <div className="audit-page"><PageHeader title="Audit Logs" description="Administrative and authentication operations. Student identities are masked; private-content and complaint audit records are excluded." />
    <div className="audit-info"><i className="bi bi-shield-check" aria-hidden="true" /><span>Administrative &amp; security history. This view is read-only and excludes complaint and private-content records.</span></div>
    <form className="panel mb-3" aria-label="Audit filters" onSubmit={event => { event.preventDefault(); setPage(1); setFilters({ ...draft }); }}><div className="row g-3">{[["action", "Action", choices.actions], ["resourceType", "Resource Type", choices.resourceTypes]].map(([key, name, values]) => <div className="col-sm-6" key={key}><label htmlFor={`audit-${key}`} className="form-label">{name}</label><select className="form-select" id={`audit-${key}`} value={draft[key]} onChange={event => setDraft({ ...draft, [key]: event.target.value })}><option value="">All</option>{values.map(value => <option key={value} value={value}>{label(value)}</option>)}</select></div>)}{[["dateFrom", "Date From"], ["dateTo", "Date To"]].map(([key, name]) => <div className="col-sm-6" key={key}><label className="form-label" htmlFor={`audit-${key}`}>{name}</label><input className="form-control" type="date" id={`audit-${key}`} value={draft[key]} onChange={event => setDraft({ ...draft, [key]: event.target.value })} /></div>)}</div><p className="text-muted mt-2">Dates use UTC and include the selected final day.</p><div className="d-flex flex-wrap gap-2"><button className="btn btn-primary" disabled={loading}>Apply audit filters</button><button type="button" className="btn btn-outline-secondary" disabled={loading} onClick={() => { setDraft({ action: "", resourceType: "", dateFrom: "", dateTo: "" }); setFilters({}); setPage(1); }}>Clear audit filters</button></div></form>
    <button className="btn btn-outline-secondary mb-3" disabled={loading} onClick={() => setAttempt(value => value + 1)}>Refresh audit logs</button><AlertMessage type="danger" message={error} />{error && <button className="btn btn-outline-secondary mb-3" onClick={() => setAttempt(value => value + 1)}>Retry audit logs</button>}
    {loading ? <LoadingSpinner label="Loading audit logs" /> : data && <>{!data.items.length ? <EmptyState title="No audit operations found." /> : <div className="table-responsive audit-table-container" tabIndex="0" role="region" aria-label="Audit history"><table className="table audit-table" aria-label="Audit operations"><thead><tr><th scope="col">Operation</th><th scope="col">Actor</th><th scope="col">Time</th><th scope="col">Safe details</th></tr></thead><tbody>{data.items.map(item => <tr key={item.id}>
      <td data-label="Operation"><h3 className="h6">{label(item.action)}</h3><div className="d-flex flex-wrap gap-2"><StatusBadge value={item.outcome} /><span className="cv-badge cv-badge-neutral">{label(item.resourceType)}</span></div></td>
      <td data-label="Actor"><span>Actor: {item.actor}</span><small className="d-block text-muted">{item.role}</small></td>
      <td data-label="Time"><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time></td>
      <td data-label="Safe details">{item.outcome === "UNCONFIRMED" && <p>The attempt was recorded, but its outcome has not been confirmed. Check the current record before retrying.</p>}{item.details.changedFields?.length > 0 && <p>Fields: {item.details.changedFields.join(", ")}</p>}{typeof item.details.isActive === "boolean" && <p>Requested account/record status: {item.details.isActive ? "Active" : "Inactive"}</p>}{item.details.reason && <p>Result category: {label(item.details.reason)}</p>}{!item.details.changedFields?.length && typeof item.details.isActive !== "boolean" && !item.details.reason && <span className="text-muted">No additional details</span>}</td>
    </tr>)}</tbody></table></div>}{data.pagination.totalPages > 0 && <nav className="d-flex flex-wrap gap-3 align-items-center" aria-label="Audit pagination"><button className="btn btn-outline-secondary" disabled={!data.pagination.hasPreviousPage} onClick={() => setPage(page - 1)}>Previous audit logs</button><span>Page {data.pagination.page} of {data.pagination.totalPages}</span><button className="btn btn-outline-secondary" disabled={!data.pagination.hasNextPage} onClick={() => setPage(page + 1)}>Next audit logs</button></nav>}</>}
  </div>;
};
export default AuditLogs;

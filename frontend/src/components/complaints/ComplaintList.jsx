import StatusBadge from "../common/StatusBadge";
import "../../styles/complaints.css";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { listComplaints } from "../../services/complaintService";
import { TYPES, STATUSES, label } from "./complaintLabels";
import PageHeader from "../common/PageHeader";
import AlertMessage from "../common/AlertMessage";
import LoadingSpinner from "../common/LoadingSpinner";
import EmptyState from "../common/EmptyState";
const ComplaintList = () => {
  const { user } = useAuth(), own = user.role === "STUDENT", base = `/${user.role.toLowerCase()}/complaints`;
  const [data, setData] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState(""), [attempt, setAttempt] = useState(0), [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ status: "", type: "", priority: "" });
  useEffect(() => {
    let active = true; const controller = new AbortController(); setLoading(true); setError(""); setData(null);
    listComplaints(own, { page, limit: 20, ...filters }, { signal: controller.signal }).then(result => { if (active) setData(result.data); }).catch(err => { if (active && err.name !== "AbortError") setError("Unable to load complaints."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [own, filters, page, attempt]);
  return <div className="complaint-page"><PageHeader title={own ? "My Complaints" : "Complaint Inbox"} description={own ? "Track your final complaints and their progress." : "Complaints assigned to you, including your read-only handling history."} />
    {own && <Link to={`${base}/new`} className="btn btn-primary mb-3">Raise Complaint</Link>}
    {!own && <Link to={`/${user.role.toLowerCase()}/complaint-processing`} className="btn btn-outline-primary mb-3">Complaint Processing</Link>}
    <div className="row g-3 mb-3">{[["status", STATUSES], ["type", TYPES], ...(!own ? [["priority", ["NORMAL", "HIGH", "URGENT"]]] : [])].map(([field, values]) => <div className="col-md-4" key={field}><label htmlFor={`complaint-filter-${field}`} className="form-label">{label(field)} filter</label><select id={`complaint-filter-${field}`} className="form-select" value={filters[field]} onChange={event => { setFilters({ ...filters, [field]: event.target.value }); setPage(1); }}><option value="">All</option>{values.map(value => <option key={value} value={value}>{label(value)}</option>)}</select></div>)}</div>
    <AlertMessage type="danger" message={error} />{error && <button className="btn btn-outline-secondary" onClick={() => setAttempt(value => value + 1)}>Retry complaints</button>}
    {loading ? <LoadingSpinner label="Loading complaints" /> : data && <>{!data.items.length ? <EmptyState title="No complaints found." /> : data.items.map(item => <article key={item.id} className="panel mb-3"><h3 className="h5"><Link to={`${base}/${item.id}`}>{item.title}</Link></h3><p>{label(item.type)}</p><p>Status: <StatusBadge value={item.status} /> · Priority: <StatusBadge value={item.priority} /></p><p>Identity: {item.identityMode === "ANONYMOUS" ? "Anonymous" : own ? "Named" : item.identity ? `${item.identity.name} — ${item.identity.userCode}` : "Named student unavailable"}</p><p className="mb-0">Handling level: {item.currentHandlerRole}<br />Submitted: {new Date(item.createdAt).toLocaleString()}</p></article>)}{data.pagination.totalPages > 0 && <nav aria-label="Complaint pagination" className="d-flex flex-wrap gap-3 align-items-center"><button className="btn btn-outline-secondary" disabled={!data.pagination.hasPreviousPage} onClick={() => setPage(page - 1)}>Previous complaints</button><span>Page {data.pagination.page} of {data.pagination.totalPages}</span><button className="btn btn-outline-secondary" disabled={!data.pagination.hasNextPage} onClick={() => setPage(page + 1)}>Next complaints</button></nav>}</>}
  </div>;
};
export default ComplaintList;

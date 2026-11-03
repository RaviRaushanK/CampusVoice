import StatusBadge from "../common/StatusBadge";
import "../../styles/analytics.css";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getAnalytics } from "../../services/analyticsService";
import { label, TYPES } from "../complaints/complaintLabels";
import PageHeader from "../common/PageHeader";
import AlertMessage from "../common/AlertMessage";
import LoadingSpinner from "../common/LoadingSpinner";
const ComplaintProcessing = () => {
  const { user } = useAuth(), [mode, setMode] = useState("fifo"), [search, setSearch] = useState(""), [type, setType] = useState(""), [query, setQuery] = useState({}), [attempt, setAttempt] = useState(0);
  const [data, setData] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState("");
  useEffect(() => { let active = true; const controller = new AbortController(); setLoading(true); setData(null); setError(""); getAnalytics("complaint-processing", { mode, ...query }, { signal: controller.signal }).then(result => { if (active) setData(result.data); }).catch(err => { if (active && err.name !== "AbortError") setError(err.message || "Unable to load processing view."); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; controller.abort(); }; }, [mode, query, attempt]);
  return <div className="analytics-page"><PageHeader title="Complaint Processing" description="Unresolved cases currently assigned to you. These read-only ordering views do not change complaint status or priority." /><div className="d-flex flex-wrap gap-2 mb-3" role="group" aria-label="Processing mode">{[["fifo", "FIFO Queue"], ["priority", "Priority Queue"]].map(([value, text]) => <button className={`btn ${value === mode ? "btn-primary" : "btn-outline-primary"}`} key={value} aria-pressed={value === mode} onClick={() => setMode(value)}>{text}</button>)}</div>
    <p>{mode === "fifo" ? "Oldest submitted complaint first." : "Urgent, then High, then Normal; oldest submitted first within each priority."} Showing at most 100 current cases across all submission dates. Equal timestamps use record ID order.</p>
    <form className="panel mb-3" aria-label="Search processing queue" onSubmit={event => { event.preventDefault(); setQuery({ search, type }); }}><label htmlFor="processing-search" className="form-label">Search title or exact complaint ID</label><input id="processing-search" className="form-control mb-2" maxLength={100} value={search} onChange={event => setSearch(event.target.value)} /><label htmlFor="processing-type" className="form-label">Complaint type filter</label><select id="processing-type" className="form-select mb-2" value={type} onChange={event => setType(event.target.value)}><option value="">All</option>{TYPES.filter(value => user.role === "FACULTY" ? value === "FACULTY_ISSUE" : user.role === "HOD" ? ["FACULTY_ISSUE", "AGAINST_FACULTY", "DEPARTMENT_ISSUE"].includes(value) : true).map(value => <option key={value} value={value}>{label(value)}</option>)}</select><p>Search scans only the bounded authorized window shown for this mode.</p><button className="btn btn-outline-primary">Search queue</button></form>
    <button className="btn btn-outline-secondary mb-3" disabled={loading} onClick={() => setAttempt(value => value + 1)}>Refresh queue</button><AlertMessage type="danger" message={error} />
    {loading ? <LoadingSpinner label="Loading processing queue" /> : data && <>{data.truncated && <p>More cases exist. Showing the first {data.limit}; narrow the complaint type or use the full inbox.</p>}{!data.items.length ? <p>No unresolved complaints in this view.</p> : <ol className="processing-list" aria-label="Ordered complaints">{data.items.map(item => <li className="panel mb-3" key={item.id}><h3 className="h5"><Link to={`/${user.role.toLowerCase()}/complaints/${item.id}`}>{item.title}</Link></h3><p>{label(item.type)} · <StatusBadge value={item.status} /> · Priority: <StatusBadge value={item.priority} /></p><p className="mb-0">Submitted: {new Date(item.createdAt).toLocaleString()}</p></li>)}</ol>}</>}
  </div>;
};
export default ComplaintProcessing;

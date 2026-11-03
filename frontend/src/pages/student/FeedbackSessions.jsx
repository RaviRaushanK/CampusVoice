import { useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import * as service from "../../services/feedbackSessionService";
import PageHeader from "../../components/common/PageHeader";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import AlertMessage from "../../components/common/AlertMessage";
import EmptyState from "../../components/common/EmptyState";
const date = value => value ? new Date(value).toLocaleString() : "No closing time";
const FeedbackSessions = () => {
  const [params, setParams] = useSearchParams(); const location = useLocation();
  const category = params.get("category") === "completed" ? "completed" : "pending";
  const [page, setPage] = useState(1), [data, setData] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState(""), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true; const controller = new AbortController(); setLoading(true); setError(""); setData(null);
    service.getStudentSessions({ category, page }, { signal: controller.signal }).then(result => { if (active) setData(result.data); })
      .catch(err => { if (active && err.name !== "AbortError") setError("Unable to load feedback sessions. Please try again."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [category, page, attempt]);
  return <div className="sessions-page">
    <PageHeader title="Feedback Sessions" description="Your class feedback questionnaires and completed submissions." />
    <AlertMessage type="success" message={location.state?.message} />
    <div className="d-flex flex-wrap gap-2 mb-3" role="group" aria-label="Feedback session category">{["pending", "completed"].map(value => <button key={value} className={`btn ${value === category ? "btn-primary" : "btn-outline-primary"}`} aria-pressed={value === category} onClick={() => { setPage(1); setParams({ category: value }); }}>{value === "pending" ? "Pending" : "Completed"}</button>)}</div>
    <AlertMessage type="danger" message={error} />{error && <button className="btn btn-outline-secondary" onClick={() => setAttempt(value => value + 1)}>Retry feedback sessions</button>}
    {loading ? <LoadingSpinner label="Loading feedback sessions" /> : data && <>
      {!data.items.length ? <EmptyState title={category === "pending" ? "No feedback sessions are waiting for your response." : "You have not completed any feedback sessions yet."} message={category === "pending" ? "Scheduled sessions appear here when their opening time arrives." : "Completed feedback is final and cannot be edited."} /> : data.items.map(session => <article className="panel mb-3" key={session.id} aria-label={session.title}>
        <h3 className="h5">{session.title}</h3><p>{session.subject?.code} — {session.subject?.name}</p><p>Faculty: {session.faculty?.name || "Unavailable"}<br />Semester {session.classGroup?.semester} · Section {session.classGroup?.section || "Not assigned"} · {session.classGroup?.academicYear}</p>
        {session.completion ? <><p>Submitted: {date(session.completion.submittedAt)}</p><p>Identity: {session.completion.identityMode === "ANONYMOUS" ? "Anonymous" : "Named"} (locked)</p><span className="badge text-bg-success">Completed</span></> : <><p>Closes: {date(session.closesAt)}</p><Link className="btn btn-primary" to={`/feedback-sessions/${session.id}/respond`}>Give Feedback</Link></>}
      </article>)}
      {data.pagination.totalPages > 0 && <nav className="d-flex flex-wrap gap-3 align-items-center" aria-label="Feedback session pagination"><button className="btn btn-outline-secondary" disabled={!data.pagination.hasPreviousPage} onClick={() => setPage(page - 1)}>Previous</button><span>Page {data.pagination.page} of {data.pagination.totalPages}</span><button className="btn btn-outline-secondary" disabled={!data.pagination.hasNextPage} onClick={() => setPage(page + 1)}>Next</button></nav>}
    </>}
  </div>;
};
export default FeedbackSessions;

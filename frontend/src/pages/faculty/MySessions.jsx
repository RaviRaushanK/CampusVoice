import StatusBadge from "../../components/common/StatusBadge";
import "../../styles/feedback.css";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import * as service from "../../services/feedbackSessionService";
import PageHeader from "../../components/common/PageHeader";
import AlertMessage from "../../components/common/AlertMessage";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import EmptyState from "../../components/common/EmptyState";
import { assignmentLabel } from "./feedbackFields";
const formatDate = value => value ? new Date(value).toLocaleString() : "Not configured";
const MySessions = () => {
  const location = useLocation();
  const [data, setData] = useState(null), [page, setPage] = useState(1), [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true), [error, setError] = useState(""), [attempt, setAttempt] = useState(0);
  const [confirmation, setConfirmation] = useState(null), [deleting, setDeleting] = useState(false);
  const busy = useRef(false);
  const [lifecycle, setLifecycle] = useState(null), [notice, setNotice] = useState("");
  const changeState = async () => {
    if (busy.current) return; busy.current = true; setDeleting(true); setError(""); setNotice("");
    try {
      const result = await (lifecycle.action === "publish" ? service.publishSession(lifecycle.session.id) : service.closeSession(lifecycle.session.id));
      setNotice(lifecycle.action === "publish" ? `Session published. ${result.data.notificationDelivery?.failed ? "Some notifications could not be delivered." : "Eligible students have been notified."}` : "Session closed.");
      setLifecycle(null); setAttempt(value => value + 1);
    } catch (err) { setError(err.message || "Unable to update session state."); }
    finally { busy.current = false; setDeleting(false); }
  };
  useEffect(() => {
    let active = true; const controller = new AbortController(); setLoading(true); setError(""); setData(null);
    service.getMySessions({ page, status }, { signal: controller.signal }).then(result => { if (active) setData(result.data); })
      .catch(err => { if (active && err.name !== "AbortError") setError("Unable to load sessions. Please try again."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [page, status, attempt]);
  const remove = async () => {
    if (busy.current) return; busy.current = true; setDeleting(true); setError("");
    try { await service.deleteDraft(confirmation.id); setConfirmation(null); if (data?.items.length === 1 && page > 1) setPage(page - 1); else setAttempt(value => value + 1); }
    catch (err) { setError(err.message || "Unable to delete draft."); }
    finally { busy.current = false; setDeleting(false); }
  };
  return <div className="sessions-page">
    <PageHeader title="My Sessions" description="Build and manage feedback drafts for your teaching assignments." />
    <Link className="btn btn-primary mb-3" to="/my-sessions/new">Create Session</Link>
    <AlertMessage type="success" message={location.state?.message} />
    <AlertMessage message={notice} />
    <label className="form-label d-block" htmlFor="session-filter">Session status</label>
    <select id="session-filter" className="form-select mb-3" value={status} disabled={deleting} onChange={event => { setStatus(event.target.value); setPage(1); setConfirmation(null); setLifecycle(null); }}>
      <option value="all">All statuses</option>{["DRAFT", "OPEN", "CLOSED"].map(value => <option key={value}>{value}</option>)}
    </select>
    <AlertMessage type="danger" message={error} />
    {error && <button className="btn btn-outline-secondary mb-3" onClick={() => setAttempt(value => value + 1)}>Retry sessions</button>}
    {confirmation && <section className="panel mb-3" aria-label="Confirm draft deletion"><p>Delete draft “{confirmation.title}”? This cannot be undone.</p><div className="d-flex flex-wrap gap-2"><button className="btn btn-danger" disabled={deleting} onClick={remove}>{deleting ? "Deleting..." : "Confirm delete"}</button><button className="btn btn-secondary" disabled={deleting} onClick={() => setConfirmation(null)}>Cancel deletion</button></div></section>}
    {lifecycle && <section className="panel mb-3" role="alertdialog" aria-modal="false" aria-labelledby="lifecycle-title" aria-describedby="lifecycle-description">
      <h3 className="h5" id="lifecycle-title">{lifecycle.action === "publish" ? "Publish this session?" : "Close this session?"}</h3>
      <p id="lifecycle-description">{lifecycle.action === "publish" ? "After publishing, the questions, settings and academic assignment cannot be edited." : "Students will no longer be able to submit responses. This session cannot be reopened."}</p>
      <div className="d-flex flex-wrap gap-2"><button autoFocus className="btn btn-primary" disabled={deleting} onClick={changeState}>{deleting ? "Processing..." : lifecycle.action === "publish" ? "Confirm Publish" : "Confirm Close"}</button><button className="btn btn-outline-secondary" disabled={deleting} onClick={() => setLifecycle(null)}>Cancel action</button></div>
    </section>}
    {loading ? <LoadingSpinner label="Loading sessions" /> : data && <>
      {!data.items.length ? <EmptyState title="No feedback sessions yet." message="Create a feedback session for one of your teaching assignments, or choose another status filter." icon="bi-clipboard" /> : <div className="session-cards">{data.items.map(session => <article className="panel mb-3" key={session.id} aria-label={session.title}>
        <div className="d-flex flex-wrap gap-2 align-items-start justify-content-between"><h3 className="h5">{session.title}</h3><StatusBadge value={session.availability || session.status}>{session.availability || session.status}</StatusBadge></div>
        <p>{assignmentLabel(session)}</p><p>{session.questionCount} questions · {session.allowAnonymous ? "Students may choose to stay anonymous" : "Identity will be required"}</p>
        <p>Opens: {formatDate(session.opensAt)}<br />Closes: {formatDate(session.closesAt)}</p>
        {session.status === "DRAFT" && <div className="d-flex flex-wrap gap-2"><Link to={`/my-sessions/${session.id}/edit`} className="btn btn-outline-primary">Edit Draft</Link><button className="btn btn-outline-danger" disabled={deleting} onClick={() => { setLifecycle(null); setConfirmation(session); }}>Delete Draft</button><button className="btn btn-primary" disabled={deleting} onClick={() => { setConfirmation(null); setLifecycle({ session, action: "publish" }); }}>Publish Session</button></div>}
        {session.status === "OPEN" && session.availability !== "CLOSED" && <button className="btn btn-outline-danger" disabled={deleting} onClick={() => setLifecycle({ session, action: "close" })}>Close Session</button>}
        {["OPEN", "CLOSED"].includes(session.status) && <Link className="btn btn-outline-primary ms-2" to={`/my-sessions/${session.id}/results`}>View Results</Link>}
      </article>)}</div>}
      {data.pagination.totalPages > 0 && <nav aria-label="Session pagination" className="d-flex flex-wrap gap-3 align-items-center"><button className="btn btn-outline-secondary" disabled={!data.pagination.hasPreviousPage || deleting} onClick={() => setPage(page - 1)}>Previous</button><span>Page {data.pagination.page} of {data.pagination.totalPages}</span><button className="btn btn-outline-secondary" disabled={!data.pagination.hasNextPage || deleting} onClick={() => setPage(page + 1)}>Next</button></nav>}
    </>}
  </div>;
};
export default MySessions;

import StatusBadge from "../common/StatusBadge";
import "../../styles/complaints.css";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getComplaint, actOnComplaint, attachmentUrl } from "../../services/complaintService";
import { label } from "./complaintLabels";
import PageHeader from "../common/PageHeader";
import AlertMessage from "../common/AlertMessage";
import LoadingSpinner from "../common/LoadingSpinner";
const actionLabels = { acknowledge: "Acknowledge", start: "Start Progress", escalate: "Escalate", resolve: "Resolve", close: "Close Complaint", priority: "Raise Priority", "escalation-request": "Request Escalation" };
const ComplaintDetail = () => {
  const { complaintId } = useParams(), { user } = useAuth(), { state } = useLocation(), own = user.role === "STUDENT", busy = useRef(false), confirmRef = useRef(null);
  const [data, setData] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState(""), [attempt, setAttempt] = useState(0), [notice, setNotice] = useState(state?.saved ? "Complaint submitted successfully." : "");
  const [action, setAction] = useState(""), [text, setText] = useState(""), [priority, setPriority] = useState("HIGH"), [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true; const controller = new AbortController(); setLoading(true); setError("");
    getComplaint(complaintId, { signal: controller.signal }).then(result => { if (active) setData(result.data); }).catch(err => { if (active && err.name !== "AbortError") { setData(null); setError(err.status === 404 ? "Complaint unavailable." : "Unable to load complaint."); } }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [complaintId, attempt]);
  useEffect(() => { if (action) confirmRef.current?.focus(); }, [action]);
  const mutate = async event => {
    event.preventDefault(); if (busy.current) return;
    if (["resolve", "escalation-request"].includes(action) && (text.trim().length < 10 || text.trim().length > (action === "resolve" ? 2000 : 1000))) { setError("Enter a meaningful reason or resolution within the displayed limit."); return; }
    busy.current = true; setSaving(true); setError(""); setNotice("");
    try { const { data: result } = await actOnComplaint(complaintId, action, action === "resolve" ? { resolutionSummary: text } : action === "escalation-request" ? { reason: text } : action === "priority" ? { priority } : {}); setData(result.item); setAction(""); setText(""); setNotice(result.notificationDelivery.delivered < result.notificationDelivery.attempted ? "Complaint updated. Some notifications could not be delivered." : "Complaint updated successfully."); }
    catch (err) { setError(err.message || "Unable to update complaint. Refresh and try again."); }
    finally { busy.current = false; setSaving(false); }
  };
  return <div className="complaint-page complaint-detail">
    <Link className="btn btn-outline-secondary mb-3" to={`/${user.role.toLowerCase()}/complaints`}>Back to complaints</Link>
    <PageHeader title="Complaint Detail" description="Case information, permitted actions and recorded progress." action={<button className="btn btn-outline-secondary" disabled={saving} onClick={() => { setAction(""); setAttempt(value => value + 1); }}><i className="bi bi-arrow-clockwise me-2" aria-hidden="true" />Refresh complaint</button>} />
    <AlertMessage type="success" message={notice} /><AlertMessage type="danger" message={error} />
    {state?.notificationDelivery?.delivered < state?.notificationDelivery?.attempted && <AlertMessage type="warning" message="Complaint saved. The assigned authority notification could not be delivered." />}
    {loading ? <LoadingSpinner label="Loading complaint" /> : data && <div className="complaint-detail-grid">
      <div><article className="panel mb-3"><p className="cv-eyebrow">{label(data.type)}</p><h3 className="h4">{data.title}</h3>
        <p>Identity: {data.identityMode === "ANONYMOUS" ? "Anonymous" : own ? "Named" : data.identity ? `${data.identity.name} — ${data.identity.userCode}` : "Named student unavailable"}</p>
        <h4 className="h6 mt-4">Description</h4><p className="message-text">{data.description}</p>
        {data.escalationRequestedAt && <p className="cv-badge cv-badge-warning">Escalation request pending.</p>}
        {data.resolutionSummary && <section className="mt-4" aria-label="Resolution"><h4 className="h5">Resolution</h4><p className="message-text">{data.resolutionSummary}</p></section>}
      </article>
      <section className="panel mb-4" aria-label="Complaint attachments"><h3 className="h5"><i className="bi bi-paperclip me-2" aria-hidden="true" />Attachments</h3>{data.attachments.length ? <ul>{data.attachments.map(file => <li key={file.id}><a href={attachmentUrl(data.id, file.id)} download><i className="bi bi-file-earmark-arrow-down" aria-hidden="true" />{file.displayName}</a><span className="d-block text-muted mt-1">{file.mimeType} · {Math.ceil(file.size / 1024)} KB</span></li>)}</ul> : <p className="text-muted small">No attachments.</p>}</section>
</div>
      <aside className="complaint-case-sidebar" aria-label="Case status and actions"><section className="panel mb-3"><h3 className="h5">Case overview</h3><dl className="complaint-facts"><div><dt>Status</dt><dd><StatusBadge value={data.status} /></dd></div><div><dt>Priority</dt><dd><StatusBadge value={data.priority} /></dd></div><div><dt>Handling level</dt><dd>{data.currentHandlerRole}</dd></div><div><dt>Escalations</dt><dd>{data.escalationLevel}</dd></div><div><dt>Submitted</dt><dd>{new Date(data.createdAt).toLocaleString()}</dd></div></dl>
      {data.readOnly && <p className="small text-muted">You have read-only access as a prior handler.</p>}
      {!action && data.availableActions.length > 0 && <><h4 className="h6">Available actions</h4><div className="d-flex flex-wrap gap-2">{data.availableActions.map(value => <button key={value} className={`btn ${["close", "escalate"].includes(value) ? "btn-outline-danger" : "btn-outline-primary"}`} onClick={() => { setAction(value); setText(""); setPriority(data.priority === "HIGH" ? "URGENT" : "HIGH"); setError(""); }}>{actionLabels[value]}</button>)}</div></>}
      </section>
      {action && <form className="panel mb-3" role="alertdialog" aria-labelledby="complaint-action-title" onSubmit={mutate} ref={confirmRef} tabIndex={-1}><h3 id="complaint-action-title" className="h5">{actionLabels[action]}?</h3><p className="small">This action will be recorded in the complaint timeline.</p><fieldset disabled={saving}>{["resolve", "escalation-request"].includes(action) && <><label htmlFor="complaint-action-text" className="form-label">{action === "resolve" ? "Resolution Summary" : "Escalation Reason"}</label><textarea id="complaint-action-text" rows={4} className="form-control mb-2" maxLength={action === "resolve" ? 2000 : 1000} value={text} onChange={event => setText(event.target.value)} /><p className="small">Please use respectful and appropriate language. 10–{action === "resolve" ? 2000 : 1000} characters.</p></>}{action === "priority" && <><label className="form-label" htmlFor="complaint-priority">New Priority</label><select id="complaint-priority" className="form-select mb-3" value={priority} onChange={event => setPriority(event.target.value)}>{(data.priority === "HIGH" ? ["URGENT"] : ["HIGH", "URGENT"]).map(value => <option key={value}>{value}</option>)}</select></>}<div className="d-flex flex-wrap gap-2"><button className="btn btn-primary">{saving ? "Updating..." : "Confirm Action"}</button><button type="button" className="btn btn-outline-secondary" onClick={() => setAction("")}>Cancel action</button></div></fieldset></form>}
      </aside>
      <section className="complaint-timeline-section" aria-label="Complaint timeline"><h3 className="h5 mb-3">Timeline</h3><ol className="complaint-timeline">{data.timeline.map((entry, index) => <li key={index} className="panel mb-3"><h4 className="h6">{label(entry.eventType)}{entry.eventType === "ESCALATED" ? ` to ${entry.toHandlerRole}` : ""}</h4><p>{entry.actor} · {new Date(entry.createdAt).toLocaleString()}</p>{entry.note && <p className="message-text mb-0">{entry.note}</p>}</li>)}</ol></section>
    </div>}
  </div>;
};
export default ComplaintDetail;

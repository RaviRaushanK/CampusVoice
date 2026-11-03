import { useEffect, useRef, useState } from "react";
import PageHeader from "../common/PageHeader";
import LoadingSpinner from "../common/LoadingSpinner";
import AlertMessage from "../common/AlertMessage";
import EmptyState from "../common/EmptyState";
import MessageInbox from "./MessageInbox";
const StudentMessagePage = ({ feedback, loadOptions, submitMessage, loadHistory }) => {
  const [options, setOptions] = useState([]), [loading, setLoading] = useState(true), [loadError, setLoadError] = useState(""), [attempt, setAttempt] = useState(0);
  const [recipient, setRecipient] = useState(""), [rating, setRating] = useState(null), [message, setMessage] = useState(""), [identityMode, setIdentity] = useState("ANONYMOUS");
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [confirmation, setConfirmation] = useState(false), [saving, setSaving] = useState(false), [revision, setRevision] = useState(0);
  const busy = useRef(false), key = useRef(crypto.randomUUID()), confirmRef = useRef(null);
  useEffect(() => {
    let active = true; const controller = new AbortController(); setLoading(true); setLoadError("");
    const load = async () => { let page = 1, more = true; const items = []; while (active && more) { const { data } = await loadOptions({ page, limit: 100 }, { signal: controller.signal }); items.push(...data.items); more = data.pagination.hasNextPage; page++; } if (active) setOptions(items); };
    load().catch(err => { if (active && err.name !== "AbortError") setLoadError("Unable to load recipient options. Please try again."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [loadOptions, attempt]);
  useEffect(() => { if (confirmation) confirmRef.current?.focus(); }, [confirmation]);
  const prepare = event => {
    event.preventDefault(); if (busy.current) return;
    const invalid = !recipient ? "Choose a recipient." : feedback && !rating ? "Choose a rating from 1 to 5." : message.trim().length < 10 || message.length > 2000 ? "Message must contain 10–2000 characters." : "";
    if (invalid) { setError(invalid); return; } setError(""); setConfirmation(true);
  };
  const save = async () => {
    if (busy.current) return; busy.current = true; setSaving(true); setError(""); setNotice("");
    try {
      const body = { message, identityMode, ...(feedback ? { facultyAssignmentId: recipient, rating } : { facultyId: recipient, submissionKey: key.current }) };
      const result = await submitMessage(body);
      setNotice(feedback ? "General Feedback submitted successfully." : result.data.notificationDelivery?.attempted && !result.data.notificationDelivery.delivered ? "Suggestion saved. The Faculty notification could not be delivered." : "Private Suggestion sent successfully.");
      setMessage(""); setRating(null); setIdentity("ANONYMOUS"); setConfirmation(false); key.current = crypto.randomUUID(); setRevision(value => value + 1);
    } catch (err) { setError(err.message || "Unable to submit. Please try again."); setConfirmation(false); }
    finally { busy.current = false; setSaving(false); }
  };
  return <div className="message-page sessions-page">
    <PageHeader title={feedback ? "General Feedback" : "Private Suggestions"} description={feedback ? "Share feedback about your assigned Faculty and Subject. Faculty and your Department HOD can read it; Principal sees aggregates only." : "This suggestion will be visible only to the selected Faculty member."} />
    <AlertMessage type="success" message={notice} />
    {loading ? <LoadingSpinner label="Loading recipient options" /> : loadError ? <><AlertMessage type="danger" message={loadError} /><button className="btn btn-outline-secondary mb-3" onClick={() => setAttempt(value => value + 1)}>Retry recipient options</button></> : !options.length ? <EmptyState title={feedback ? "No active teaching assignments are available for your class." : "No active Faculty recipients are available in your department."} /> : <form aria-label={feedback ? "General Feedback form" : "Private Suggestion form"} onSubmit={prepare} noValidate>
      <AlertMessage type="danger" message={error} /><fieldset disabled={saving || confirmation}>
        <label className="form-label" htmlFor="message-recipient">{feedback ? "Faculty / Subject" : "Send To"}</label><select id="message-recipient" className="form-select mb-3" value={recipient} onChange={event => { setRecipient(event.target.value); key.current = crypto.randomUUID(); }}><option value="">Choose recipient</option>{options.map(item => <option key={item.id} value={item.id}>{feedback ? `${item.subject.code} — ${item.subject.name} / ${item.faculty.name} / ${item.academicYear}` : item.name}</option>)}</select>
        {feedback && <fieldset className="mb-3"><legend className="h6">Rating (required)</legend><div className="d-flex flex-wrap gap-3">{[1, 2, 3, 4, 5].map(value => <label className="d-flex gap-2" key={value}><input type="radio" name="feedback-rating" checked={rating === value} onChange={() => setRating(value)} />{value}</label>)}</div></fieldset>}
        <label className="form-label" htmlFor="message-body">{feedback ? "Your Feedback" : "Suggestion"}</label><textarea id="message-body" className="form-control mb-2" rows={5} maxLength={2000} value={message} onChange={event => { setMessage(event.target.value); key.current = crypto.randomUUID(); }} /><p className="text-muted">{message.length}/2000 characters. Please use respectful and appropriate language.</p>
        <fieldset className="mb-3"><legend className="h6">Your identity</legend><p>Your identity choice is final. Anonymous hides your identity from recipients.</p>{[["ANONYMOUS", "Stay Anonymous"], ["NAMED", "Reveal Identity"]].map(([value, label]) => <label className="d-flex gap-2 mb-2" key={value}><input type="radio" name="message-identity" checked={identityMode === value} onChange={() => { setIdentity(value); key.current = crypto.randomUUID(); }} />{label}</label>)}</fieldset>
        <button className="btn btn-primary mb-3" type="submit">{feedback ? "Submit Feedback" : "Send Suggestion"}</button>
      </fieldset>
      {confirmation && <section ref={confirmRef} tabIndex={-1} role="alertdialog" aria-labelledby="message-confirm-title" aria-describedby="message-confirm-description" className="panel mb-3"><h3 className="h5" id="message-confirm-title">{feedback ? "Submit feedback?" : "Send suggestion?"}</h3><p id="message-confirm-description">You will not be able to edit it or change your identity choice after submission.</p><div className="d-flex flex-wrap gap-2"><button type="button" className="btn btn-primary" disabled={saving} onClick={save}>{saving ? "Submitting..." : feedback ? "Confirm Feedback" : "Confirm Suggestion"}</button><button type="button" className="btn btn-outline-secondary" disabled={saving} onClick={() => setConfirmation(false)}>Keep editing</button></div></section>}
    </form>}
    <MessageInbox loader={loadHistory} own feedback={feedback} refreshToken={revision} title={feedback ? "My Feedback" : "Sent Suggestions"} />
  </div>;
};
export default StudentMessagePage;

import IdentityChoice from "../../components/common/IdentityChoice";
import "../../styles/complaints.css";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../../components/common/PageHeader";
import AlertMessage from "../../components/common/AlertMessage";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import { complaintOptions, createComplaint } from "../../services/complaintService";
import { TYPES, label, explanations } from "../../components/complaints/complaintLabels";
const RaiseComplaint = () => {
  const navigate = useNavigate(), busy = useRef(false), confirmRef = useRef(null);
  const [options, setOptions] = useState([]), [loading, setLoading] = useState(true), [loadError, setLoadError] = useState(""), [attempt, setAttempt] = useState(0);
  const [type, setType] = useState(""), [faculty, setFaculty] = useState(""), [title, setTitle] = useState(""), [description, setDescription] = useState(""), [identity, setIdentity] = useState("ANONYMOUS"), [files, setFiles] = useState([]);
  const [error, setError] = useState(""), [confirm, setConfirm] = useState(false), [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true; const controller = new AbortController(); setLoading(true); setLoadError("");
    (async () => { const values = []; let page = 1, more = true; while (active && more) { const { data } = await complaintOptions({ page, limit: 100 }, { signal: controller.signal }); values.push(...data.items); more = data.pagination.hasNextPage; page++; } if (active) setOptions(values); })()
      .catch(err => { if (active && err.name !== "AbortError") setLoadError("Unable to load complaint options."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [attempt]);
  useEffect(() => { if (confirm) confirmRef.current?.focus(); }, [confirm]);
  const needsFaculty = ["FACULTY_ISSUE", "AGAINST_FACULTY"].includes(type);
  const addFiles = event => {
    const selected = Array.from(event.target.files || []);
    if (!selected.length) return;
    setFiles(current => [...current, ...selected]);
    setError(files.length + selected.length > 3 ? "Attach at most 3 files." : "");
    // The selected list is authoritative; reset the picker so another selection
    // adds files instead of replacing earlier evidence, and removed files can return.
    event.target.value = "";
  };
  const prepare = event => {
    event.preventDefault(); if (busy.current) return;
    const invalid = !type ? "Choose a complaint type." : needsFaculty && !faculty ? "Choose a relevant Faculty member." : title.trim().length < 5 || title.trim().length > 150 ? "Title must contain 5–150 characters." : description.trim().length < 20 || description.trim().length > 5000 ? "Description must contain 20–5000 characters." : files.length > 3 ? "Attach at most 3 files." : files.some(file => file.size > 5 * 1024 * 1024) ? "Each attachment must be at most 5 MB." : files.some(file => !["application/pdf", "image/jpeg", "image/png", "video/mp4", "video/webm"].includes(file.type) || !/\.(pdf|jpe?g|png|mp4|webm)$/i.test(file.name)) ? "Only PDF, JPEG, PNG, MP4 and WebM files are allowed." : "";
    setError(invalid); if (!invalid) setConfirm(true);
  };
  const submit = async () => {
    if (busy.current) return; busy.current = true; setSaving(true); setError("");
    const body = new FormData(); for (const [key, value] of Object.entries({ type, title, description, identityMode: identity, ...(needsFaculty ? { facultyAssignmentId: faculty } : {}) })) body.append(key, value);
    files.forEach(file => body.append("attachments", file));
    try { const { data } = await createComplaint(body); navigate(`/student/complaints/${data.item.id}`, { state: { saved: true, notificationDelivery: data.notificationDelivery } }); }
    catch (err) { setError(err.message || "Unable to submit complaint."); setConfirm(false); }
    finally { busy.current = false; setSaving(false); }
  };
  return <div className="complaint-page"><PageHeader title="Raise Complaint" description="Choose an issue type. CampusVoice routes it to the responsible authority." />
    {loading ? <LoadingSpinner label="Loading complaint options" /> : loadError ? <><AlertMessage message={loadError} type="danger" /><button className="btn btn-outline-secondary" onClick={() => setAttempt(value => value + 1)}>Retry complaint options</button></> : <form aria-label="Raise Complaint form" onSubmit={prepare} noValidate>
      <AlertMessage message={error} type="danger" /><fieldset disabled={saving || confirm}>
        <section className="cv-form-section"><h3 className="cv-section-heading"><span className="cv-section-number">1</span>Complaint type</h3><div className="complaint-type-options" role="group" aria-label="Choose complaint type">{TYPES.map(value => <button type="button" key={value} className="complaint-type-option" aria-pressed={type === value} onClick={() => { setType(value); setFaculty(""); }}><i className={`bi ${{ FACULTY_ISSUE: "bi-chat-square-text", AGAINST_FACULTY: "bi-person-exclamation", DEPARTMENT_ISSUE: "bi-building", AGAINST_HOD: "bi-person-badge", COLLEGE_CAMPUS: "bi-mortarboard", SAFETY_URGENT: "bi-shield-exclamation" }[value]}`} aria-hidden="true" />{label(value)}</button>)}</div><label htmlFor="complaint-type" className="form-label">Complaint Type</label><select id="complaint-type" className="form-select mb-3" value={type} onChange={event => { setType(event.target.value); setFaculty(""); }}><option value="">Choose type</option>{TYPES.map(value => <option key={value} value={value}>{label(value)}</option>)}</select>
        {type && <p>{explanations[type]}</p>}{type === "SAFETY_URGENT" && <AlertMessage type="warning" message="CampusVoice is not a substitute for emergency services or immediate emergency assistance." />}
        {needsFaculty && <><label htmlFor="complaint-faculty" className="form-label">Relevant Faculty</label><select id="complaint-faculty" className="form-select mb-3" value={faculty} onChange={event => setFaculty(event.target.value)}><option value="">Choose Faculty / Subject</option>{options.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{!options.length && <p>No active teaching relationships are available for your class.</p>}</>}
        </section><section className="cv-form-section"><h3 className="cv-section-heading"><span className="cv-section-number">2</span>Complaint details</h3><label htmlFor="complaint-title" className="form-label">Title</label><input id="complaint-title" className="form-control mb-3" maxLength={150} value={title} onChange={event => setTitle(event.target.value)} />
        <label htmlFor="complaint-description" className="form-label">Description</label><textarea id="complaint-description" className="form-control mb-2" rows={6} maxLength={5000} value={description} onChange={event => setDescription(event.target.value)} /><p className="text-muted">{description.length}/5000 characters. Please use respectful and appropriate language.</p>
        </section><section className="cv-form-section complaint-upload"><h3 className="cv-section-heading"><span className="cv-section-number">3</span>Supporting evidence</h3><label htmlFor="complaint-files" className="form-label">Attachments (optional)</label><input id="complaint-files" className="form-control mb-2" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.mp4,.webm" onChange={addFiles} aria-describedby="complaint-files-help" /><p id="complaint-files-help">Up to 3 PDF, JPEG, PNG, MP4 or WebM files, 5 MB each. Select several at once or add them one at a time. Attachments are final after submission.</p><p className="small" aria-live="polite">{files.length}/3 files selected</p>
        {!!files.length && <ul className="complaint-selected-files" aria-label="Selected attachments">{files.map((file, index) => <li key={index}><span className="cv-break"><i className={`bi ${file.type.startsWith("image/") ? "bi-file-earmark-image" : file.type.startsWith("video/") ? "bi-file-earmark-play" : "bi-file-earmark-pdf"} me-2`} aria-hidden="true" />{file.name}<small className="d-block text-muted">{Math.ceil(file.size / 1024)} KB</small></span><button type="button" className="btn btn-outline-danger btn-sm" aria-label={`Remove attachment ${index + 1}: ${file.name}`} onClick={() => { setFiles(current => current.filter((_, position) => position !== index)); setError(""); }}>Remove</button></li>)}</ul>}
        </section><fieldset className="mb-3 cv-form-section"><legend className="cv-section-heading"><span className="cv-section-number">4</span>Your identity</legend><IdentityChoice name="complaint-identity" value={identity} onChange={setIdentity} /></fieldset>
        {identity === "ANONYMOUS" && <p>If you choose Anonymous, avoid including your name, USN or other identifying information inside the attachment itself.</p>}
        <button className="btn btn-primary mb-3">Submit Complaint</button>
      </fieldset>
      {confirm && <section role="alertdialog" ref={confirmRef} tabIndex={-1} aria-labelledby="complaint-confirm-title" aria-describedby="complaint-confirm-description" className="panel"><h3 id="complaint-confirm-title" className="h5">Submit complaint?</h3><p id="complaint-confirm-description">You will not be able to edit the complaint after submission.{identity === "ANONYMOUS" && " Your identity will be hidden from complaint recipients."}</p><div className="d-flex flex-wrap gap-2"><button type="button" className="btn btn-primary" disabled={saving} onClick={submit}>{saving ? "Submitting..." : "Confirm Complaint"}</button><button type="button" className="btn btn-outline-secondary" disabled={saving} onClick={() => setConfirm(false)}>Keep editing</button></div></section>}
    </form>}
  </div>;
};
export default RaiseComplaint;

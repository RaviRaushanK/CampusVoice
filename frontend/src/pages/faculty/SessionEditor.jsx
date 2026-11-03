import "../../styles/feedback.css";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { listAcademic } from "../../services/academicService";
import * as service from "../../services/feedbackSessionService";
import PageHeader from "../../components/common/PageHeader";
import AlertMessage from "../../components/common/AlertMessage";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import EmptyState from "../../components/common/EmptyState";
import QuestionBuilder from "./QuestionBuilder";
import { assignmentLabel, draftError, localDate, QUESTION_LABELS } from "./feedbackFields";
import Stack from "../../../../utils/dsa/Stack.mjs";
const blank = { facultyAssignmentId: "", title: "", description: "", allowAnonymous: true, opensAt: "", closesAt: "", questions: [] };
const SessionEditor = () => {
  const { sessionId } = useParams(); const navigate = useNavigate(); const busy = useRef(false);
  const undo = useRef(new Stack(50)), redo = useRef(new Stack(50));
  const [fields, setFields] = useState(blank), [session, setSession] = useState(null), [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true), [loadError, setLoadError] = useState(""), [error, setError] = useState(""), [saving, setSaving] = useState(false), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true; const controller = new AbortController(); setLoading(true); setLoadError(""); setError(""); setSession(null); setFields(blank); undo.current.clear(); redo.current.clear();
    const load = async () => {
      if (sessionId) {
        const { data } = await service.getSession(sessionId, { signal: controller.signal });
        if (active) { setSession(data); setFields({ title: data.title, description: data.description, allowAnonymous: data.allowAnonymous, opensAt: localDate(data.opensAt), closesAt: localDate(data.closesAt), questions: data.questions }); }
      } else {
        // Page through the existing scoped assignment API so no assignment is
        // silently hidden by a fixed first-page limit.
        let page = 1, more = true; const items = [];
        while (more && active) {
          const { data } = await listAcademic("faculty-assignments/mine", { status: "active", page, limit: 100 }, { signal: controller.signal });
          items.push(...data.items.filter(value => value.isUsable)); more = data.pagination.hasNextPage; page++;
        }
        if (active) setAssignments(items);
      }
    };
    load().catch(err => { if (active && err.name !== "AbortError") setLoadError(sessionId ? "Unable to load this feedback draft. It may be unavailable." : "Unable to load teaching assignments. Please try again."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [sessionId, attempt]);
  const set = (key, value) => setFields(current => ({ ...current, [key]: value }));
  const changeQuestions = value => { undo.current.push(structuredClone(fields.questions)); redo.current.clear(); set("questions", value); };
  const restore = (from, to) => { if (saving || from.current.isEmpty() || (session && session.status !== "DRAFT")) return; to.current.push(structuredClone(fields.questions)); set("questions", from.current.pop()); };
  const save = async event => {
    event.preventDefault(); if (busy.current) return;
    const invalid = draftError(fields) || (!sessionId && !fields.facultyAssignmentId ? "Choose a teaching assignment." : "");
    if (invalid) { setError(invalid); return; }
    busy.current = true; setSaving(true); setError("");
    try {
      const body = { ...fields, opensAt: fields.opensAt ? new Date(fields.opensAt).toISOString() : null, closesAt: fields.closesAt ? new Date(fields.closesAt).toISOString() : null,
        questions: fields.questions.map(({ key, ...question }) => question) };
      if (sessionId) await service.updateSession(sessionId, body); else await service.createSession(body);
      navigate("/my-sessions", { state: { message: "DRAFT session saved." } });
    } catch (err) { setError(err.message || "Unable to save draft. Please try again."); }
    finally { busy.current = false; setSaving(false); }
  };
  return <div className="session-editor">
    <PageHeader title={sessionId ? "Edit Feedback Draft" : "Create Feedback Session"} description="Configure a draft, then publish it from My Sessions when it is ready." />
    <Link to="/my-sessions" className="btn btn-outline-secondary mb-3">Back to My Sessions</Link>
    {loading ? <LoadingSpinner label={sessionId ? "Loading draft" : "Loading assignments"} /> : loadError ? <><AlertMessage type="danger" message={loadError} /><button className="btn btn-outline-secondary" onClick={() => setAttempt(value => value + 1)}>Retry builder</button></> : session && session.status !== "DRAFT" ? <AlertMessage message="Only draft sessions can be edited." /> : !sessionId && !assignments.length ? <EmptyState title="You do not currently have an active teaching assignment." message="A feedback session can be created after an HOD assigns you to a subject and class." icon="bi-book" /> : <form aria-label="Feedback draft" onSubmit={save}>
      <AlertMessage type="danger" message={error} />
      <fieldset disabled={saving}>
        <section className="panel mb-4 session-settings"><h3 className="h5">Session details</h3>
        {sessionId ? <section className="panel mb-3"><h3 className="h6">Teaching assignment (fixed)</h3><p className="mb-0">{assignmentLabel(session)}</p></section> : <><label className="form-label" htmlFor="session-assignment">Teaching Assignment</label><select id="session-assignment" className="form-select mb-3" required value={fields.facultyAssignmentId} onChange={event => set("facultyAssignmentId", event.target.value)}><option value="">Choose your teaching assignment</option>{assignments.map(value => <option key={value.id} value={value.id}>{assignmentLabel(value)}</option>)}</select></>}
        <label className="form-label" htmlFor="session-title">Title</label><input id="session-title" className="form-control mb-3" maxLength={160} required value={fields.title} onChange={event => set("title", event.target.value)} />
        <label className="form-label" htmlFor="session-description">Description</label><textarea id="session-description" className="form-control mb-3" maxLength={2000} rows={3} value={fields.description} onChange={event => set("description", event.target.value)} />
        <label className="d-flex gap-2 mb-2"><input type="checkbox" checked={fields.allowAnonymous} onChange={event => set("allowAnonymous", event.target.checked)} />Allow students to stay anonymous</label><p className="text-muted">When permitted, students will choose whether to stay anonymous or reveal their identity when responses become available.</p>
        <p>Availability dates are optional and configure a future window. Times use your device timezone.</p>
        <div className="row g-3 mb-3">{[["opensAt", "Opens At"], ["closesAt", "Closes At"]].map(([key, label]) => <div className="col-md-6" key={key}><label className="form-label" htmlFor={key}>{label}</label><input className="form-control" id={key} type="datetime-local" value={fields[key]} onChange={event => set(key, event.target.value)} /></div>)}</div>
        </section>
        <div className="d-flex flex-wrap gap-2 mb-3" role="group" aria-label="Question history"><button type="button" className="btn btn-outline-secondary" disabled={undo.current.isEmpty()} onClick={() => restore(undo, redo)}>Undo</button><button type="button" className="btn btn-outline-secondary" disabled={redo.current.isEmpty()} onClick={() => restore(redo, undo)}>Redo</button><span className="text-muted">Unsaved question changes only. Up to 50 previous states.</span></div>
        <QuestionBuilder questions={fields.questions} onChange={changeQuestions} />
        <details className="panel mb-3"><summary>Questionnaire preview</summary>{fields.questions.length ? fields.questions.map((question, index) => <div key={question.key || question.id} className="mt-3"><p>{index + 1}. {question.prompt || "Untitled question"} {question.required ? "(Required)" : "(Optional)"}</p><p>{QUESTION_LABELS[question.type]}</p>{question.options && <ul>{question.options.map((option, optionIndex) => <li key={optionIndex}>{option || "Blank option"}</li>)}</ul>}{question.type === "RATING" && <p>1 · 2 · 3 · 4 · 5</p>}</div>) : <p className="mt-3">No questions yet.</p>}</details>
        <button className="btn btn-primary" type="submit">{saving ? "Saving..." : "Save Draft"}</button>
      </fieldset>
    </form>}
  </div>;
};
// Reset local draft state when switching between create and different edit routes.
const SessionEditorRoute = () => { const { sessionId } = useParams(); return <SessionEditor key={sessionId || "new"} />; };
export default SessionEditorRoute;

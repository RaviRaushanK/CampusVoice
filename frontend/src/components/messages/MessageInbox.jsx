import { useEffect, useId, useState } from "react";
import LoadingSpinner from "../common/LoadingSpinner";
import AlertMessage from "../common/AlertMessage";
import EmptyState from "../common/EmptyState";
import FeedbackSummary from "./FeedbackSummary";
import { listAcademic } from "../../services/academicService";
const MessageInbox = ({ loader, own = false, feedback = false, department = false, refreshToken = 0, title }) => {
  const filterId = useId();
  const [data, setData] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState(""), [page, setPage] = useState(1), [attempt, setAttempt] = useState(0);
  const [facultyId, setFaculty] = useState(""), [subjectId, setSubject] = useState(""), [rating, setRating] = useState("");
  const [choices, setChoices] = useState({ faculty: [], subjects: [] }), [choiceError, setChoiceError] = useState("");
  useEffect(() => {
    if (!department) return;
    let active = true; const controller = new AbortController();
    Promise.all([listAcademic("faculty", { limit: 100, status: "all" }, { signal: controller.signal }), listAcademic("subjects", { limit: 100, status: "all" }, { signal: controller.signal })]).then(([faculty, subjects]) => { if (active) { setChoices({ faculty: faculty.data.items, subjects: subjects.data.items }); setChoiceError(""); } })
      .catch(err => { if (active && err.name !== "AbortError") setChoiceError("Faculty/Subject filters are unavailable. You can still filter by rating."); });
    return () => { active = false; controller.abort(); };
  }, [department, attempt]);
  useEffect(() => {
    let active = true; const controller = new AbortController(); setLoading(true); setError(""); setData(null);
    const query = { page, limit: 20, ...(department ? Object.fromEntries(Object.entries({ facultyId, subjectId, rating }).filter(([, value]) => value)) : {}) };
    loader(query, { signal: controller.signal }).then(result => { if (active) setData(result.data); })
      .catch(err => { if (active && err.name !== "AbortError") setError("Unable to load messages. Please try again."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [loader, page, attempt, own, department, facultyId, subjectId, rating, refreshToken]);
  const filter = (set, value) => { set(value); setPage(1); };
  return <section aria-label={title} className="message-list">
    <h3 className="h5">{title}</h3>
    {department && <div className="panel mb-3"><p>Filter Department feedback. Faculty and Subject menus show up to 100 records.</p><AlertMessage message={choiceError} /><div className="row g-3">{[["Faculty filter", facultyId, setFaculty, choices.faculty, item => item.name], ["Subject filter", subjectId, setSubject, choices.subjects, item => `${item.code} — ${item.name}`]].map(([label, value, set, items, describe], index) => <div className="col-md-4" key={label}><label className="form-label" htmlFor={`${filterId}-${index}`}>{label}</label><select id={`${filterId}-${index}`} className="form-select" value={value} onChange={event => filter(set, event.target.value)}><option value="">All</option>{items.map(item => <option value={item.id} key={item.id}>{describe(item)}</option>)}</select></div>)}<div className="col-md-4"><label className="form-label" htmlFor={`${filterId}-rating`}>Rating filter</label><select id={`${filterId}-rating`} className="form-select" value={rating} onChange={event => filter(setRating, event.target.value)}><option value="">All</option>{[1, 2, 3, 4, 5].map(value => <option key={value}>{value}</option>)}</select></div></div></div>}
    <AlertMessage type="danger" message={error} />{error && <button className="btn btn-outline-secondary mb-3" onClick={() => setAttempt(value => value + 1)}>Retry messages</button>}
    {loading ? <LoadingSpinner label="Loading messages" /> : data && <>
      {feedback && !own && data.summary && <FeedbackSummary summary={data.summary} />}
      {!data.items.length ? <EmptyState title="No messages yet." message={own ? "Your final submissions will appear here." : "Messages will appear here when students submit them."} /> : data.items.map(item => <article className="panel mb-3" key={item.id}>
        <h4 className="h6">{own ? `To: ${item.faculty?.name || "Unavailable Faculty"}` : item.identityMode === "ANONYMOUS" ? "Anonymous" : item.identity ? `${item.identity.name} — ${item.identity.userCode.toUpperCase()}` : "Named student unavailable"}</h4>
        {feedback && <p>{item.subject?.code} — {item.subject?.name}<br />Rating: {item.rating}/5</p>}
        {own && <p>Identity: {item.identityMode === "ANONYMOUS" ? "Anonymous" : "Named"} (final)<br />Submitted: {new Date(item.submittedAt).toLocaleString()}</p>}
        {!own && department && <p>Faculty: {item.faculty?.name || "Unavailable"}</p>}
        <p className="message-text mb-0">{item.message}</p>
      </article>)}
      {data.pagination.totalPages > 0 && <nav className="d-flex flex-wrap gap-3 align-items-center" aria-label={`${title} pagination`}><button className="btn btn-outline-secondary" disabled={!data.pagination.hasPreviousPage} onClick={() => setPage(page - 1)}>Previous messages</button><span>Page {data.pagination.page} of {data.pagination.totalPages}</span><button className="btn btn-outline-secondary" disabled={!data.pagination.hasNextPage} onClick={() => setPage(page + 1)}>Next messages</button></nav>}
    </>}
  </section>;
};
export default MessageInbox;

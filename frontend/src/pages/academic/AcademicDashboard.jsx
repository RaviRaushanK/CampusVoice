import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAcademicDashboard } from "../../services/academicService";
import PageHeader from "../../components/common/PageHeader";
import StatCard from "../../components/common/StatCard";
import AlertMessage from "../../components/common/AlertMessage";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import EmptyState from "../../components/common/EmptyState";
const AcademicDashboard = ({ title }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true; const controller = new AbortController(); setLoading(true); setError("");
    getAcademicDashboard({ signal: controller.signal }).then(result => { if (active) setData(result.data); })
      .catch(err => { if (active && err.name !== "AbortError") setError("Unable to load academic information. Please try again."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [attempt]);
  return <div className="academic-dashboard">
    <PageHeader title={title} description="Your CampusVoice academic workspace." />
    {loading ? <LoadingSpinner label="Loading academic information" /> : error ? <><AlertMessage type="danger" message={error} /><button type="button" className="btn btn-outline-secondary mb-3" onClick={() => setAttempt(value => value + 1)}>Retry academic information</button></> : data && <>
      {data.metrics && <div className="row g-3 mb-3">{Object.entries(data.metrics).map(([label, value]) => <div className="col-sm-6 col-xl-3" key={label}><StatCard label={label} value={value} icon="bi-building" /></div>)}</div>}
      {data.metrics && Object.hasOwn(data.metrics, "Pending Feedback Sessions") && <Link className="btn btn-primary mb-3" to="/feedback-sessions">Feedback Sessions</Link>}
      {data.metrics && Object.hasOwn(data.metrics, "Feedback Submitted") && <div className="d-flex flex-wrap gap-2 mb-3"><Link className="btn btn-outline-primary" to="/student/general-feedback">General Feedback</Link><Link className="btn btn-outline-primary" to="/student/suggestions">Private Suggestions</Link></div>}
      {Object.hasOwn(data, "department") && <section className="panel mb-3" aria-label="My academic information"><h3 className="h5">My academic information</h3><p className="mb-1">Department: {data.department ? `${data.department.code} — ${data.department.name}${data.department.isActive ? "" : " (Inactive)"}` : "Not assigned"}</p>
        {Object.hasOwn(data, "semester") && <><p className="mb-1">Semester: {data.semester ?? "Not assigned"}</p><p className="mb-1">Section: {data.section || "Not assigned"}</p><p className="mb-0">Admission batch: {data.batch || "Not provided"}</p></>}
      </section>}
      {data.assignments && <section className="panel mb-3" aria-label="My teaching assignments"><h3 className="h5">My Teaching Assignments</h3><p>{data.assignments.pagination.total} active assignments</p>
        {data.assignments.items.length ? <ul>{data.assignments.items.map(assignment => <li key={assignment.id}>{assignment.subject?.code} — {assignment.subject?.name} / Semester {assignment.classGroup?.semester} {assignment.classGroup?.section} / {assignment.academicYear}{!assignment.isUsable && " (Inactive source)"}</li>)}</ul> : <p>No teaching assignments yet.</p>}
        <div className="d-flex flex-wrap gap-2"><Link to="/my-assignments" className="btn btn-outline-primary">View my assignments</Link><Link to="/my-sessions" className="btn btn-outline-primary">My Sessions</Link><Link to="/my-sessions/new" className="btn btn-primary">Create Session</Link></div>
      </section>}
    </>}
    <EmptyState title="No recent activity yet" message="An activity feed will be available when later modules are connected." icon="bi-clock-history" />
  </div>;
};
export default AcademicDashboard;

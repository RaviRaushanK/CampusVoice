import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAcademicDashboard } from "../../services/academicService";
import { useAuth } from "../../context/AuthContext";
import StudentSummary from "../../components/analytics/StudentSummary";
import PageHeader from "../../components/common/PageHeader";
import StatCard from "../../components/common/StatCard";
import AlertMessage from "../../components/common/AlertMessage";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import "../../styles/dashboard.css";
const shortcuts = {
  PRINCIPAL: [["Manage departments", "/departments", "bi-building"], ["Manage HODs", "/hods", "bi-person-badge"], ["Browse audit history", "/principal/audit-logs", "bi-shield-check"]],
  HOD: [["Manage Faculty", "/faculty", "bi-person-badge"], ["Manage Students", "/students", "bi-people"], ["Manage assignments", "/faculty-assignments", "bi-diagram-3"]],
  FACULTY: [["Manage sessions", "/my-sessions", "bi-clipboard-check"], ["Read feedback", "/faculty/general-feedback", "bi-chat-square-text"], ["Read private suggestions", "/faculty/suggestions", "bi-lightbulb"]],
  STUDENT: [["Open class questionnaires", "/feedback-sessions", "bi-clipboard-check"], ["Share your feedback", "/student/general-feedback", "bi-chat-square-text"], ["Track your complaints", "/student/complaints", "bi-exclamation-circle"]],
};
const metricIcon = label => /student/i.test(label) ? "bi-people" : /faculty|hod/i.test(label) ? "bi-person-badge" : /session|response/i.test(label) ? "bi-clipboard-check" : /complaint|issue/i.test(label) ? "bi-exclamation-circle" : /feedback/i.test(label) ? "bi-chat-square-text" : /suggestion/i.test(label) ? "bi-lightbulb" : /assignment/i.test(label) ? "bi-diagram-3" : /subject/i.test(label) ? "bi-book" : "bi-building";
const AcademicDashboard = ({ title }) => {
  const { user } = useAuth();
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
    <PageHeader title={title} description="Your CampusVoice academic workspace." eyebrow="Your workspace, at a glance" />
    <section className="dashboard-welcome"><div><h3>Welcome back{user.name ? ", " + user.name.split(" ")[0] : ""}.</h3><p>{user.role === "STUDENT" ? "Share your perspective, complete class feedback and follow your concerns in one place." : "A clear view of your academic workspace. Manage what needs attention and keep your campus moving."}</p></div><span className="dashboard-welcome-icon" aria-hidden="true"><i className="bi bi-mortarboard" /></span></section>
    {loading ? <LoadingSpinner label="Loading academic information" /> : error ? <><AlertMessage type="danger" message={error} /><button type="button" className="btn btn-outline-secondary mb-3" onClick={() => setAttempt(value => value + 1)}>Retry academic information</button></> : data && <>
      {data.metrics && <div className="row g-3 mb-3">{Object.entries(data.metrics).map(([label, value]) => <div className="col-sm-6 col-xl-3" key={label}><StatCard label={label} value={value} icon={metricIcon(label)} /></div>)}</div>}
      {user.role === "STUDENT" && <StudentSummary />}
      <div className="dashboard-actions">{user.role !== "STUDENT" && <div className="d-flex flex-wrap gap-2 mb-3"><Link className="btn btn-outline-primary" to={`/${user.role.toLowerCase()}/analytics`}>View Analytics</Link><Link className="btn btn-outline-primary" to={`/${user.role.toLowerCase()}/complaint-processing`}>Complaint Processing</Link></div>}
      {data.metrics && ["Total Complaints", "Assigned Issues", "Department Complaints", "Assigned Complaints"].some(key => Object.hasOwn(data.metrics, key)) && <div className="d-flex flex-wrap gap-2 mb-3"><Link className="btn btn-outline-primary" to={`/${user.role.toLowerCase()}/complaints`}>{user.role === "STUDENT" ? "My Complaints" : "View complaints"}</Link>{user.role === "STUDENT" && <Link className="btn btn-primary" to="/student/complaints/new">Raise Complaint</Link>}</div>}
      {data.metrics && Object.hasOwn(data.metrics, "Pending Feedback Sessions") && <Link className="btn btn-primary mb-3" to="/feedback-sessions">Feedback Sessions</Link>}
      {data.metrics && Object.hasOwn(data.metrics, "Feedback Submitted") && <div className="d-flex flex-wrap gap-2 mb-3"><Link className="btn btn-outline-primary" to="/student/general-feedback">General Feedback</Link><Link className="btn btn-outline-primary" to="/student/suggestions">Private Suggestions</Link></div>}
      </div>
      {Object.hasOwn(data, "department") && <section className="panel mb-3" aria-label="My academic information"><h3 className="h5">My academic information</h3><p className="mb-1">Department: {data.department ? `${data.department.code} — ${data.department.name}${data.department.isActive ? "" : " (Inactive)"}` : "Not assigned"}</p>
        {Object.hasOwn(data, "semester") && <><p className="mb-1">Semester: {data.semester ?? "Not assigned"}</p><p className="mb-1">Section: {data.section || "Not assigned"}</p><p className="mb-0">Admission batch: {data.batch || "Not provided"}</p></>}
      </section>}
      {data.assignments && <section className="panel mb-3" aria-label="My teaching assignments"><h3 className="h5">My Teaching Assignments</h3><p>{data.assignments.pagination.total} active assignments</p>
        {data.assignments.items.length ? <ul>{data.assignments.items.map(assignment => <li key={assignment.id}>{assignment.subject?.code} — {assignment.subject?.name} / Semester {assignment.classGroup?.semester} {assignment.classGroup?.section} / {assignment.academicYear}{!assignment.isUsable && " (Inactive source)"}</li>)}</ul> : <p>No teaching assignments yet.</p>}
        <div className="d-flex flex-wrap gap-2"><Link to="/my-assignments" className="btn btn-outline-primary">View my assignments</Link><Link to="/my-sessions" className="btn btn-outline-primary">My Sessions</Link><Link to="/my-sessions/new" className="btn btn-primary">Create Session</Link></div>
      </section>}
    </>}
    <nav className="dashboard-shortcuts" aria-label="Quick access">{shortcuts[user.role].map(([label, path, icon]) => <Link key={path} to={path} className="dashboard-shortcut"><i className={"bi " + icon} aria-hidden="true" /><span>{label}</span><i className="bi bi-arrow-up-right" aria-hidden="true" /></Link>)}</nav>
    <section className="panel dashboard-guidance" aria-label="Workspace navigation"><i className="bi bi-compass" aria-hidden="true" /><div><h3 className="h5">Workspace ready</h3><p className="mb-0">Use your summary cards and navigation to open authorized modules. Review Notifications for recent updates.</p></div></section>
  </div>;
};
export default AcademicDashboard;

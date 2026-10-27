import { useEffect, useState } from "react";
import PageHeader from "../../components/common/PageHeader";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import AlertMessage from "../../components/common/AlertMessage";
import { getProfile } from "../../services/profileService";
import { Link } from "react-router-dom";
import ProfileEditor from "./ProfileEditor";

const roleLabels = { PRINCIPAL: "Principal", HOD: "HOD", FACULTY: "Faculty", STUDENT: "Student" };
const text = (value, fallback = "Not provided") => typeof value === "string" && value.trim() ? value : fallback;
const formatDate = (value, includeTime = false) => {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    ...(includeTime ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(date);
};

const Information = ({ title, fields }) => (
  <section className="panel" aria-label={title}>
    <div className="panel-heading"><h3>{title}</h3></div>
    <dl className="row mb-0">
      {fields.map(([label, value]) => <div className="col-sm-6 mb-3" key={label}>
        <dt className="small text-muted fw-normal">{label}</dt>
        <dd className="mb-0 mt-1">{value}</dd>
      </div>)}
    </dl>
  </section>
);

const Profile = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [editing, setEditing] = useState(false);
  const [success, setSuccess] = useState("");
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    getProfile().then(result => {
      if (!active) return;
      if (!result?.data || typeof result.data !== "object" || Array.isArray(result.data)) {
        setError("Your profile is unavailable. Please try again.");
      } else setProfile(result.data);
    }).catch(err => {
      if (active) setError(err.status === 401
        ? "Your session has expired. Please sign in again."
        : "Unable to load your profile. Please try again.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);

  const initials = typeof profile?.name === "string"
    ? profile.name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(word => Array.from(word)[0]).join("").toLocaleUpperCase()
    : "";
  const role = roleLabels[profile?.role] || "Not available";
  return <>
    <PageHeader title="My Profile" description="View and manage your CampusVoice account information." />
    {loading ? <LoadingSpinner label="Loading profile" /> : error ? <>
      <AlertMessage type="danger" message={error} />
      <button type="button" className="btn btn-outline-secondary" onClick={() => setAttempt(value => value + 1)}>Try again</button>
    </> : profile && <div className="profile-details d-grid gap-3">
      <section className="panel d-flex align-items-center gap-3" aria-label="Profile overview">
        <span className="brand-mark flex-shrink-0" aria-hidden="true">{initials || "?"}</span>
        <div><h3 className="h5 mb-1">{text(profile.name)}</h3><p className="text-muted mb-0">{role}</p></div>
      </section>
      <AlertMessage type="success" message={success} />
      {editing ? <ProfileEditor profile={profile} onCancel={() => setEditing(false)} onSaved={updated => {
        setProfile(updated); setEditing(false); setSuccess("Profile updated successfully.");
      }} /> : <>
      <div><button type="button" className="btn btn-outline-primary" onClick={() => { setSuccess(""); setEditing(true); }}>Edit Profile</button></div>
      <Information title="Personal Information" fields={[
        ["Name", text(profile.name)], ["Email", text(profile.email)],
      ]} />
      </>}
      <Information title="Account Information" fields={[
        ["User Code", text(profile.userCode)], ["Role", role],
        ["Account Status", typeof profile.isActive === "boolean"
          ? <span className={`badge ${profile.isActive ? "text-bg-success" : "text-bg-secondary"}`}>{profile.isActive ? "Active" : "Inactive"}</span>
          : "Not available"],
        ["Last Login", formatDate(profile.lastLoginAt, true)], ["Account Created", formatDate(profile.createdAt)],
      ]} />
      <Information title="Academic / Organization Information" fields={[
        ["Department reference", text(profile.departmentId, "Not assigned")],
        ["Semester", profile.semester ?? "Not assigned"], ["Section", text(profile.section, "Not assigned")],
      ]} />
      <section className="panel" aria-label="Security">
        <div className="panel-heading"><h3>Security</h3></div>
        <p>Manage your account password.</p>
        <Link to="/change-password" className="btn btn-outline-secondary">Change Password</Link>
      </section>
    </div>}
  </>;
};

export default Profile;

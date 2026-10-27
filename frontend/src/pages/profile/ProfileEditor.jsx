import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import AlertMessage from "../../components/common/AlertMessage";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import { updateProfile } from "../../services/profileService";

const ProfileEditor = ({ profile, onSaved, onCancel }) => {
  const { syncProfile } = useAuth();
  const [name, setName] = useState(profile.name || "");
  const [email, setEmail] = useState(profile.email || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const save = async event => {
    event.preventDefault();
    if (pending.current) return;
    const normalizedName = name.trim();
    const normalizedEmail = email.trim();
    if (normalizedName.length < 2 || normalizedName.length > 120) {
      setError("Name must contain between 2 and 120 characters."); return;
    }
    if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("Enter a valid email address."); return;
    }
    pending.current = true;
    setSaving(true);
    setError("");
    try {
      const result = await updateProfile({ name: normalizedName, email: normalizedEmail || null });
      syncProfile(result.data);
      if (active.current) onSaved(result.data);
    } catch (err) {
      if (active.current) setError([400, 403, 409].includes(err.status) ? err.message
        : err.status === 401 ? "Your session has expired. Please sign in again."
          : "Unable to save your profile. Please try again.");
    } finally {
      pending.current = false;
      if (active.current) setSaving(false);
    }
  };
  return <section className="panel" aria-label="Edit Profile">
    <div className="panel-heading"><h3>Edit Profile</h3></div>
    <AlertMessage type="danger" message={error} />
    <form onSubmit={save} noValidate aria-label="Edit profile form">
      <fieldset disabled={saving}>
        <div className="row">
          <div className="col-sm-6 mb-3">
            <label className="form-label" htmlFor="profile-name">Name</label>
            <input id="profile-name" className="form-control" value={name} onChange={event => setName(event.target.value)} required minLength={2} maxLength={120} autoComplete="name" autoFocus />
          </div>
          <div className="col-sm-6 mb-3">
            <label className="form-label" htmlFor="profile-email">Email</label>
            <input id="profile-email" type="email" className="form-control" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" aria-describedby="profile-email-help" />
            <div id="profile-email-help" className="form-text">Optional. Leave blank to remove your email.</div>
          </div>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <button type="button" className="btn btn-outline-secondary" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <LoadingSpinner label="Saving..." /> : "Save Changes"}
          </button>
        </div>
      </fieldset>
    </form>
  </section>;
};

export default ProfileEditor;

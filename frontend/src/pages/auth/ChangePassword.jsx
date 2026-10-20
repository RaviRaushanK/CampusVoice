import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import AlertMessage from "../../components/common/AlertMessage";

const ChangePassword = () => {
  const {
    doChangePassword,
    doLogout,
    getDashboardPath,
    user,
    needsPasswordChange,
    error,
    loading: authLoading,
    loggingOut,
  } = useAuth();

  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isFirstLogin = needsPasswordChange || (user && user.mustChangePassword);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);

    if (!currentPassword) {
      setFormError("Please enter your current password.");
      setSubmitting(false);
      return;
    }

    if (!newPassword || newPassword.length < 8) {
      setFormError("New password must be at least 8 characters.");
      setSubmitting(false);
      return;
    }

    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/.test(newPassword)) {
      setFormError(
        "New password must contain uppercase, lowercase, digit and special character."
      );
      setSubmitting(false);
      return;
    }

    if (!confirmPassword) {
      setFormError("Please confirm your new password.");
      setSubmitting(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setFormError("New password and confirmation do not match.");
      setSubmitting(false);
      return;
    }

    const result = await doChangePassword(currentPassword, newPassword, confirmPassword);

    if (result.ok) {
      navigate(getDashboardPath(result.user.role), { replace: true });
      return;
    } else {
      setFormError(result.error || "Password change failed.");
    }

    setSubmitting(false);
  };

  return (
    <main className="auth-page">
      <section className="auth-panel" aria-labelledby="password-title">
        <div className="text-center mb-4">
          <div className="brand-mark auth-brand" aria-hidden="true">
            CV
          </div>
          <div>
            <h1 id="password-title" className="auth-title">CampusVoice</h1>
            <p className="auth-subtitle">
              {isFirstLogin ? "First login - change your password" : "Change your password"}
            </p>
          </div>
        </div>

        {(formError || error) && (
          <AlertMessage type="danger" message={formError || error} />
        )}

        <form onSubmit={handleSubmit} noValidate>
          <fieldset disabled={loggingOut}>
          <div className="mb-3">
            <label htmlFor="currentPassword" className="form-label">
              Current password
            </label>
            <input
              type="password"
              id="currentPassword"
              className="form-control"
              placeholder="Enter current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={submitting || authLoading}
              autoComplete="current-password"
              required
            />
          </div>

          <div className="mb-3">
            <label htmlFor="newPassword" className="form-label">
              New password
            </label>
            <div className="input-group">
              <input
                type={showNew ? "text" : "password"}
                id="newPassword"
                className="form-control"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={submitting || authLoading}
                autoComplete="new-password"
                aria-describedby="password-requirements"
                required
              />
              <button
                type="button"
                className="btn btn-outline-secondary"
                aria-label={showNew ? "Hide new password" : "Show new password"}
                aria-pressed={showNew}
                title={showNew ? "Hide new password" : "Show new password"}
                onClick={() => setShowNew(v => !v)}
                disabled={submitting || authLoading}
              >
                <i className={`bi ${showNew ? "bi-eye-slash" : "bi-eye"}`} aria-hidden="true" />
              </button>
            </div>
            <div id="password-requirements" className="form-text">
              At least 8 characters with uppercase, lowercase, digit, and special character.
            </div>
          </div>

          <div className="mb-3">
            <label htmlFor="confirmPassword" className="form-label">
              Confirm new password
            </label>
            <div className="input-group">
              <input
                type={showConfirm ? "text" : "password"}
                id="confirmPassword"
                className="form-control"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={submitting || authLoading}
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                className="btn btn-outline-secondary"
                aria-label={showConfirm ? "Hide password confirmation" : "Show password confirmation"}
                aria-pressed={showConfirm}
                title={showConfirm ? "Hide password confirmation" : "Show password confirmation"}
                onClick={() => setShowConfirm(v => !v)}
                disabled={submitting || authLoading}
              >
                <i className={`bi ${showConfirm ? "bi-eye-slash" : "bi-eye"}`} aria-hidden="true" />
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary w-100"
            disabled={submitting || authLoading}
          >
            {submitting || authLoading ? <LoadingSpinner label="Updating password" /> : "Update password"}
          </button>
          </fieldset>
        </form>

        <div className="text-center mt-3">
          <p className="auth-subtitle">
            <button type="button" className="btn btn-link" disabled={submitting || loggingOut} onClick={doLogout}><i className="bi bi-box-arrow-right me-2" aria-hidden="true" />{loggingOut ? "Logging out..." : "Logout"}</button>
          </p>
        </div>
      </section>
    </main>
  );
};

export default ChangePassword;

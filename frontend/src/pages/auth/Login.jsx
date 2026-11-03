import React, { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import AlertMessage from "../../components/common/AlertMessage";
import AuthIntro from "../../components/common/AuthIntro";
import "../../styles/auth.css";

const Login = () => {
  const { user, doLogin, getDashboardPath, needsPasswordChange, error, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [userCode, setUserCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);

    if (!userCode.trim()) {
      setFormError("Please enter your user code.");
      setSubmitting(false);
      return;
    }

    if (!password) {
      setFormError("Please enter your password.");
      setSubmitting(false);
      return;
    }

    const result = await doLogin(userCode.trim(), password);

    if (result.ok) {
      if (result.needsPasswordChange) {
        navigate("/change-password", { replace: true });
        return;
      }
      navigate(getDashboardPath(result.user && result.user.role), { replace: true });
    } else {
      setFormError(result.error || "Login failed. Please try again.");
    }

    setSubmitting(false);
  };

  if (authLoading) return <div className="d-flex min-vh-100 align-items-center justify-content-center"><LoadingSpinner label="Checking session" /></div>;
  if (user) return <Navigate to={needsPasswordChange ? "/change-password" : getDashboardPath(user.role)} replace />;

  return (
    <main className="auth-page">
      <AuthIntro />
      <section className="auth-panel" aria-labelledby="login-title">
        <div className="auth-panel-header mb-4">
          <div className="brand-mark auth-brand" aria-hidden="true">
            CV
          </div>
          <div>
            <h1 id="login-title" className="auth-title">CampusVoice</h1>
            <p className="auth-subtitle">College Feedback &middot; Survey &middot; Grievance Management</p>
          </div>
        </div>

        <AlertMessage type="danger" message={formError || error} />

        <h2 className="h5 mb-3">Welcome back</h2>
        <p className="auth-form-caption">Sign in to your college workspace.</p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-3">
            <label htmlFor="userCode" className="form-label">
              User Code
            </label>
            <input
              type="text"
              id="userCode"
              className="form-control"
              placeholder="Enter your user code"
              value={userCode}
              onChange={(e) => setUserCode(e.target.value)}
              disabled={submitting || authLoading}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              maxLength={50}
            />
          </div>

          <div className="mb-3">
            <label htmlFor="password" className="form-label">
              Password
            </label>
            <div className="input-group">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                className="form-control"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting || authLoading}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="btn btn-outline-secondary"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                title={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword(v => !v)}
                disabled={submitting || authLoading}
              >
                <i className={`bi ${showPassword ? "bi-eye-slash" : "bi-eye"}`} aria-hidden="true" />
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary w-100"
            disabled={submitting || authLoading}
          >
            {submitting || authLoading ? <LoadingSpinner label="Signing in" /> : "Sign in"}
          </button>
        </form>

        <p className="text-muted small text-center mt-4 mb-0">Use the account provided by your administrator. Contact them if you need help signing in.</p>

      </section>
    </main>
  );
};

export default Login;

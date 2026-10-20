import { createContext, useState, useContext, useEffect, useCallback, useRef } from "react";
import * as auth from "../services/authService";
const AuthContext = createContext(null);
const ROLE_DASHBOARD = { PRINCIPAL: "/principal/dashboard", HOD: "/hod/dashboard", FACULTY: "/faculty/dashboard", STUDENT: "/student/dashboard" };
export const getDashboardPath = role => ROLE_DASHBOARD[role] || "/login";
export const AuthProvider = ({ children }) => {
  const revision = useRef(0);
  const operationInProgress = useRef(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const restoreSession = useCallback(async () => {
    if (operationInProgress.current) return;
    const currentRevision = ++revision.current;
    try { const result = await auth.me(); if (revision.current === currentRevision) { setUser(result.data); setError(""); } }
    catch (err) {
      if (revision.current === currentRevision) {
        if (err.status === 401) {
          setUser(null);
          setError("");
        } else {
          setError("Unable to check your session. Please try again.");
        }
      }
    }
    finally { if (revision.current === currentRevision) setLoading(false); }
  }, []);
  useEffect(() => {
    const expired = () => { revision.current++; setUser(null); setError("Your session has expired. Please sign in again."); };
    const required = () => setUser(current => current ? { ...current, mustChangePassword: true } : null);
    window.addEventListener("auth:expired", expired);
    window.addEventListener("auth:password-required", required);
    restoreSession();
    // Recheck cookies after tab switching and periodically to catch revoked/expired sessions.
    const onVisible = () => { if (document.visibilityState === "visible") restoreSession(); };
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(restoreSession, 60000);
    return () => {
      revision.current++;
      window.removeEventListener("auth:expired", expired);
      window.removeEventListener("auth:password-required", required);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [restoreSession]);
  const doLogin = async (userCode, password) => {
    operationInProgress.current = true;
    revision.current++;
    setError("");
    try {
      const profile = (await auth.login(userCode, password)).data;
      setUser(profile);
      return { ok: true, user: profile, needsPasswordChange: profile.mustChangePassword };
    } catch (err) { setUser(null); return { ok: false, error: err.message }; }
    finally { revision.current++; operationInProgress.current = false; setLoading(false); }
  };
  const doChangePassword = async (...args) => {
    operationInProgress.current = true;
    revision.current++;
    try {
      const profile = (await auth.changePassword(...args)).data;
      setUser(profile); setError("");
      return { ok: true, user: profile };
    } catch (err) { return { ok: false, error: err.message }; }
    finally { revision.current++; operationInProgress.current = false; }
  };
  const doLogout = async () => {
    if (operationInProgress.current) return { ok: false };
    operationInProgress.current = true;
    setLoggingOut(true);
    revision.current++;
    try { await auth.logout(); setUser(null); setError(""); return { ok: true }; }
    catch (err) {
      if (err.status === 401) { setUser(null); return { ok: true }; }
      setError("Logout failed. Please try again.");
      return { ok: false, error: err.message };
    }
    finally { revision.current++; operationInProgress.current = false; setLoggingOut(false); }
  };
  return <AuthContext.Provider value={{ user, loading, error, loggingOut, needsPasswordChange: Boolean(user?.mustChangePassword), doLogin, doChangePassword, doLogout, restoreSession, getDashboardPath }}>{children}</AuthContext.Provider>;
};
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

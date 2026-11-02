import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthContext";
import * as service from "../services/notificationService";

const NotificationContext = createContext(null);

const NotificationSession = ({ enabled, children }) => {
  const [unreadCount, setUnreadCount] = useState(null);
  const [countError, setCountError] = useState("");
  const [countLoading, setCountLoading] = useState(false);
  const active = useRef(true);
  const controller = useRef(new AbortController());
  const revision = useRef(0);
  const inFlight = useRef(null);
  const refreshUnreadCount = useCallback(({ force = false } = {}) => {
    if (!enabled || !active.current) return Promise.resolve({ ok: false });
    if (inFlight.current && !force) return inFlight.current;
    const currentRevision = ++revision.current;
    setCountLoading(true);
    const pending = service.getUnreadCount({ signal: controller.current.signal }).then(result => {
      if (!Number.isSafeInteger(result?.data?.count) || result.data.count < 0) throw new Error("Invalid unread count");
      if (active.current && currentRevision === revision.current) {
        setUnreadCount(result.data.count); setCountError("");
      }
      return { ok: true };
    }).catch(err => {
      if (active.current && currentRevision === revision.current && err.name !== "AbortError") {
        setUnreadCount(null); setCountError("Unable to load the unread count. Please try again.");
      }
      return { ok: false };
    }).finally(() => {
      if (inFlight.current === pending) inFlight.current = null;
      if (active.current && currentRevision === revision.current) setCountLoading(false);
    });
    inFlight.current = pending;
    return pending;
  }, [enabled]);

  useEffect(() => {
    active.current = true;
    if (controller.current.signal.aborted) controller.current = new AbortController();
    refreshUnreadCount();
    const visible = () => { if (document.visibilityState === "visible") refreshUnreadCount(); };
    document.addEventListener("visibilitychange", visible);
    return () => {
      active.current = false; revision.current++; inFlight.current = null;
      controller.current.abort();
      document.removeEventListener("visibilitychange", visible);
    };
  }, [refreshUnreadCount]);

  const markRead = async id => {
    if (!enabled || !active.current) throw new DOMException("Notification session ended", "AbortError");
    const result = await service.markNotificationRead(id, { signal: controller.current.signal });
    if (active.current) await refreshUnreadCount({ force: true });
    return result;
  };
  const markAllRead = async () => {
    if (!enabled || !active.current) throw new DOMException("Notification session ended", "AbortError");
    const result = await service.markAllNotificationsRead({ signal: controller.current.signal });
    if (active.current) await refreshUnreadCount({ force: true });
    return result;
  };
  return <NotificationContext.Provider value={{ unreadCount, countError, countLoading, refreshUnreadCount, markRead, markAllRead }}>
    {children}
  </NotificationContext.Provider>;
};

export const NotificationProvider = ({ children }) => {
  const { user, loading, loggingOut } = useAuth();
  const identity = !loading && user && !user.mustChangePassword ? `${user.id || user.userCode}:${user.role}` : null;
  // A different session identity gets fresh state and aborts the previous user's requests.
  return <NotificationSession key={identity || "signed-out"} enabled={Boolean(identity) && !loggingOut}>{children}</NotificationSession>;
};
export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useNotifications must be used within NotificationProvider");
  return context;
};
